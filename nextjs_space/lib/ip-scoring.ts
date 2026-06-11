/**
 * IP Scoring — Swappable Provider Interface
 * ============================================================
 * Default provider: ip-api.com (free, no key, includes proxy/hosting flags)
 * Gated by ABUSE_GATE_IP_SCORING env var.
 *
 * Blocked countries: NG, PK, BD, ID, PH, RO, UA, VE
 * Vietnam (VN) is explicitly NOT blocked (owner is based in VN).
 */

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────

export interface IpScoringResult {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  hosting: boolean;
  country: string;       // ISO 3166-1 alpha-2
  countryName: string;
  isp: string;
  org: string;
  /** Whether this IP is on the admin allowlist */
  allowlisted: boolean;
  /** Raw provider response for debugging */
  raw?: Record<string, unknown>;
}

export interface IpGateDecision {
  allowed: boolean;
  reason?: 'vpn' | 'proxy' | 'tor' | 'hosting' | 'blocked_country' | 'ip_rate_limit';
  details?: string;
  scoring?: IpScoringResult;
}

// ── Config ──────────────────────────────────────────────────────────

const GATE_ON = (process.env.ABUSE_GATE_IP_SCORING || 'off').toLowerCase() === 'on';

/** Countries blocked from trial signup. VN explicitly excluded. */
export const BLOCKED_COUNTRIES = ['NG', 'PK', 'BD', 'ID', 'PH', 'RO', 'UA', 'VE'];

/** Max trial attempts per IP per 24h. */
const MAX_IP_ATTEMPTS_24H = 3;

export function isIpScoringGateOn(): boolean {
  return GATE_ON;
}

// ── Allowlist Check ─────────────────────────────────────────────────

async function isIpAllowlisted(ip: string): Promise<boolean> {
  const entry = await prisma.ipAllowlist.findUnique({ where: { ip } });
  return !!entry;
}

// ── IP Rate Limiting (per-IP trial attempts in 24h) ─────────────────

import crypto from 'crypto';

const DEVICE_FP_SALT = process.env.DEVICE_FP_SALT || 'mrai-fp-salt-v1';

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${DEVICE_FP_SALT}:ip:${ip}`).digest('hex');
}

async function checkIpRateLimit(ip: string): Promise<boolean> {
  const ipHash = hashIp(ip);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const count = await prisma.trialLock.count({
    where: {
      ipAddressHash: ipHash,
      createdAt: { gte: twentyFourHoursAgo },
    },
  });

  return count < MAX_IP_ATTEMPTS_24H;
}

// ── Provider: ip-api.com ────────────────────────────────────────────

async function scoreIpWithIpApi(ip: string): Promise<IpScoringResult> {
  try {
    // ip-api.com free tier: http only, 45 req/min, fields param for efficiency
    const fields = 'status,country,countryCode,isp,org,proxy,hosting,query';
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
      { signal: AbortSignal.timeout(5000) },
    );
    const data = await res.json();

    if (data.status !== 'success') {
      console.warn('[ip-scoring] ip-api.com returned non-success:', data);
      // Fail open on provider error
      return {
        vpn: false, proxy: false, tor: false, hosting: false,
        country: '', countryName: '', isp: '', org: '',
        allowlisted: false, raw: data,
      };
    }

    return {
      vpn: false, // ip-api free doesn't distinguish VPN from proxy
      proxy: data.proxy === true,
      tor: false, // ip-api free doesn't have tor detection
      hosting: data.hosting === true,
      country: data.countryCode || '',
      countryName: data.country || '',
      isp: data.isp || '',
      org: data.org || '',
      allowlisted: false,
      raw: data,
    };
  } catch (err) {
    console.error('[ip-scoring] Provider error:', err);
    // Fail open
    return {
      vpn: false, proxy: false, tor: false, hosting: false,
      country: '', countryName: '', isp: '', org: '',
      allowlisted: false,
    };
  }
}

// ── Main Gate Function ──────────────────────────────────────────────

/**
 * Score an IP address and determine if it should be allowed for trial.
 * If gate is OFF, returns allowed:true with no scoring.
 */
export async function checkIpGate(ip: string): Promise<IpGateDecision> {
  if (!isIpScoringGateOn()) {
    return { allowed: true, details: 'IP scoring gate is off' };
  }

  // Check allowlist first
  const allowlisted = await isIpAllowlisted(ip);
  if (allowlisted) {
    return { allowed: true, details: 'IP is on admin allowlist' };
  }

  // Check IP rate limit
  const withinLimit = await checkIpRateLimit(ip);
  if (!withinLimit) {
    return {
      allowed: false,
      reason: 'ip_rate_limit',
      details: `Exceeded ${MAX_IP_ATTEMPTS_24H} trial attempts per IP in 24h`,
    };
  }

  // Score the IP
  const scoring = await scoreIpWithIpApi(ip);
  scoring.allowlisted = false;

  // Check VPN/Proxy/Tor/Hosting
  if (scoring.vpn) return { allowed: false, reason: 'vpn', details: 'VPN detected', scoring };
  if (scoring.proxy) return { allowed: false, reason: 'proxy', details: 'Proxy detected', scoring };
  if (scoring.tor) return { allowed: false, reason: 'tor', details: 'Tor exit node detected', scoring };
  if (scoring.hosting) return { allowed: false, reason: 'hosting', details: 'Hosting/datacenter IP', scoring };

  // Check blocked countries
  if (scoring.country && BLOCKED_COUNTRIES.includes(scoring.country.toUpperCase())) {
    return {
      allowed: false,
      reason: 'blocked_country',
      details: `Country ${scoring.country} (${scoring.countryName}) is blocked`,
      scoring,
    };
  }

  return { allowed: true, scoring };
}
