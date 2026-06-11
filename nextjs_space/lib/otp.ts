/**
 * Email OTP + Magic Link system for trial signup verification.
 * ============================================================
 * Gate 1 of anti-abuse: verifies the user controls the email address.
 *
 * Flow:
 *   1. User enters email → POST /api/trial/send-otp
 *   2. Server generates 6-digit code + magic link token, stores in EmailOtp.
 *   3. Email sent with BOTH the code AND the magic link (user choice).
 *   4. User enters code → POST /api/trial/verify-otp (or clicks magic link).
 *   5. On success, OTP row marked verified=true.
 *
 * Limits:
 *   - Code expires in 10 minutes.
 *   - Max 5 verification attempts, then 30-min cooldown.
 *   - 1 resend per 60 seconds, max 3 per hour.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 30;
const RESEND_INTERVAL_SEC = 60;
const MAX_RESENDS_PER_HOUR = 3;

/** Generate a cryptographically random 6-digit numeric code. */
function generateCode(): string {
  // Use crypto for unbiased 6-digit generation
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, '0');
}

/** Generate a random magic link token. */
function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface SendOtpResult {
  success: boolean;
  error?: string;
  /** seconds until user can request another code */
  retryAfterSec?: number;
}

/**
 * Create a new OTP + magic token for the given email.
 * Returns error if rate-limited.
 */
export async function createOtp(email: string): Promise<SendOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Rate limit: max 3 sends per hour
  const recentCount = await prisma.emailOtp.count({
    where: {
      email: normalizedEmail,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= MAX_RESENDS_PER_HOUR) {
    return { success: false, error: 'Too many verification requests. Please try again in an hour.' };
  }

  // Rate limit: 1 resend per 60 seconds
  const lastOtp = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: 'desc' },
  });

  if (lastOtp) {
    const secsSinceLast = (now.getTime() - lastOtp.createdAt.getTime()) / 1000;
    if (secsSinceLast < RESEND_INTERVAL_SEC) {
      const retryAfterSec = Math.ceil(RESEND_INTERVAL_SEC - secsSinceLast);
      return { success: false, error: `Please wait ${retryAfterSec}s before requesting a new code.`, retryAfterSec };
    }
  }

  // Check cooldown: if last OTP had 5+ failed attempts
  if (lastOtp && lastOtp.attempts >= MAX_ATTEMPTS) {
    const cooldownEnd = new Date(lastOtp.createdAt.getTime() + COOLDOWN_MINUTES * 60 * 1000);
    if (now < cooldownEnd) {
      const retryAfterSec = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000);
      return {
        success: false,
        error: `Too many failed attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
        retryAfterSec,
      };
    }
  }

  const code = generateCode();
  const magicToken = generateMagicToken();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.emailOtp.create({
    data: {
      email: normalizedEmail,
      code,
      magicToken,
      expiresAt,
    },
  });

  return { success: true };
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  email?: string;
}

/** Verify a 6-digit OTP code. */
export async function verifyOtpCode(email: string, code: string): Promise<VerifyOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Find the most recent non-expired OTP for this email
  const otp = await prisma.emailOtp.findFirst({
    where: {
      email: normalizedEmail,
      expiresAt: { gt: now },
      verified: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    return { success: false, error: 'No active verification code found. Please request a new one.' };
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: 'Too many failed attempts. Please request a new code.' };
  }

  // Increment attempts
  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  if (otp.code !== code) {
    const remaining = MAX_ATTEMPTS - otp.attempts - 1;
    return {
      success: false,
      error: remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many failed attempts. Please request a new code.',
    };
  }

  // Mark as verified
  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return { success: true, email: normalizedEmail };
}

/** Verify a magic link token. */
export async function verifyMagicToken(token: string): Promise<VerifyOtpResult> {
  const now = new Date();

  const otp = await prisma.emailOtp.findUnique({
    where: { magicToken: token },
  });

  if (!otp) {
    return { success: false, error: 'Invalid or expired verification link.' };
  }

  if (otp.expiresAt < now) {
    return { success: false, error: 'Verification link has expired. Please request a new one.' };
  }

  if (otp.verified) {
    return { success: true, email: otp.email }; // idempotent
  }

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return { success: true, email: otp.email };
}

/** Get the latest OTP record for an email (used to send the email). */
export async function getLatestOtp(email: string) {
  return prisma.emailOtp.findFirst({
    where: { email: email.toLowerCase().trim() },
    orderBy: { createdAt: 'desc' },
  });
}

/** Check if email has been OTP-verified in the last hour. */
export async function isEmailOtpVerified(email: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const verified = await prisma.emailOtp.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      verified: true,
      createdAt: { gte: oneHourAgo },
    },
  });
  return !!verified;
}
