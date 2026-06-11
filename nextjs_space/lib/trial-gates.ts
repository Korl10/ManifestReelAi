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
 *
 * Only runs when PRICING_V2 flag is ON (or on /dev staging routes).
 */

import { prisma } from '@/lib/prisma';
import { isDisposableDomain } from '@/lib/disposable-domains';
import { isEmailOtpVerified } from '@/lib/otp';
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
  blockedBy?: 'email_disposable' | 'email_not_verified' | 'email_already_trialed' | 'card_already_trialed' | 'device_already_trialed' | 'ip_already_trialed';
  /** User-facing message */
  message?: string;
}

export interface TrialGateInput {
  email: string;
  cardFingerprint?: string | null;
  deviceFpHash?: string | null;
  ipAddressHash?: string | null;
  /** If true, skip OTP verification check (for staging/dev testing) */
  skipOtpCheck?: boolean;
}

/**
 * Check all trial gates for a prospective trial signup.
 * Returns { allowed: true } if all gates pass.
 */
export async function checkTrialGates(input: TrialGateInput): Promise<TrialGateResult> {
  const email = input.email.toLowerCase().trim();

  // Gate 1a: Disposable email check
  const disposable = await isDisposableDomain(email);
  if (disposable) {
    return {
      allowed: false,
      blockedBy: 'email_disposable',
      message: 'Please use a permanent email address (Gmail, Outlook, iCloud, etc.) to start your free trial.',
    };
  }

  // Gate 1b: Email OTP verified
  if (!input.skipOtpCheck) {
    const verified = await isEmailOtpVerified(email);
    if (!verified) {
      return {
        allowed: false,
        blockedBy: 'email_not_verified',
        message: 'Please verify your email address first.',
      };
    }
  }

  // Gate 1c: Email not already used for a trial
  const emailLock = await prisma.trialLock.findUnique({ where: { email } });
  if (emailLock && !emailLock.supportOverride) {
    return {
      allowed: false,
      blockedBy: 'email_already_trialed',
      message: 'This email has already been used for a free trial. Please subscribe to continue creating reels.',
    };
  }

  // Gate 2: Card fingerprint
  if (input.cardFingerprint) {
    const cardLock = await prisma.trialLock.findUnique({
      where: { cardFingerprint: input.cardFingerprint },
    });
    if (cardLock && cardLock.email !== email && !cardLock.supportOverride) {
      return {
        allowed: false,
        blockedBy: 'card_already_trialed',
        message: 'This payment method was already used for a free trial. Please subscribe with a different card.',
      };
    }
  }

  // Gate 3: Device fingerprint
  if (input.deviceFpHash) {
    const deviceLock = await prisma.trialLock.findUnique({
      where: { deviceFpHash: input.deviceFpHash },
    });
    if (deviceLock && deviceLock.email !== email && !deviceLock.supportOverride) {
      return {
        allowed: false,
        blockedBy: 'device_already_trialed',
        message: 'A free trial has already been used on this device. Please subscribe to continue.',
      };
    }
  }

  // Gate 4: IP address (Phase 5D — only check if populated)
  if (input.ipAddressHash) {
    const ipLock = await prisma.trialLock.findUnique({
      where: { ipAddressHash: input.ipAddressHash },
    });
    if (ipLock && ipLock.email !== email && !ipLock.supportOverride) {
      return {
        allowed: false,
        blockedBy: 'ip_already_trialed',
        message: 'A free trial has already been used from this network. Please subscribe to continue.',
      };
    }
  }

  return { allowed: true };
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
      trialOutcome: 'PENDING',
    },
    update: {
      cardFingerprint: params.cardFingerprint || undefined,
      deviceFpHash: params.deviceFpHash || undefined,
      ipAddressHash: params.ipAddressHash || undefined,
      subscriptionId: params.subscriptionId || undefined,
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
