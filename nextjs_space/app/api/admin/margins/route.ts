export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PLANS, COIN_COST, PLAN_ORDER } from '@/lib/pricing';
import { moodCoverage } from '@/lib/music-library';
import { getFreeBudgetToday } from '@/lib/free-tier-limits';

// Retail price per coin (retail value the user pays)
const CREDIT_RETAIL_VALUE = 0.10; // Part D target: 1 credit = $0.10

// Derive tier prices from PLANS so they stay in sync with pricing.ts.
const TIER_PRICES: Record<string, number> = { free: 0 };
for (const t of PLAN_ORDER) {
  TIER_PRICES[t] = PLANS[t].monthlyPrice / 100;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function weekKey(d: Date): string {
  // ISO week start (Monday)
  const day = new Date(d);
  const diff = day.getDay() === 0 ? 6 : day.getDay() - 1;
  day.setDate(day.getDate() - diff);
  return `W ${day.toISOString().slice(0, 10)}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Subscriptions for revenue estimate
  const subs = await prisma.subscription.findMany({ where: { status: 'active' } });
  const monthlyRevenue = subs.reduce((s: number, sub: any) => s + (TIER_PRICES[sub?.tier] ?? 0), 0);

  // All reels with cost data
  const reels = await prisma.reel.findMany({
    select: {
      id: true, totalCost: true, costBreakdown: true, createdAt: true,
      motion: true, coinCost: true, status: true, style: true, mood: true,
      scenesJson: true, musicTrackId: true, musicSource: true, tier: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Per-reel detail (latest 100 for the table)
  const reelDetails = reels.slice(0, 100).map((r: any) => {
    const cost = r.totalCost ?? 0;
    const type = r.motion ? 'motion' : 'static';
    const retail = r.motion
      ? (r.coinCost ?? COIN_COST.motion) * CREDIT_RETAIL_VALUE
      : (r.coinCost ?? COIN_COST.static) * CREDIT_RETAIL_VALUE;
    const breakdown = r.costBreakdown ?? {};
    let meta: any = {};
    try { meta = typeof r.scenesJson === 'string' ? JSON.parse(r.scenesJson) : (r.scenesJson ?? {}); } catch { meta = {}; }
    return {
      id: r.id,
      date: r.createdAt,
      user: r.user?.email ?? 'unknown',
      type,
      style: r.style,
      mood: r.mood,
      modelTier: meta.model_tier ?? null,
      musicTrackId: meta.music_track_id ?? null,
      voiceTier: meta.voice_tier ?? null,
      // Motion-integrity signals (P0 billing guardrail).
      motionVerified: r.motion ? (meta.motionVerified ?? null) : null,
      motionExpected: meta.motionExpected ?? null,
      motionClipCount: meta.motionClipCount ?? null,
      motionDowngraded: meta.motionDowngraded ?? null,
      refundedCoins: meta.refundedCoins ?? 0,
      // Duration-guarantee signals (P0 billing guardrail).
      durationMet: meta.durationMet ?? null,
      targetDuration: meta.targetDuration ?? null,
      durationDelta: meta.durationDelta ?? null,
      status: r.status,
      cost: Math.round(cost * 10000) / 10000,
      retail: Math.round(retail * 100) / 100,
      margin: retail > 0 ? Math.round(((retail - cost) / retail) * 100) : 0,
      breakdown: {
        script: breakdown.script_cost ?? 0,
        image: breakdown.image_cost ?? 0,
        voice: breakdown.voice_cost ?? 0,
        whisper: breakdown.whisper_cost ?? 0,
        video: breakdown.video_cost ?? 0,
        music: breakdown.music_cost ?? 0,
        render: breakdown.render_cost ?? 0,
        storage: breakdown.storage_cost ?? 0,
      },
    };
  });

  // Daily aggregates (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyMap: Record<string, { count: number; cost: number; retail: number }> = {};
  const weeklyMap: Record<string, { count: number; cost: number; retail: number }> = {};

  for (const r of reels) {
    const d = new Date(r.createdAt);
    const cost = (r as any).totalCost ?? 0;
    const retail = (r as any).motion
      ? ((r as any).coinCost ?? COIN_COST.motion) * CREDIT_RETAIL_VALUE
      : ((r as any).coinCost ?? COIN_COST.static) * CREDIT_RETAIL_VALUE;

    // Daily (last 30 days)
    if (d >= thirtyDaysAgo) {
      const dk = dayKey(d);
      if (!dailyMap[dk]) dailyMap[dk] = { count: 0, cost: 0, retail: 0 };
      dailyMap[dk].count += 1;
      dailyMap[dk].cost += cost;
      dailyMap[dk].retail += retail;
    }

    // Weekly (all time)
    const wk = weekKey(d);
    if (!weeklyMap[wk]) weeklyMap[wk] = { count: 0, cost: 0, retail: 0 };
    weeklyMap[wk].count += 1;
    weeklyMap[wk].cost += cost;
    weeklyMap[wk].retail += retail;
  }

  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({
      day, count: d.count,
      cost: Math.round(d.cost * 100) / 100,
      retail: Math.round(d.retail * 100) / 100,
      margin: d.retail > 0 ? Math.round(((d.retail - d.cost) / d.retail) * 100) : 0,
    }));

  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week, count: d.count,
      cost: Math.round(d.cost * 100) / 100,
      retail: Math.round(d.retail * 100) / 100,
      margin: d.retail > 0 ? Math.round(((d.retail - d.cost) / d.retail) * 100) : 0,
    }));

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ---- Motion accuracy (last 7 days): scene-level motion success % ----
  const motAccMap: Record<string, { totalScenes: number; motionScenes: number; reels: number }> = {};
  let motTotalScenesAll = 0, motMotionScenesAll = 0, motReelsAll = 0;
  for (const r of reels) {
    const d = new Date(r.createdAt);
    if (d < sevenDaysAgo) continue;
    if (!(r as any).motion) continue;
    let meta: any = {};
    try { meta = typeof (r as any).scenesJson === 'string' ? JSON.parse((r as any).scenesJson) : ((r as any).scenesJson ?? {}); } catch { meta = {}; }
    const exp = meta.motionExpected ?? 0;
    const got = meta.motionClipCount ?? 0;
    if (exp <= 0) continue;
    const tierKey = meta.model_tier ?? 'unknown';
    if (!motAccMap[tierKey]) motAccMap[tierKey] = { totalScenes: 0, motionScenes: 0, reels: 0 };
    motAccMap[tierKey].totalScenes += exp;
    motAccMap[tierKey].motionScenes += Math.min(got, exp);
    motAccMap[tierKey].reels += 1;
    motTotalScenesAll += exp;
    motMotionScenesAll += Math.min(got, exp);
    motReelsAll += 1;
  }
  const motionAcc = {
    overallPct: motTotalScenesAll > 0 ? Math.round((motMotionScenesAll / motTotalScenesAll) * 100) : null,
    totalScenes: motTotalScenesAll,
    motionScenes: motMotionScenesAll,
    totalReels: motReelsAll,
    byTier: Object.entries(motAccMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tier, d]) => ({
        tier,
        totalScenes: d.totalScenes,
        motionScenes: d.motionScenes,
        reels: d.reels,
        pct: d.totalScenes > 0 ? Math.round((d.motionScenes / d.totalScenes) * 100) : 0,
        alert: d.totalScenes > 0 && Math.round((d.motionScenes / d.totalScenes) * 100) < 90,
      })),
    alert: motTotalScenesAll > 0 && Math.round((motMotionScenesAll / motTotalScenesAll) * 100) < 90,
  };

  // ---- Duration accuracy (last 7 days): % of reels within ±1s of target ----
  // Reported per model tier with a <95% alert flag for ops monitoring.
  const durAccMap: Record<string, { total: number; met: number }> = {};
  let durAccTotalAll = 0, durAccMetAll = 0;
  for (const r of reels) {
    if (new Date((r as any).createdAt) < sevenDaysAgo) continue;
    let meta: any = {};
    try { meta = typeof (r as any).scenesJson === 'string' ? JSON.parse((r as any).scenesJson) : ((r as any).scenesJson ?? {}); } catch { meta = {}; }
    if (meta.durationMet === null || meta.durationMet === undefined) continue; // only reels that ran the gate
    const tierKey = meta.model_tier ?? 'standard';
    if (!durAccMap[tierKey]) durAccMap[tierKey] = { total: 0, met: 0 };
    durAccMap[tierKey].total += 1;
    durAccTotalAll += 1;
    if (meta.durationMet === true) { durAccMap[tierKey].met += 1; durAccMetAll += 1; }
  }
  const durationAccuracy = {
    overallPct: durAccTotalAll > 0 ? Math.round((durAccMetAll / durAccTotalAll) * 100) : null,
    totalReels: durAccTotalAll,
    metReels: durAccMetAll,
    byTier: Object.entries(durAccMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tier, v]) => {
        const pct = v.total > 0 ? Math.round((v.met / v.total) * 100) : 0;
        return { tier, total: v.total, met: v.met, pct, alert: pct < 95 };
      }),
    alert: Object.values(durAccMap).some((v) => v.total > 0 && (v.met / v.total) * 100 < 95),
  };

  // Totals
  const totalCost = reels.reduce((s: number, r: any) => s + (r.totalCost ?? 0), 0);
  const totalReels = reels.length;
  const completedReels = reels.filter((r: any) => r.status === 'ready').length;
  const avgCostPerReel = completedReels > 0 ? totalCost / completedReels : 0;

  // Cost by provider category
  const costByCategory: Record<string, number> = { script: 0, image: 0, voice: 0, whisper: 0, video: 0, music: 0, render: 0, storage: 0 };
  for (const r of reels) {
    const b = (r as any).costBreakdown ?? {};
    costByCategory.script += b.script_cost ?? 0;
    costByCategory.image += b.image_cost ?? 0;
    costByCategory.voice += b.voice_cost ?? 0;
    costByCategory.whisper += b.whisper_cost ?? 0;
    costByCategory.video += b.video_cost ?? 0;
    costByCategory.music += b.music_cost ?? 0;
    costByCategory.render += b.render_cost ?? 0;
    costByCategory.storage += b.storage_cost ?? 0;
  }
  // Round
  for (const k of Object.keys(costByCategory)) {
    costByCategory[k] = Math.round(costByCategory[k] * 100) / 100;
  }

  // Music source audit — how many reels used the curated_v1 priority pool vs.
  // the default/legacy fallback (per Option B merge), for the margins audit.
  const musicSourceBreakdown: Record<string, number> = {};
  for (const r of reels as any[]) {
    const src = r.musicSource ?? 'unrecorded';
    musicSourceBreakdown[src] = (musicSourceBreakdown[src] ?? 0) + 1;
  }

  const freeBudget = await getFreeBudgetToday();

  return NextResponse.json({
    freeBudget,
    musicSourceBreakdown,
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalReels,
    completedReels,
    avgCostPerReel: Math.round(avgCostPerReel * 10000) / 10000,
    margin: monthlyRevenue > 0 ? Math.round(((monthlyRevenue - totalCost) / monthlyRevenue) * 100) : 0,
    costByCategory,
    dailyData,
    weeklyData,
    reelDetails,
    durationAccuracy,
    motionAccuracy: motionAcc,
    musicCoverage: moodCoverage(),
  });
}
