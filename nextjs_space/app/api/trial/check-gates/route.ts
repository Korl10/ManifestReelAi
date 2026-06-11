export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { checkTrialGates, hashDeviceFp } from '@/lib/trial-gates';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * POST /api/trial/check-gates
 * Body: { email: string, deviceFingerprint?: string }
 *
 * Pre-checks all trial gates before directing user to Stripe checkout.
 * Can be called from the trial signup flow UI.
 */
export async function POST(request: Request) {
  try {
    const { email, deviceFingerprint } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const deviceFpHash = deviceFingerprint ? hashDeviceFp(deviceFingerprint) : null;

    const result = await checkTrialGates({
      email,
      deviceFpHash,
      // Card fingerprint checked at Stripe checkout time, not here
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[check-gates] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
