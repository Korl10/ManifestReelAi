export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { hashDeviceFp } from '@/lib/trial-gates';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/trial/device-fp
 * Body: { fingerprint: string }
 *
 * Stores the hashed device fingerprint for the current user (for trial lock).
 * Called client-side after FingerprintJS init.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fingerprint } = await request.json();
    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'Fingerprint is required' }, { status: 400 });
    }

    const fpHash = hashDeviceFp(fingerprint);

    // Check if this device fp is already in a trial lock
    const existingLock = await prisma.trialLock.findUnique({
      where: { deviceFpHash: fpHash },
    });

    return NextResponse.json({
      success: true,
      fpHash,
      alreadyTrialed: !!existingLock && !existingLock.supportOverride,
    });
  } catch (err) {
    console.error('[device-fp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
