// ── Free-tier rate limiting + daily budget (server-side) ────────────────
import { prisma } from '@/lib/prisma';
import {
  FREE_REELS_PER_DAY,
  FREE_REELS_PER_IP_PER_HOUR,
  FREE_DAILY_BUDGET_CENTS,
  FREE_REEL_EST_COST_CENTS,
  utcDayKey,
} from '@/lib/free-tier';

export type FreeBlockReason = 'daily_quota' | 'ip_quota' | 'budget_exhausted';

export interface FreeLimitCheck {
  allowed: boolean;
  reason?: FreeBlockReason;
  message: string;
  /** Hours until the relevant window frees up (for the “back in X hours” modal). */
  retryAfterHours?: number;
  usedToday: number;
  remainingToday: number;
}

/**
 * Enforce: (1) per-account 3 reels / 24h, (2) per-IP 1 reel / 60m,
 * (3) global free-tier daily budget ceiling. Counts only successful/in-flight
 * reels (status != 'failed') so failed attempts don't burn quota.
 */
export async function checkFreeTierLimits(userId: string, clientIp?: string | null): Promise<FreeLimitCheck> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // (1) Per-account daily quota (rolling 24h).
  const usedToday = await prisma.reel.count({
    where: { userId, status: { not: 'failed' }, createdAt: { gte: dayAgo } },
  });
  const remainingToday = Math.max(0, FREE_REELS_PER_DAY - usedToday);
  if (usedToday >= FREE_REELS_PER_DAY) {
    // Hours until the oldest reel in the window ages out.
    const oldest = await prisma.reel.findFirst({
      where: { userId, status: { not: 'failed' }, createdAt: { gte: dayAgo } },
      orderBy: { createdAt: 'asc' }, select: { createdAt: true },
    });
    const freesAt = oldest ? new Date(oldest.createdAt.getTime() + 24 * 60 * 60 * 1000) : now;
    const retryAfterHours = Math.max(1, Math.ceil((freesAt.getTime() - now.getTime()) / 3.6e6));
    return {
      allowed: false, reason: 'daily_quota', usedToday, remainingToday: 0, retryAfterHours,
      message: 'You’ve used your 3 free reels for today. Upgrade to keep creating — or come back tomorrow.',
    };
  }

  // (2) Per-IP hourly quota (anti-abuse). Skipped if we can't resolve an IP.
  if (clientIp) {
    const ipCount = await prisma.reel.count({
      where: { clientIp, status: { not: 'failed' }, createdAt: { gte: hourAgo } },
    });
    if (ipCount >= FREE_REELS_PER_IP_PER_HOUR) {
      return {
        allowed: false, reason: 'ip_quota', usedToday, remainingToday, retryAfterHours: 1,
        message: 'Too many free reels from this network right now. Please try again in about an hour, or upgrade for unlimited creating.',
      };
    }
  }

  // (3) Global daily budget ceiling.
  const day = utcDayKey(now);
  const stat = await prisma.dailyFreeStat.findUnique({ where: { day } });
  const spent = stat?.spendCents ?? 0;
  if (spent + FREE_REEL_EST_COST_CENTS > FREE_DAILY_BUDGET_CENTS) {
    // Hours until UTC midnight (budget reset).
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const retryAfterHours = Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 3.6e6));
    return {
      allowed: false, reason: 'budget_exhausted', usedToday, remainingToday, retryAfterHours,
      message: `Free reels have hit today’s maximum. They’ll be back in about ${retryAfterHours} hour${retryAfterHours === 1 ? '' : 's'} — or upgrade for unlimited creating now.`,
    };
  }

  return { allowed: true, usedToday, remainingToday, message: 'OK' };
}

/** Atomically record free-tier spend for today's budget pool. */
export async function recordFreeTierSpend(cents: number): Promise<void> {
  const day = utcDayKey();
  const amount = Math.max(0, Math.round(cents));
  try {
    await prisma.dailyFreeStat.upsert({
      where: { day },
      create: { day, spendCents: amount, reelCount: 1 },
      update: { spendCents: { increment: amount }, reelCount: { increment: 1 } },
    });
  } catch (e) {
    console.warn('[free-tier] recordFreeTierSpend failed:', (e as any)?.message);
  }
}

export interface FreeBudgetToday {
  day: string;
  spendCents: number;
  reelCount: number;
  ceilingCents: number;
  remainingCents: number;
  pctUsed: number;
}

/** Today's free-tier budget snapshot for the admin dashboard. */
export async function getFreeBudgetToday(): Promise<FreeBudgetToday> {
  const day = utcDayKey();
  const stat = await prisma.dailyFreeStat.findUnique({ where: { day } });
  const spendCents = stat?.spendCents ?? 0;
  const reelCount = stat?.reelCount ?? 0;
  return {
    day, spendCents, reelCount,
    ceilingCents: FREE_DAILY_BUDGET_CENTS,
    remainingCents: Math.max(0, FREE_DAILY_BUDGET_CENTS - spendCents),
    pctUsed: Math.min(100, Math.round((spendCents / FREE_DAILY_BUDGET_CENTS) * 100)),
  };
}
