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

  if (!tier || !['pro', 'premium'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  // Mock Stripe checkout
  if (!process.env.STRIPE_SECRET_KEY) {
    // Update subscription directly in mock mode
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, tier, status: 'active' },
      update: { tier, status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const cap = tier === 'premium' ? 60 : 30;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Find existing counter for this period, or create new one
    const existing = await prisma.usageCounter.findFirst({
      where: { userId, tier, periodStart: { lte: now }, periodEnd: { gte: now } },
    });

    if (existing) {
      await prisma.usageCounter.update({
        where: { id: existing.id },
        data: { reelsCap: cap },
      });
    } else {
      await prisma.usageCounter.create({
        data: { userId, tier, reelsCap: cap, reelsUsed: 0, periodStart, periodEnd },
      });
    }

    return NextResponse.json({ url: `/dashboard?upgraded=${tier}`, mock: true });
  }

  return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
}
