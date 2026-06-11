export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { checkTrialGates, hashDeviceFp, hashIpAddress } from '@/lib/trial-gates';
import { headers } from 'next/headers';

/**
 * POST /api/trial/check-gates
 * Body: { email: string, deviceFingerprint?: string, recaptchaToken?: string }
 *
 * Pre-checks all trial gates (including 5D reCAPTCHA + IP scoring)
 * before directing user to Stripe checkout.
 */
export async function POST(request: Request) {
  try {
    const { email, deviceFingerprint, recaptchaToken } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const deviceFpHash = deviceFingerprint ? hashDeviceFp(deviceFingerprint) : null;

    // Extract real IP from headers
    const headersList = headers();
    const rawIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      null;
    const ipAddressHash = rawIp ? hashIpAddress(rawIp) : null;

    const result = await checkTrialGates({
      email,
      deviceFpHash,
      ipAddressHash,
      rawIp,
      recaptchaToken: recaptchaToken || null,
      // Card fingerprint checked at Stripe checkout time, not here
    });

    // Return gate result (gateLog excluded from client response for security)
    return NextResponse.json({
      allowed: result.allowed,
      blockedBy: result.blockedBy,
      message: result.message,
      recaptchaDecision: result.recaptchaDecision,
      // Pass ipCountry only if allowed (for analytics display)
      ipCountry: result.allowed ? result.ipCountry : undefined,
    });
  } catch (err) {
    console.error('[check-gates] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
