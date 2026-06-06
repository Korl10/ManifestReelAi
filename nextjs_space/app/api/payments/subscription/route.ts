export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkQuota } from '@/lib/quota';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const quota = await checkQuota(userId);
  // Surface free-tier lifetime + verification state so the dashboard can show
  // the right funnel (free reel used → locked controls + upgrade banner).
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { freeReelUsed: true, emailVerified: true } });
  return NextResponse.json({
    subscription: sub,
    quota: { ...quota, freeReelUsed: !!u?.freeReelUsed, emailVerified: !!u?.emailVerified },
  });
}
