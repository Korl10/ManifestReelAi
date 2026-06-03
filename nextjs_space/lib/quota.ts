import { prisma } from '@/lib/prisma';

export interface QuotaCheckResult {
  allowed: boolean;
  message: string;
  reelsUsed: number;
  reelsCap: number;
  tier: string;
}

const TIER_CAPS: Record<string, number> = {
  free: 1,
  pro: 30,
  premium: 60,
};

export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  const status = sub?.status ?? 'active';

  if (status !== 'active') {
    return { allowed: false, message: 'Your subscription is not active. Please renew to continue.', reelsUsed: 0, reelsCap: 0, tier };
  }

  const cap = TIER_CAPS[tier] ?? 1;

  if (tier === 'free') {
    // Free tier: 1 reel LIFETIME
    const totalReels = await prisma.reel.count({ where: { userId, status: { not: 'failed' } } });
    return {
      allowed: totalReels < 1,
      message: totalReels >= 1 ? 'Free tier allows 1 reel total. Upgrade to Pro for 30 reels/month.' : 'OK',
      reelsUsed: totalReels,
      reelsCap: 1,
      tier,
    };
  }

  // Pro/Premium: monthly cap
  const now = new Date();
  let counter = await prisma.usageCounter.findFirst({
    where: { userId, tier, periodStart: { lte: now }, periodEnd: { gte: now } },
    orderBy: { periodStart: 'desc' },
  });

  if (!counter) {
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    counter = await prisma.usageCounter.create({
      data: { userId, tier, reelsCap: cap, reelsUsed: 0, periodStart, periodEnd },
    });
  }

  return {
    allowed: counter.reelsUsed < cap,
    message: counter.reelsUsed >= cap ? `You've used all ${cap} reels this month. ${tier === 'pro' ? 'Upgrade to Premium for 60/month.' : 'Wait for next billing cycle.'}` : 'OK',
    reelsUsed: counter.reelsUsed,
    reelsCap: cap,
    tier,
  };
}

export async function incrementUsage(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';

  if (tier === 'free') return; // Free tier tracked by reel count

  const now = new Date();
  const counter = await prisma.usageCounter.findFirst({
    where: { userId, tier, periodStart: { lte: now }, periodEnd: { gte: now } },
    orderBy: { periodStart: 'desc' },
  });

  if (counter) {
    await prisma.usageCounter.update({ where: { id: counter.id }, data: { reelsUsed: { increment: 1 } } });
  }
}
