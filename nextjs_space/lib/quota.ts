import { prisma } from '@/lib/prisma';
import { PLANS, FREE_PREVIEW_CAP, COIN_COST, reelCoinCost, REEL_COIN_COSTS } from '@/lib/pricing';
import { modelTierAccess, getModelTier, MODEL_TIERS, type ModelTierId } from '@/lib/model-tiers';

// ── Constants ────────────────────────────────────────────────────
const ROLLOVER_EXPIRY_DAYS = 60;

// ── Coin balance ─────────────────────────────────────────────────
export interface RolloverInfo {
  coins: number;      // remaining rollover coins
  expiresAt: string;  // ISO date of expiry
}
export interface CoinBalance {
  tier: string;
  status: string;
  motionEnabled: boolean;       // capability gate (Premium only)
  subscriptionCoins: number;    // monthly allotment for this tier
  subscriptionUsed: number;     // consumed this period
  subscriptionRemaining: number;
  rolloverCoins: number;        // non-expired rollover coins remaining
  rolloverInfo: RolloverInfo[]; // individual rollover records for display
  bundleCoins: number;          // non-expired purchased coins remaining
  coinsAvailable: number;       // subscriptionRemaining + rolloverCoins + bundleCoins
}

const TIER_COINS: Record<string, number> = {
  free: 0,
  starter: PLANS.starter.coins,
  pro: PLANS.pro.coins,
  premium: PLANS.premium.coins,
  agency: PLANS.agency.coins,
};

function monthWindow(now = new Date()) {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { periodStart, periodEnd };
}

/** Ensure a usage counter exists for the current month for paid tiers.
 *  When creating a NEW month's counter, automatically roll over unused coins
 *  from the previous month (capped at 1× monthly allotment, 60-day expiry). */
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

    // ── Rollover from previous month ──────────────────────────
    // Find the most-recent PRIOR counter for this user (any tier — handles upgrades).
    const prevCounter = await prisma.usageCounter.findFirst({
      where: { userId, periodEnd: { lt: periodStart } },
      orderBy: { periodStart: 'desc' },
    });
    if (prevCounter) {
      const prevCap = prevCounter.reelsCap;
      const unused = Math.max(0, prevCap - prevCounter.reelsUsed);
      const monthlyAllotment = TIER_COINS[tier] ?? 0;
      const rollAmount = Math.min(unused, monthlyAllotment); // cap at 1× current allotment
      if (rollAmount > 0) {
        const fromMonth = prevCounter.periodStart;
        // Prevent duplicate rollovers for the same source month
        const existing = await prisma.coinRollover.findFirst({ where: { userId, fromMonth } });
        if (!existing) {
          const expiresAt = new Date(now.getTime() + ROLLOVER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
          await prisma.coinRollover.create({
            data: { userId, coins: rollAmount, remaining: rollAmount, fromMonth, expiresAt },
          });
          console.log(`[quota] ROLLOVER ${rollAmount} coins for user=${userId} from ${fromMonth.toISOString()} expires ${expiresAt.toISOString()}`);
        }
      }
    }
  }
  return counter;
}

/** Get non-expired rollover records for a user. */
async function getActiveRollovers(userId: string) {
  const now = new Date();
  return prisma.coinRollover.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' }, // oldest first for FIFO consumption
  });
}

export async function getCoinBalance(userId: string): Promise<CoinBalance> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  const status = sub?.status ?? 'active';
  const motionEnabled = tier !== 'free' && modelTierAccess(tier).length > 0;
  const subscriptionCoins = TIER_COINS[tier] ?? 0;

  const now = new Date();

  // Non-expired purchased coins.
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

  // Active rollover coins
  const rollovers = await getActiveRollovers(userId);
  const rolloverCoins = rollovers.reduce((s, r) => s + r.remaining, 0);
  const rolloverInfo: RolloverInfo[] = rollovers.map(r => ({
    coins: r.remaining, expiresAt: r.expiresAt.toISOString(),
  }));

  let subscriptionUsed = 0;
  if (tier !== 'free' && status === 'active') {
    const counter = await getOrCreateCounter(userId, tier);
    subscriptionUsed = counter.reelsUsed;
  }
  const subscriptionRemaining = Math.max(0, subscriptionCoins - subscriptionUsed);
  const coinsAvailable = subscriptionRemaining + rolloverCoins + bundleCoins;

  return {
    tier, status, motionEnabled,
    subscriptionCoins, subscriptionUsed, subscriptionRemaining,
    rolloverCoins, rolloverInfo,
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
  isFreePreview?: boolean;
}

/**
 * Check whether a user may generate a reel. The cost is now driven by
 * model-tier × reel-duration (see REEL_COIN_COSTS in pricing.ts).
 * `targetDuration` is the requested reel length in seconds (15/20/25/30).
 */
export async function checkGeneration(userId: string, motion: boolean, modelTierId?: string, targetDuration?: number): Promise<GenerationCheck> {
  const balance = await getCoinBalance(userId);

  if (balance.status !== 'active') {
    return { allowed: false, reason: 'inactive', message: 'Your subscription is not active. Please renew to continue.', cost: 0, motion, balance };
  }

  // FREE TIER: watermarked 7s reels built from cached/sample assets ($0 cost).
  if (balance.tier === 'free') {
    if (motion) {
      return { allowed: false, reason: 'motion_locked', message: 'Motion reels are a paid feature. Upgrade to start creating.', cost: 0, motion, balance };
    }
    return { allowed: true, message: 'OK', cost: 0, motion: false, balance, isFreePreview: true };
  }

  // Resolve model tier access for this subscription.
  const access = modelTierAccess(balance.tier);
  const requested = ((modelTierId || 'standard').toLowerCase()) as ModelTierId;

  // If the user explicitly requested a tier they can't access, block.
  if (requested && !access.includes(requested)) {
    const mt = getModelTier(requested);
    return { allowed: false, reason: 'motion_locked', message: `The ${mt.name} tier requires an upgrade. Upgrade your plan to unlock it.`, cost: 0, motion, balance };
  }

  const effId: ModelTierId = (requested && access.includes(requested)) ? requested : (access[0] ?? 'standard');
  const dur = targetDuration ?? 15;
  const tierCost = reelCoinCost(effId, dur);

  // VOLUME GATE: enough coins?
  if (balance.coinsAvailable < tierCost) {
    return {
      allowed: false,
      reason: 'insufficient_coins',
      message: `This reel costs ${tierCost} coins. You have ${balance.coinsAvailable}. Top up with a coin bundle to continue.`,
      cost: tierCost, motion, balance,
    };
  }

  return { allowed: true, message: 'OK', cost: tierCost, motion, balance };
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

  // 2) Rollover coins, oldest first (FIFO, expire soonest)
  if (remaining > 0) {
    const rollovers = await getActiveRollovers(userId);
    for (const r of rollovers) {
      if (remaining <= 0) break;
      const take = Math.min(r.remaining, remaining);
      await prisma.coinRollover.update({ where: { id: r.id }, data: { remaining: { decrement: take } } });
      remaining -= take;
    }
  }

  // 3) Bundle coins, oldest non-expired first (FIFO)
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

/**
 * Refund `amount` coins to a user (e.g. when a paid motion render fails to
 * deliver real motion). Mirrors consumeCoins in reverse:
 *   1) Credit back the subscription monthly counter first (decrement reelsUsed,
 *      never below 0).
 *   2) Return any remainder as a non-expiring bonus coin grant so the coins are
 *      always recoverable even across billing-period boundaries.
 * Idempotency is the CALLER's responsibility (guard with a persisted flag).
 * Returns the number of coins actually credited back.
 */
export async function refundCoins(userId: string, amount: number, reason = 'motion_render_failed'): Promise<number> {
  if (amount <= 0) return 0;
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const tier = sub?.tier ?? 'free';
  if (tier === 'free') return 0; // free previews never consumed coins

  let remaining = amount;

  // 1) Credit the subscription monthly counter back first.
  const counter = await getOrCreateCounter(userId, tier);
  const backToSub = Math.min(counter.reelsUsed, remaining);
  if (backToSub > 0) {
    await prisma.usageCounter.update({ where: { id: counter.id }, data: { reelsUsed: { decrement: backToSub } } });
    remaining -= backToSub;
  }

  // 2) Any remainder → non-expiring bonus grant (auditable, always recoverable).
  if (remaining > 0) {
    await prisma.coinPurchase.create({
      data: {
        userId,
        bundleId: `refund:${reason}`,
        reelsAdded: remaining,
        coinsRemaining: remaining,
        expiresAt: null,
        amountCents: 0,
        status: 'completed',
      },
    });
    remaining = 0;
  }

  console.log(`[quota] REFUND ${amount} coins to user=${userId} reason=${reason} (sub=${backToSub}, bonus=${amount - backToSub})`);
  return amount;
}

// ── Legacy compatibility shim ────────────────────────────────────
// Older UI (dashboard shell, subscription route) reads reelsUsed / reelsCap /
// bonusReels. We map the coin balance onto those fields so existing UI keeps
// working while displaying coins.
export interface QuotaCheckResult {
  allowed: boolean;
  message: string;
  reelsUsed: number;     // = subscription coins used this period
  reelsCap: number;      // = subscriptionCoins + rolloverCoins + bundleCoins
  bonusReels: number;    // = bundle coins remaining
  tier: string;
  // richer coin fields
  coinsAvailable: number;
  subscriptionCoins: number;
  subscriptionRemaining: number;
  rolloverCoins: number;
  rolloverInfo: RolloverInfo[];
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
    // Free tier can always start a reel from the UI; the generate route applies
    // the daily/IP rate limits and budget pool at request time.
    allowed = true;
    message = 'OK';
  } else {
    allowed = b.coinsAvailable >= COIN_COST.static;
    message = allowed ? 'OK' : 'You\u2019re out of coins. Buy a coin bundle or wait for your monthly reset.';
  }
  return {
    allowed, message, tier: b.tier, status: b.status,
    reelsUsed: b.subscriptionUsed,
    reelsCap: b.subscriptionCoins + b.rolloverCoins + b.bundleCoins,
    bonusReels: b.bundleCoins,
    coinsAvailable: b.coinsAvailable,
    subscriptionCoins: b.subscriptionCoins,
    subscriptionRemaining: b.subscriptionRemaining,
    rolloverCoins: b.rolloverCoins,
    rolloverInfo: b.rolloverInfo,
    bundleCoins: b.bundleCoins,
    motionEnabled: b.motionEnabled,
  };
}

// Deprecated: kept so existing imports don't break. Use consumeCoins instead.
export async function incrementUsage(userId: string): Promise<void> {
  await consumeCoins(userId, COIN_COST.static);
}