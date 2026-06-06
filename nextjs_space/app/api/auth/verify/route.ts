export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/verify?token=...
 * Confirms a user's email. Redirects to /verify with a status flag so the
 * landing page can show a friendly result. Idempotent: an already-verified
 * token (cleared after use) resolves to a friendly "already verified" state.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const base = (process.env.NEXTAUTH_URL || url.origin).replace(/\/$/, '');
  const to = (status: string) => NextResponse.redirect(`${base}/verify?status=${status}`);

  if (!token) return to('invalid');

  try {
    const user = await prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) {
      // No matching token: either already used/verified, or bogus.
      return to('invalid');
    }
    if (user.verifyTokenExpiry && user.verifyTokenExpiry.getTime() < Date.now()) {
      return to('expired');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), verifyToken: null, verifyTokenExpiry: null },
    });
    return to('success');
  } catch (e) {
    console.error('[verify] error:', (e as any)?.message);
    return to('error');
  }
}
