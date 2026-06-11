export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PLANS_V2 } from '@/lib/pricing-v2';

// ── In-memory cache (5 min TTL) ────────────────────────────────────
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function getCachedOrNull(rangeKey: string) {
  if (cache && cache.data?._rangeKey === rangeKey && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }
  return null;
}

// ── Tier → monthly MRR cents mapping ───────────────────────────────
const TIER_MRR_CENTS: Record<string, number> = {};
for (const [key, plan] of Object.entries(PLANS_V2)) {
  TIER_MRR_CENTS[key] = plan.monthlyCents;
}

function mrrCentsForTier(tier: string): number {
  return TIER_MRR_CENTS[tier] || 0;
}

// ── Helper: date N days ago ────────────────────────────────────────
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const planFilter = url.searchParams.get('plan') || 'all';
    const rangeKey = `${days}-${planFilter}`;

    // Check cache
    const cached = getCachedOrNull(rangeKey);
    if (cached) return NextResponse.json(cached);

    const now = new Date();
    const periodStart = daysAgo(days);
    const priorPeriodStart = daysAgo(days * 2);

    // Plan filter condition
    const tierCond = planFilter !== 'all' ? { tier: planFilter } : {};

    // ── Parallel queries ────────────────────────────────────────
    const [
      // Trial signups (current + prior)
      trialSignupsCurrent,
      trialSignupsPrior,
      // Trial → Paid conversions
      trialConvertedCurrent,
      trialConvertedPrior,
      // Trial → Abandoned
      trialAbandonedCurrent,
      // Active paid subs
      activePaidSubs,
      // All subs for MRR calc
      allActiveSubs,
      // Churned subs (cancelAtPeriodEnd in period)
      activeAtPeriodStart,
      cancelledInPeriod,
      // Daily trial signups (line chart)
      dailyTrials,
      // Trial locks with gate results (blocked reasons)
      blockedTrials7d,
      // Recent conversions
      recentConversions,
      // Recent churns
      recentChurns,
      // Credit ledger top-ups
      recentTopups,
      // Total users
      totalUsers,
      // Plan mix
      planMix,
      // Prior period active paid for churn calc
      priorActivePaid,
    ] = await Promise.all([
      // Trial signups current period
      prisma.trialLock.count({
        where: { createdAt: { gte: periodStart } },
      }),
      // Trial signups prior period
      prisma.trialLock.count({
        where: { createdAt: { gte: priorPeriodStart, lt: periodStart } },
      }),
      // Trial → Paid current
      prisma.trialLock.count({
        where: {
          trialOutcome: 'CONVERTED',
          createdAt: { gte: periodStart },
        },
      }),
      // Trial → Paid prior
      prisma.trialLock.count({
        where: {
          trialOutcome: 'CONVERTED',
          createdAt: { gte: priorPeriodStart, lt: periodStart },
        },
      }),
      // Trial → Abandoned current
      prisma.trialLock.count({
        where: {
          trialOutcome: { in: ['CANCELLED', 'EXPIRED'] },
          createdAt: { gte: periodStart },
        },
      }),
      // Active paid subs count
      prisma.subscription.count({
        where: { status: 'active', tier: { not: 'free' }, ...tierCond },
      }),
      // All active subs for MRR
      prisma.subscription.findMany({
        where: { status: 'active', tier: { not: 'free' }, ...tierCond },
        select: { tier: true, createdAt: true, userId: true },
      }),
      // Active paid subs at start of period
      prisma.subscription.count({
        where: {
          status: 'active',
          tier: { not: 'free' },
          createdAt: { lt: periodStart },
          ...tierCond,
        },
      }),
      // Cancelled in period
      prisma.subscription.count({
        where: {
          cancelAtPeriodEnd: true,
          updatedAt: { gte: periodStart },
          ...tierCond,
        },
      }),
      // Daily trial signups
      prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
        `SELECT DATE(created_at) as day, COUNT(*)::bigint as count
         FROM trial_locks
         WHERE created_at >= $1
         GROUP BY DATE(created_at)
         ORDER BY day`,
        periodStart,
      ),
      // Blocked trial reasons (7d)
      prisma.trialLock.findMany({
        where: {
          createdAt: { gte: daysAgo(7) },
          NOT: { gateResults: { equals: null as any } },
        },
        select: { gateResults: true },
        take: 500,
      }),
      // Recent conversions (last 20)
      prisma.trialLock.findMany({
        where: { trialOutcome: 'CONVERTED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { email: true, createdAt: true, subscriptionId: true },
      }),
      // Recent churns (last 20)
      prisma.subscription.findMany({
        where: {
          cancelAtPeriodEnd: true,
          ...tierCond,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          tier: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { email: true } },
        },
      }),
      // Recent top-ups (credit ledger type=TOPUP)
      prisma.creditLedger.findMany({
        where: { type: 'TOPUP' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          userId: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      }),
      // Total users
      prisma.user.count(),
      // Plan mix
      prisma.subscription.groupBy({
        by: ['tier'],
        where: { status: 'active', tier: { not: 'free' }, ...tierCond },
        _count: true,
      }),
      // Prior active paid for churn denominator
      prisma.subscription.count({
        where: {
          status: 'active',
          tier: { not: 'free' },
          createdAt: { lt: priorPeriodStart },
          ...tierCond,
        },
      }),
    ]);

    // ── KPI Calculations ────────────────────────────────────────

    // MRR
    const mrrCents = allActiveSubs.reduce((sum, s) => sum + mrrCentsForTier(s.tier), 0);
    const mrr = mrrCents / 100;
    const arr = mrr * 12;

    // ARPU
    const arpu = activePaidSubs > 0 ? mrr / activePaidSubs : 0;

    // Conversion rate
    const conversionRate = trialSignupsCurrent > 0
      ? (trialConvertedCurrent / trialSignupsCurrent) * 100
      : 0;
    const priorConversionRate = trialSignupsPrior > 0
      ? (trialConvertedPrior / trialSignupsPrior) * 100
      : 0;

    // Abandon rate
    const abandonRate = trialSignupsCurrent > 0
      ? (trialAbandonedCurrent / trialSignupsCurrent) * 100
      : 0;

    // Churn rate
    const churnDenominator = activeAtPeriodStart || activePaidSubs || 1;
    const churnRate = (cancelledInPeriod / churnDenominator) * 100;

    // LTV (simple: ARPU / monthly churn rate)
    const monthlyChurnRate = churnRate / 100;
    const ltv = monthlyChurnRate > 0 ? arpu / monthlyChurnRate : arpu * 24; // cap at 24mo if 0 churn

    // Net New MRR: new subs in period MRR - churned MRR
    const newSubsInPeriod = allActiveSubs.filter(
      (s) => new Date(s.createdAt) >= periodStart,
    );
    const newMrrCents = newSubsInPeriod.reduce((sum, s) => sum + mrrCentsForTier(s.tier), 0);
    // Approximate churned MRR from cancelled count × avg MRR
    const avgMrrPerSub = activePaidSubs > 0 ? mrrCents / activePaidSubs : 0;
    const churnedMrrCents = cancelledInPeriod * avgMrrPerSub;
    const netNewMrr = (newMrrCents - churnedMrrCents) / 100;

    // % changes
    const pctChange = (curr: number, prior: number) => {
      if (prior === 0) return curr > 0 ? 100 : 0;
      return ((curr - prior) / prior) * 100;
    };

    const kpis = {
      trialSignups: { value: trialSignupsCurrent, change: pctChange(trialSignupsCurrent, trialSignupsPrior) },
      conversionRate: { value: Math.round(conversionRate * 10) / 10, change: Math.round((conversionRate - priorConversionRate) * 10) / 10 },
      abandonRate: { value: Math.round(abandonRate * 10) / 10 },
      mrr: { value: Math.round(mrr * 100) / 100 },
      arr: { value: Math.round(arr * 100) / 100 },
      arpu: { value: Math.round(arpu * 100) / 100 },
      churnRate: { value: Math.round(churnRate * 10) / 10 },
      ltv: { value: Math.round(ltv * 100) / 100 },
      netNewMrr: { value: Math.round(netNewMrr * 100) / 100 },
      activePaidSubs: { value: activePaidSubs },
      totalUsers: { value: totalUsers },
    };

    // ── Charts Data ─────────────────────────────────────────────

    // Daily trials
    const dailyTrialData = (dailyTrials || []).map((r: any) => ({
      day: typeof r.day === 'string' ? r.day : new Date(r.day).toISOString().slice(0, 10),
      count: Number(r.count),
    }));

    // Daily new paid subs (from trial conversions by day)
    // Use subscription createdAt for new paid
    const newPaidByDay: Record<string, number> = {};
    for (const s of newSubsInPeriod) {
      const day = new Date(s.createdAt).toISOString().slice(0, 10);
      newPaidByDay[day] = (newPaidByDay[day] || 0) + 1;
    }
    const dailyNewPaidData = Object.entries(newPaidByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));

    // Plan mix
    const planMixData = planMix.map((p) => ({
      tier: p.tier,
      name: (PLANS_V2 as any)[p.tier]?.name || p.tier,
      count: p._count,
      mrrCents: p._count * mrrCentsForTier(p.tier),
    }));

    // Funnel: Signups → Trial Started → Trial Completed → Paid → Active 30d
    const [totalSignups, trialStarted, trialCompleted, trialPaid] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.trialLock.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.trialLock.count({ where: { trialConsumedAt: { not: null }, createdAt: { gte: periodStart } } }),
      prisma.trialLock.count({ where: { trialOutcome: 'CONVERTED', createdAt: { gte: periodStart } } }),
    ]);
    const active30d = activePaidSubs; // already filtered
    const funnelData = [
      { stage: 'Signups', count: totalSignups },
      { stage: 'Trial Started', count: trialStarted },
      { stage: 'Trial Completed', count: trialCompleted },
      { stage: 'Paid', count: trialPaid },
      { stage: 'Active 30d', count: active30d },
    ];

    // ── Tables ──────────────────────────────────────────────────

    // Blocked reasons
    const blockReasonCounts: Record<string, number> = {};
    for (const lock of blockedTrials7d) {
      const gates = (lock.gateResults as any)?.gates;
      if (!gates) continue;
      for (const [key, val] of Object.entries(gates)) {
        const v = val as any;
        if (v?.blocked === true || v?.allowed === false) {
          const label = key === 'recaptcha' ? 'reCAPTCHA Block'
            : key === 'ip_scoring' ? `IP: ${v.reason || 'unknown'}`
            : key === 'email_disposable' ? 'Disposable Email'
            : key === 'email_used' ? 'Email Reused'
            : key === 'card_fp' ? 'Card Reused'
            : key === 'device_fp' ? 'Device Reused'
            : key === 'ip_hash' ? 'IP Reused'
            : key;
          blockReasonCounts[label] = (blockReasonCounts[label] || 0) + 1;
        }
      }
    }
    const totalBlocked7d = Object.values(blockReasonCounts).reduce((a, b) => a + b, 0);
    const blockedReasonsTable = Object.entries(blockReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: totalBlocked7d > 0 ? Math.round((count / totalBlocked7d) * 1000) / 10 : 0,
      }));

    // Recent conversions enriched with plan info
    const recentConversionsEnriched = await Promise.all(
      recentConversions.map(async (c) => {
        let planTier = 'unknown';
        let mrrAdded = 0;
        if (c.subscriptionId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubscriptionId: c.subscriptionId },
            select: { tier: true },
          });
          if (sub) {
            planTier = sub.tier;
            mrrAdded = mrrCentsForTier(sub.tier) / 100;
          }
        }
        return { email: c.email, plan: planTier, mrrAdded, date: c.createdAt };
      }),
    );

    // Recent churns
    const recentChurnsEnriched = recentChurns.map((c) => {
      const daysActive = Math.floor(
        (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        email: c.user?.email || 'unknown',
        plan: c.tier,
        daysActive,
        date: c.updatedAt,
      };
    });

    // Recent top-ups enriched
    const topupUserIds = [...new Set(recentTopups.map((t) => t.userId))];
    const topupUsers = await prisma.user.findMany({
      where: { id: { in: topupUserIds } },
      select: { id: true, email: true },
    });
    const userEmailMap: Record<string, string> = {};
    for (const u of topupUsers) userEmailMap[u.id] = u.email;

    const recentTopupsEnriched = recentTopups.map((t) => ({
      email: userEmailMap[t.userId] || 'unknown',
      credits: t.amount,
      description: t.description,
      date: t.createdAt,
    }));

    const result = {
      _rangeKey: rangeKey,
      kpis,
      charts: {
        dailyTrials: dailyTrialData,
        dailyNewPaid: dailyNewPaidData,
        funnel: funnelData,
        planMix: planMixData,
      },
      tables: {
        blockedReasons: blockedReasonsTable,
        recentConversions: recentConversionsEnriched,
        recentChurns: recentChurnsEnriched,
        recentTopups: recentTopupsEnriched,
      },
    };

    // Cache result
    cache = { data: result, ts: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/conversions] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
