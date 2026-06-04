import { prisma } from '@/lib/prisma';
import { PLANS, FREE_PREVIEW_CAP, COIN_COST } from '@/lib/pricing';

// ── Coin balance ─────────────────────────────────────────────────
export interface CoinBalance {
  tier: string;
  status: string;
  motionEnabled: boolean;       // capability gate (Premium only)
  subscriptionCoins: number;    // monthly allotment for this tier
  subscriptionUsed: number;     // consumed this period
  subscriptionRemaining: number;
  bundleCoins: number;          // non-expired purchased coins remaining
  coinsAvailable: number;       // subscriptionRemaining + bundleCoins
}

const TIER_COINS: Record<string, number> = {
  free: 0,
  pro: PLANS.pro.coins,
  premium: PLANS.premium.coins,
};

function monthWindow(now = new Date()) {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { periodStart, periodEnd };
}

/** Ensure a usage counter exists for the current month for paid tiers. */
async function getOrCreateCounter(userId: string, tier: string) {
  const now = new Date();
  let counter = await prisma.usageCounter.findFirst({
    where: { userId, tier, periodStart: { lte: now }, periodEnd: { gte: now } },
    orderBy: { periodStart: 'desc' },
  });
  if (!counter) {
    const { periodStart, periodEnd } = monthWindow(now);
    counter = await prisma.usageCounter.create({
      data: { userId, tier, reelsCap: TIER_COINS[tier] ?? 0, reelsUsed: 0, periodStart, periodEnd },
    });
  }
  return counter;
}

export async function getCoinBalance(userId: string): Promise<CoinBalance> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  const status = sub?.status ?? 'active';
  const motionEnabled = (PLANS as any)[tier]?.motion === true;
  const subscriptionCoins = TIER_COINS[tier] ?? 0;

  // Non-expired purchased coins.
  const now = new Date();
  const bundleAgg = await prisma.coinPurchase.aggregate({
    where: {
      userId,
      status: 'completed',
      coinsRemaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { coinsRemaining: true },
  });
  const bundleCoins = bundleAgg._sum.coinsRemaining ?? 0;

  let subscriptionUsed = 0;
  if (tier !== 'free' && status === 'active') {
    const counter = await getOrCreateCounter(userId, tier);
    subscriptionUsed = counter.reelsUsed;
  }
  const subscriptionRemaining = Math.max(0, subscriptionCoins - subscriptionUsed);
  const coinsAvailable = subscriptionRemaining + bundleCoins;

  return {
    tier, status, motionEnabled,
    subscriptionCoins, subscriptionUsed, subscriptionRemaining,
    bundleCoins, coinsAvailable,
  };
}

// ── Generation gate (server-side, before any paid API call) ──────
export interface GenerationCheck {
  allowed: boolean;
  message: string;
  reason?: 'free_tier' | 'inactive' | 'motion_locked' | 'insufficient_coins';
  cost: number;            // coins this generation will consume
  motion: boolean;
  balance: CoinBalance;
  isFreePreview?: boolean; // free users get a single watermarked preview
}

export async function checkGeneration(userId: string, motion: boolean): Promise<GenerationCheck> {
  const balance = await getCoinBalance(userId);
  const cost = motion ? COIN_COST.motion : COIN_COST.static;

  if (balance.status !== 'active') {
    return { allowed: false, reason: 'inactive', message: 'Your subscription is not active. Please renew to continue.', cost, motion, balance };
  }

  // FREE TIER: no live paid generation. One watermarked preview from cached/sample assets.
  if (balance.tier === 'free') {
    if (motion) {
      return { allowed: false, reason: 'motion_locked', message: 'Cinematic motion is a Premium feature. Upgrade to Premium to unlock it.', cost, motion, balance };
    }
    const usedPreviews = await prisma.reel.count({ where: { userId, status: { not: 'failed' } } });
    if (usedPreviews >= FREE_PREVIEW_CAP) {
      return { allowed: false, reason: 'free_tier', message: 'You\u2019ve used your free preview. Upgrade to Pro or Premium to generate real reels.', cost: 0, motion, balance, isFreePreview: true };
    }
    return { allowed: true, message: 'OK', cost: 0, motion: false, balance, isFreePreview: true };
  }

  // FEATURE GATE: motion is Premium-only, even if a Pro user has coins.
  if (motion && !balance.motionEnabled) {
    return { allowed: false, reason: 'motion_locked', message: 'Cinematic motion is available on Premium only. Upgrade to unlock motion reels.', cost, motion, balance };
  }

  // VOLUME GATE: enough coins?
  if (balance.coinsAvailable < cost) {
    return {
      allowed: false,
      reason: 'insufficient_coins',
      message: motion
        ? `Motion reels cost ${cost} coins. You have ${balance.coinsAvailable}. Top up with a coin bundle to continue.`
        : `You\u2019re out of coins. Buy a coin bundle or wait for your monthly reset.`,
      cost, motion, balance,
    };
  }

  return { allowed: true, message: 'OK', cost, motion, balance };
}

/**
 * Consume `amount` coins: subscription monthly coins first, then bundle
 * coins (oldest non-expired first). Returns the actual coins consumed.
 */
export async function consumeCoins(userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  if (tier === 'free') return 0; // free previews don't consume coins

  let remaining = amount;

  // 1) Subscription monthly coins
  const counter = await getOrCreateCounter(userId, tier);
  const subCap = TIER_COINS[tier] ?? 0;
  const subAvail = Math.max(0, subCap - counter.reelsUsed);
  const fromSub = Math.min(subAvail, remaining);
  if (fromSub > 0) {
    await prisma.usageCounter.update({ where: { id: counter.id }, data: { reelsUsed: { increment: fromSub } } });
    remaining -= fromSub;
  }

  // 2) Bundle coins, oldest non-expired first (FIFO)
  if (remaining > 0) {
    const now = new Date();
    const purchases = await prisma.coinPurchase.findMany({
      where: {
        userId, status: 'completed', coinsRemaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const p of purchases) {
      if (remaining <= 0) break;
      const take = Math.min(p.coinsRemaining, remaining);
      await prisma.coinPurchase.update({ where: { id: p.id }, data: { coinsRemaining: { decrement: take } } });
      remaining -= take;
    }
  }

  return amount - remaining;
}

// ── Legacy compatibility shim ────────────────────────────────────
// Older UI (dashboard shell, subscription route) reads reelsUsed / reelsCap /
// bonusReels. We map the coin balance onto those fields so existing UI keeps
// working while displaying coins.
export interface QuotaCheckResult {
  allowed: boolean;
  message: string;
  reelsUsed: number;     // = subscription coins used this period
  reelsCap: number;      // = subscriptionCoins + bundleCoins (so cap-used == coinsAvailable)
  bonusReels: number;    // = bundle coins remaining
  tier: string;
  // richer coin fields
  coinsAvailable: number;
  subscriptionCoins: number;
  subscriptionRemaining: number;
  bundleCoins: number;
  motionEnabled: boolean;
  status: string;
}

export async function checkQuota(userId: string): Promise<QuotaCheckResult> {
  const b = await getCoinBalance(userId);
  let allowed: boolean;
  let message = 'OK';
  if (b.status !== 'active') {
    allowed = false;
    message = 'Your subscription is not active. Please renew to continue.';
  } else if (b.tier === 'free') {
    const usedPreviews = await prisma.reel.count({ where: { userId, status: { not: 'failed' } } });
    allowed = usedPreviews < FREE_PREVIEW_CAP;
    message = allowed ? 'OK' : 'Upgrade to Pro or Premium to generate real reels.';
  } else {
    allowed = b.coinsAvailable >= COIN_COST.static;
    message = allowed ? 'OK' : 'You\u2019re out of coins. Buy a coin bundle or wait for your monthly reset.';
  }
  return {
    allowed, message, tier: b.tier, status: b.status,
    reelsUsed: b.subscriptionUsed,
    reelsCap: b.subscriptionCoins + b.bundleCoins,
    bonusReels: b.bundleCoins,
    coinsAvailable: b.coinsAvailable,
    subscriptionCoins: b.subscriptionCoins,
    subscriptionRemaining: b.subscriptionRemaining,
    bundleCoins: b.bundleCoins,
    motionEnabled: b.motionEnabled,
  };
}

// Deprecated: kept so existing imports don't break. Use consumeCoins instead.
export async function incrementUsage(userId: string): Promise<void> {
  await consumeCoins(userId, COIN_COST.static);
}
