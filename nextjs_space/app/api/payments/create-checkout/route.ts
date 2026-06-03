export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { tier } = body ?? {};

  // Mock Stripe checkout
  if (!process.env.STRIPE_SECRET_KEY) {
    // Update subscription directly in mock mode
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, tier: tier ?? 'pro', status: 'active' },
      update: { tier: tier ?? 'pro', status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const cap = tier === 'premium' ? 60 : 30;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    await prisma.usageCounter.upsert({
      where: { id: `${userId}-${tier}-${periodStart.toISOString()}` },
      create: { userId, tier, reelsCap: cap, reelsUsed: 0, periodStart, periodEnd },
      update: { reelsCap: cap },
    }).catch(() => {
      // If upsert fails (no unique match), just create
      prisma.usageCounter.create({ data: { userId, tier, reelsCap: cap, reelsUsed: 0, periodStart, periodEnd } }).catch(() => {});
    });

    return NextResponse.json({ url: `/dashboard?upgraded=${tier}`, mock: true });
  }

  return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
}
