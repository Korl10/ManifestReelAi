/**
 * Unified Trial Gate Checker
 * ============================================================
 * Validates ALL anti-abuse gates before allowing a trial to proceed.
 * Used by the trial signup flow and the reel generation API.
 *
 * Gates:
 *   Gate 1: Email verified via OTP + not disposable
 *   Gate 2: Card fingerprint not previously used for trial
 *   Gate 3: Device fingerprint not previously used for trial
 *   Gate 4: IP address not previously used (Phase 5D — schema ready)
 *   Gate 5: reCAPTCHA v3 scoring (Phase 5D — gated by ABUSE_GATE_RECAPTCHA)
 *   Gate 6: IP/VPN scoring (Phase 5D — gated by ABUSE_GATE_IP_SCORING)
 *
 * Only runs when PRICING_V2 flag is ON (or on /dev staging routes).
 */

import { prisma } from '@/lib/prisma';
import { isDisposableDomain } from '@/lib/disposable-domains';
import { isEmailOtpVerified } from '@/lib/otp';
import { verifyRecaptcha, interpretRecaptchaScore, isRecaptchaGateOn, type RecaptchaDecision } from '@/lib/recaptcha';
import { checkIpGate, isIpScoringGateOn, type IpGateDecision } from '@/lib/ip-scoring';
import crypto from 'crypto';

const DEVICE_FP_SALT = process.env.DEVICE_FP_SALT || 'mrai-fp-salt-v1';

/** Hash a device fingerprint with app-specific salt. */
export function hashDeviceFp(rawFingerprint: string): string {
  return crypto.createHash('sha256').update(`${DEVICE_FP_SALT}:${rawFingerprint}`).digest('hex');
}

/** Hash an IP address for privacy-compliant storage. */
export function hashIpAddress(ip: string): string {
  return crypto.createHash('sha256').update(`${DEVICE_FP_SALT}:ip:${ip}`).digest('hex');
}

export interface TrialGateResult {
  allowed: boolean;
  /** Which gate blocked (null if allowed) */
  blockedBy?: 'email_disposable' | 'email_not_verified' | 'email_already_trialed' | 'card_already_trialed' | 'device_already_trialed' | 'ip_already_trialed' | 'recaptcha_block' | 'ip_vpn' | 'ip_proxy' | 'ip_tor' | 'ip_hosting' | 'ip_blocked_country' | 'ip_rate_limit';
  /** User-facing message */
  message?: string;
  /** reCAPTCHA decision (for OTP escalation) */
  recaptchaDecision?: RecaptchaDecision;
  /** Full gate decision log for TrialLock.gateResults */
  gateLog?: Record<string, unknown>;
  /** reCAPTCHA score for TrialLock.recaptchaScore */
  recaptchaScore?: number;
  /** IP country for TrialLock.ipCountry */
  ipCountry?: string;
}

export interface TrialGateInput {
  email: string;
  cardFingerprint?: string | null;
  deviceFpHash?: string | null;
  ipAddressHash?: string | null;
  /** Raw IP address for IP scoring (not hashed) */
  rawIp?: string | null;
  /** reCAPTCHA v3 token from client */
  recaptchaToken?: string | null;
  /** If true, skip OTP verification check (for staging/dev testing) */
  skipOtpCheck?: boolean;
}

/**
 * Check all trial gates for a prospective trial signup.
 * Returns { allowed: true } if all gates pass.
 * Populates gateLog for storage in TrialLock.gateResults.
 */
export async function checkTrialGates(input: TrialGateInput): Promise<TrialGateResult> {
  const email = input.email.toLowerCase().trim();
  const gateLog: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    email,
    gates: {} as Record<string, unknown>,
  };

  // Gate 1a: Disposable email check
  const disposable = await isDisposableDomain(email);
  (gateLog.gates as any).email_disposable = { checked: true, blocked: disposable };
  if (disposable) {
    return {
      allowed: false,
      blockedBy: 'email_disposable',
      message: 'Please use a permanent email address (Gmail, Outlook, iCloud, etc.) to start your free trial.',
      gateLog,
    };
  }

  // Gate 1b: Email OTP verified
  if (!input.skipOtpCheck) {
    const verified = await isEmailOtpVerified(email);
    (gateLog.gates as any).email_otp = { checked: true, verified };
    if (!verified) {
      return {
        allowed: false,
        blockedBy: 'email_not_verified',
        message: 'Please verify your email address first.',
        gateLog,
      };
    }
  } else {
    (gateLog.gates as any).email_otp = { checked: false, skipped: true };
  }

  // Gate 1c: Email not already used for a trial
  const emailLock = await prisma.trialLock.findUnique({ where: { email } });
  const emailBlocked = emailLock && !emailLock.supportOverride;
  (gateLog.gates as any).email_used = { checked: true, blocked: !!emailBlocked };
  if (emailBlocked) {
    return {
      allowed: false,
      blockedBy: 'email_already_trialed',
      message: 'This email has already been used for a free trial. Please subscribe to continue creating reels.',
      gateLog,
    };
  }

  // Gate 2: Card fingerprint
  if (input.cardFingerprint) {
    const cardLock = await prisma.trialLock.findUnique({
      where: { cardFingerprint: input.cardFingerprint },
    });
    const cardBlocked = cardLock && cardLock.email !== email && !cardLock.supportOverride;
    (gateLog.gates as any).card_fp = { checked: true, blocked: !!cardBlocked };
    if (cardBlocked) {
      return {
        allowed: false,
        blockedBy: 'card_already_trialed',
        message: 'This payment method was already used for a free trial. Please subscribe with a different card.',
        gateLog,
      };
    }
  } else {
    (gateLog.gates as any).card_fp = { checked: false, skipped: true };
  }

  // Gate 3: Device fingerprint
  if (input.deviceFpHash) {
    const deviceLock = await prisma.trialLock.findUnique({
      where: { deviceFpHash: input.deviceFpHash },
    });
    const deviceBlocked = deviceLock && deviceLock.email !== email && !deviceLock.supportOverride;
    (gateLog.gates as any).device_fp = { checked: true, blocked: !!deviceBlocked };
    if (deviceBlocked) {
      return {
        allowed: false,
        blockedBy: 'device_already_trialed',
        message: 'A free trial has already been used on this device. Please subscribe to continue.',
        gateLog,
      };
    }
  } else {
    (gateLog.gates as any).device_fp = { checked: false, skipped: true };
  }

  // Gate 4: IP address hash uniqueness
  if (input.ipAddressHash) {
    const ipLock = await prisma.trialLock.findUnique({
      where: { ipAddressHash: input.ipAddressHash },
    });
    const ipBlocked = ipLock && ipLock.email !== email && !ipLock.supportOverride;
    (gateLog.gates as any).ip_hash = { checked: true, blocked: !!ipBlocked };
    if (ipBlocked) {
      return {
        allowed: false,
        blockedBy: 'ip_already_trialed',
        message: 'A free trial has already been used from this network. Please subscribe to continue.',
        gateLog,
      };
    }
  } else {
    (gateLog.gates as any).ip_hash = { checked: false, skipped: true };
  }

  // ── Phase 5D Gates ──────────────────────────────────────────

  let recaptchaScore: number | undefined;
  let recaptchaDecision: RecaptchaDecision | undefined;
  let ipCountry: string | undefined;

  // Gate 5: reCAPTCHA v3 scoring
  if (isRecaptchaGateOn() && input.recaptchaToken) {
    const rcResult = await verifyRecaptcha(input.recaptchaToken);
    recaptchaScore = rcResult.score;
    recaptchaDecision = interpretRecaptchaScore(rcResult.score);
    (gateLog.gates as any).recaptcha = {
      checked: true,
      score: rcResult.score,
      decision: recaptchaDecision,
      success: rcResult.success,
      action: rcResult.action,
    };

    if (recaptchaDecision === 'block') {
      return {
        allowed: false,
        blockedBy: 'recaptcha_block',
        message: 'Security verification failed. Please try again later.',
        recaptchaDecision,
        recaptchaScore,
        gateLog,
      };
    }
    // 'otp_required' handled at callsite (force OTP step)
  } else {
    (gateLog.gates as any).recaptcha = {
      checked: false,
      gateOn: isRecaptchaGateOn(),
      tokenProvided: !!input.recaptchaToken,
    };
  }

  // Gate 6: IP/VPN scoring
  let ipGateResult: IpGateDecision | undefined;
  if (isIpScoringGateOn() && input.rawIp) {
    ipGateResult = await checkIpGate(input.rawIp);
    ipCountry = ipGateResult.scoring?.country || undefined;
    (gateLog.gates as any).ip_scoring = {
      checked: true,
      allowed: ipGateResult.allowed,
      reason: ipGateResult.reason,
      details: ipGateResult.details,
      country: ipCountry,
      vpn: ipGateResult.scoring?.vpn,
      proxy: ipGateResult.scoring?.proxy,
      tor: ipGateResult.scoring?.tor,
      hosting: ipGateResult.scoring?.hosting,
      allowlisted: ipGateResult.scoring?.allowlisted,
    };

    if (!ipGateResult.allowed && ipGateResult.reason) {
      const reasonToBlockedBy: Record<string, TrialGateResult['blockedBy']> = {
        vpn: 'ip_vpn',
        proxy: 'ip_proxy',
        tor: 'ip_tor',
        hosting: 'ip_hosting',
        blocked_country: 'ip_blocked_country',
        ip_rate_limit: 'ip_rate_limit',
      };

      const userMessages: Record<string, string> = {
        vpn: 'VPN connections are not allowed for free trials. Please disconnect your VPN and try again.',
        proxy: 'Proxy connections are not allowed for free trials. Please use a direct connection.',
        tor: 'Tor connections are not allowed for free trials.',
        hosting: 'Datacenter/hosting IPs are not allowed for free trials. Please use a residential connection.',
        blocked_country: 'Free trials are not available in your region. Please subscribe to get started.',
        ip_rate_limit: 'Too many trial attempts from your network. Please try again later or subscribe.',
      };

      return {
        allowed: false,
        blockedBy: reasonToBlockedBy[ipGateResult.reason],
        message: userMessages[ipGateResult.reason] || 'Trial not available from your network.',
        recaptchaDecision,
        recaptchaScore,
        ipCountry,
        gateLog,
      };
    }
  } else {
    (gateLog.gates as any).ip_scoring = {
      checked: false,
      gateOn: isIpScoringGateOn(),
      ipProvided: !!input.rawIp,
    };
  }

  return {
    allowed: true,
    recaptchaDecision,
    recaptchaScore,
    ipCountry,
    gateLog,
  };
}

/**
 * Create a trial lock record. Called after trial checkout completes.
 */
export async function createTrialLock(params: {
  email: string;
  cardFingerprint?: string | null;
  deviceFpHash?: string | null;
  ipAddressHash?: string | null;
  subscriptionId?: string | null;
  gateResults?: Record<string, unknown> | null;
  recaptchaScore?: number | null;
  ipCountry?: string | null;
}): Promise<void> {
  const email = params.email.toLowerCase().trim();

  // Upsert: if email lock exists, update with additional fingerprints
  await prisma.trialLock.upsert({
    where: { email },
    create: {
      email,
      cardFingerprint: params.cardFingerprint || null,
      deviceFpHash: params.deviceFpHash || null,
      ipAddressHash: params.ipAddressHash || null,
      subscriptionId: params.subscriptionId || null,
      gateResults: (params.gateResults as any) || undefined,
      recaptchaScore: params.recaptchaScore ?? null,
      ipCountry: params.ipCountry || null,
      trialOutcome: 'PENDING',
    },
    update: {
      cardFingerprint: params.cardFingerprint || undefined,
      deviceFpHash: params.deviceFpHash || undefined,
      ipAddressHash: params.ipAddressHash || undefined,
      subscriptionId: params.subscriptionId || undefined,
      gateResults: (params.gateResults as any) || undefined,
      recaptchaScore: params.recaptchaScore !== undefined ? params.recaptchaScore : undefined,
      ipCountry: params.ipCountry || undefined,
    },
  });
}

/**
 * Mark trial consumed (reel generated).
 */
export async function markTrialConsumed(email: string, reelId: string): Promise<void> {
  await prisma.trialLock.update({
    where: { email: email.toLowerCase().trim() },
    data: {
      trialConsumedAt: new Date(),
      reelId,
    },
  }).catch((err) => {
    console.warn('[trial-gates] markTrialConsumed failed (non-fatal):', (err as any)?.message);
  });
}

/**
 * Update trial outcome (CONVERTED | CANCELLED | EXPIRED).
 */
export async function updateTrialOutcome(
  email: string,
  outcome: 'CONVERTED' | 'CANCELLED' | 'EXPIRED',
): Promise<void> {
  await prisma.trialLock.update({
    where: { email: email.toLowerCase().trim() },
    data: { trialOutcome: outcome },
  }).catch((err) => {
    console.warn('[trial-gates] updateTrialOutcome failed (non-fatal):', (err as any)?.message);
  });
}
