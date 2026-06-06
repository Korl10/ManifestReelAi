// ── Free-tier volume guards: per-IP rate limit + daily budget (server) ──
import { prisma } from '@/lib/prisma';
import {
  FREE_REELS_PER_IP_PER_HOUR,
  FREE_DAILY_BUDGET_CENTS,
  FREE_REEL_EST_COST_CENTS,
  utcDayKey,
} from '@/lib/free-tier';

export type FreeBlockReason = 'ip_quota' | 'budget_exhausted';

export interface FreeLimitCheck {
  allowed: boolean;
  reason?: FreeBlockReason;
  message: string;
  /** Hours until the relevant window frees up (for the "back in X hours" modal). */
  retryAfterHours?: number;
}

/**
 * Enforce volume guards for the free tier's single lifetime reel:
 * (1) per-IP 1 reel / 60m (anti signup-spam), (2) global daily budget ceiling.
 * The once-per-account lifetime gate (User.freeReelUsed) is enforced in the
 * generate route. Counts only successful/in-flight reels (status != 'failed').
 */
export async function checkFreeTierLimits(userId: string, clientIp?: string | null): Promise<FreeLimitCheck> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // (1) Per-IP hourly quota (anti-abuse). Skipped if we can't resolve an IP.
  if (clientIp) {
    const ipCount = await prisma.reel.count({
      where: { clientIp, status: { not: 'failed' }, createdAt: { gte: hourAgo } },
    });
    if (ipCount >= FREE_REELS_PER_IP_PER_HOUR) {
      return {
        allowed: false, reason: 'ip_quota', retryAfterHours: 1,
        message: 'Too many free reels from this network right now. Please try again in about an hour, or upgrade for unlimited creating.',
      };
    }
  }

  // (2) Global daily budget ceiling (protects against signup waves).
  const day = utcDayKey(now);
  const stat = await prisma.dailyFreeStat.findUnique({ where: { day } });
  const spent = stat?.spendCents ?? 0;
  if (spent + FREE_REEL_EST_COST_CENTS > FREE_DAILY_BUDGET_CENTS) {
    // Hours until UTC midnight (budget reset).
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const retryAfterHours = Math.max(1, Math.ceil((reset.getTime() - now.getTime()) / 3.6e6));
    return {
      allowed: false, reason: 'budget_exhausted', retryAfterHours,
      message: `Free reels have hit today’s maximum. They’ll be back in about ${retryAfterHours} hour${retryAfterHours === 1 ? '' : 's'} — or upgrade for unlimited creating now.`,
    };
  }

  return { allowed: true, message: 'OK' };
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
