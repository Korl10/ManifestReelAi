export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { issueVerificationToken, sendVerificationEmail } from '@/lib/email-verify';

/**
 * POST /api/auth/resend-verification
 * Re-issues a verification token and re-sends the email for the logged-in user.
 * No-op (200) if already verified so the UI can call it safely.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const token = await issueVerificationToken(user.id);
    const sent = await sendVerificationEmail(user.email, user.name, token);
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error('[resend-verification] error:', (e as any)?.message);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}
