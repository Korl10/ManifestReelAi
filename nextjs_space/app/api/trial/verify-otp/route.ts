export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyOtpCode } from '@/lib/otp';

/**
 * POST /api/trial/verify-otp
 * Body: { email: string, code: string }
 */
export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const result = await verifyOtpCode(email, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error, code: 'INVALID_CODE' }, { status: 400 });
    }

    return NextResponse.json({ success: true, email: result.email });
  } catch (err) {
    console.error('[verify-otp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
