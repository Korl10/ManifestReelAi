export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyMagicToken } from '@/lib/otp';

/**
 * GET /api/trial/verify-magic?token=xxx
 * Magic link handler: verifies the token and redirects to trial flow.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/signup?error=invalid_link', request.url));
    }

    const result = await verifyMagicToken(token);
    if (!result.success) {
      const errorParam = encodeURIComponent(result.error || 'Invalid link');
      return NextResponse.redirect(new URL(`/signup?error=${errorParam}`, request.url));
    }

    // Redirect to trial flow with verified email
    const emailParam = encodeURIComponent(result.email || '');
    return NextResponse.redirect(
      new URL(`/dev/pricing-v2/trial?email=${emailParam}&verified=true`, request.url)
    );
  } catch (err) {
    console.error('[verify-magic] Error:', err);
    return NextResponse.redirect(new URL('/signup?error=server_error', request.url));
  }
}
