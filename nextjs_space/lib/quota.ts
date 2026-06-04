import { prisma } from '@/lib/prisma';
import { PLANS, FREE_TRIAL_CAP } from '@/lib/pricing';

export interface QuotaCheckResult {
  allowed: boolean;
  message: string;
  reelsUsed: number;
  reelsCap: number;
  bonusReels: number; // from coin purchases
  tier: string;
}

const TIER_CAPS: Record<string, number> = {
  free: FREE_TRIAL_CAP,
  pro: PLANS.pro.reelsCap,
  premium: PLANS.premium.reelsCap,
};

export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  const status = sub?.status ?? 'active';

  // Count bonus reels from completed coin purchases
  const bonusAgg = await prisma.coinPurchase.aggregate({
    where: { userId, status: 'completed' },
    _sum: { reelsAdded: true },
  });
  const bonusReels = bonusAgg._sum.reelsAdded ?? 0;

  if (status !== 'active') {
    return { allowed: false, message: 'Your subscription is not active. Please renew to continue.', reelsUsed: 0, reelsCap: 0, bonusReels, tier };
  }

  const cap = TIER_CAPS[tier] ?? FREE_TRIAL_CAP;

  if (tier === 'free') {
    // Free/trial: 1 reel LIFETIME + any purchased bonus
    const totalReels = await prisma.reel.count({ where: { userId, status: { not: 'failed' } } });
    const totalCap = cap + bonusReels;
    return {
      allowed: totalReels < totalCap,
      message: totalReels >= totalCap ? 'You have used all your credits. Upgrade to Pro for 30 reels/month.' : 'OK',
      reelsUsed: totalReels,
      reelsCap: totalCap,
      bonusReels,
      tier,
    };
  }

  // Pro/Premium: monthly cap + bonus
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

  const totalCap = cap + bonusReels;

  return {
    allowed: counter.reelsUsed < totalCap,
    message: counter.reelsUsed >= totalCap
      ? `You've used all ${totalCap} reels this month. ${tier === 'pro' ? 'Upgrade to Premium for 60/month or buy extra coins.' : 'Buy extra coins to keep creating.'}`
      : 'OK',
    reelsUsed: counter.reelsUsed,
    reelsCap: totalCap,
    bonusReels,
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
