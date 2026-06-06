export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkGeneration, consumeCoins } from '@/lib/quota';
import { runGenerationPipeline } from '@/lib/generation-pipeline';
import type { PipelineOptions } from '@/lib/generation-pipeline';
import { validateFreeTierRequest, clampFreeTierParams, FREE_REEL_EST_COST_CENTS } from '@/lib/free-tier';
import { checkFreeTierLimits, recordFreeTierSpend } from '@/lib/free-tier-limits';

/** Best-effort client IP from proxy headers (used for free-tier anti-abuse). */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { prompt, platform, style, voice, mood } = body ?? {};
    const motion = body?.motion === true;

    // Voice & subtitle advanced settings
    const voiceTier = body?.voiceTier;       // flash | multilingual | turbo
    const stability = typeof body?.stability === 'number' ? body.stability : undefined;
    const similarity = typeof body?.similarity === 'number' ? body.similarity : undefined;
    const subtitleStyle = body?.subtitleStyle;  // Partial<SubtitleStyle>

    // Model tier + music selection (Phase 3)
    const modelTier = typeof body?.modelTier === 'string' ? body.modelTier : undefined; // standard | pro | cinematic
    const musicTrackId = typeof body?.musicTrackId === 'string' ? body.musicTrackId : undefined;
    const stinger = body?.stinger === true;
    const stingerId = typeof body?.stingerId === 'string' ? body.stingerId : undefined;
    const brandPresetId = typeof body?.brandPresetId === 'string' ? body.brandPresetId : undefined;

    // Requested reel length (seconds). Must be one of the offered options; the
    // pipeline guarantees the delivered MP4 lands within ±1s of this.
    const ALLOWED_LENGTHS = [15, 20, 25, 30];
    const reqLen = Number(body?.targetLength ?? body?.targetDuration);
    const targetDuration = ALLOWED_LENGTHS.includes(reqLen) ? reqLen : 25;

    if (!prompt || !platform || !style || !voice || !mood) {
      return NextResponse.json({ error: 'All fields are required: prompt, platform, style, voice, mood' }, { status: 400 });
    }

    // SERVER-SIDE GATE: feature (motion=Premium) + volume (coins) before any paid API call.
    const gate = await checkGeneration(userId, motion, modelTier);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, reason: gate.reason, balance: gate.balance }, { status: 403 });
    }

    const isFreePreview = gate.isFreePreview === true;
    let coinCost = isFreePreview ? 0 : gate.cost;
    const clientIp = getClientIp(request);

    // ── FREE-TIER ENFORCEMENT (server is the authority) ──────────────────
    // Every free-tier limit is enforced here, so a raw curl/Postman request
    // cannot bypass the UI. Premium params are rejected with 403; rate +
    // budget limits gate volume; clampFreeTierParams normalizes the rest.
    let freeClamp: ReturnType<typeof clampFreeTierParams> | null = null;
    if (gate.balance.tier === 'free') {
      // (a) Email verification gate — no generation until the address is verified.
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, freeReelUsed: true } });
      if (!u?.emailVerified) {
        return NextResponse.json(
          { error: 'Please verify your email address to start creating reels. Check your inbox for the verification link.', reason: 'email_unverified' },
          { status: 403 },
        );
      }
      // (b) LIFETIME gate — each account gets exactly ONE real-AI free reel, ever.
      if (u.freeReelUsed) {
        return NextResponse.json(
          { error: 'You\u2019ve already created your free AI reel. Upgrade to Pro to keep creating \u2014 longer reels, no watermark, custom voices, music & more.', reason: 'free_lifetime_exhausted', upgrade: true },
          { status: 403 },
        );
      }
      // (c) Reject any attempt to exceed free-tier feature limits (curl bypass).
      const v = validateFreeTierRequest(body);
      if (!v.ok) {
        return NextResponse.json(
          { error: v.message, reason: 'free_locked', violations: v.violations, upgrade: true },
          { status: 403 },
        );
      }
      // (d) Volume guards: per-IP 1/hour (anti signup-spam) + global daily budget.
      const limit = await checkFreeTierLimits(userId, clientIp);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: limit.message, reason: limit.reason, retryAfterHours: limit.retryAfterHours, upgrade: true },
          { status: 429 },
        );
      }
      // (e) Atomically CLAIM the lifetime free reel (race-safe against double
      //     submits / concurrent curl). Only one request can flip false→true.
      const claim = await prisma.user.updateMany({ where: { id: userId, freeReelUsed: false }, data: { freeReelUsed: true } });
      if (claim.count === 0) {
        return NextResponse.json(
          { error: 'You\u2019ve already created your free AI reel. Upgrade to Pro to keep creating.', reason: 'free_lifetime_exhausted', upgrade: true },
          { status: 403 },
        );
      }
      // (f) Defensive normalization of every param that reaches the pipeline.
      freeClamp = clampFreeTierParams(body);
      coinCost = 0;
    }

    // Create reel + job
    // Validate the brand preset belongs to this user (defensive) before linking.
    let validPresetId: string | undefined = undefined;
    if (brandPresetId) {
      const owned = await prisma.brandPreset.findFirst({ where: { id: brandPresetId, userId }, select: { id: true } });
      if (owned) validPresetId = owned.id;
    }

    const reel = await prisma.reel.create({
      data: {
        userId, prompt, platform, style, voice, mood,
        status: 'rendering',
        motion: motion && !isFreePreview,
        coinCost,
        tier: gate.balance.tier,
        clientIp: clientIp ?? undefined,
        ...(validPresetId ? { brandPresetId: validPresetId } : {}),
      },
    });

    // Free tier: record the estimated spend up-front so concurrent requests
    // can't collectively blow past the daily budget pool.
    if (gate.balance.tier === 'free') {
      await recordFreeTierSpend(FREE_REEL_EST_COST_CENTS);
    }

    // Track preset usage for analytics (Phase 4b). Best-effort, non-blocking.
    if (validPresetId) {
      prisma.brandPreset.update({ where: { id: validPresetId }, data: { usageCount: { increment: 1 } } }).catch(() => {});
    }

    const job = await prisma.generationJob.create({
      data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
    });

    await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

    // Consume coins up-front for paid generations (free previews cost nothing).
    if (!isFreePreview && coinCost > 0) {
      await consumeCoins(userId, coinCost);
    }

    // Build pipeline options from advanced settings. For free tier, the
    // server-clamped values (5s / standard / default voice / auto-music /
    // allowed subtitle style) override anything the client sent.
    const pipelineOpts: PipelineOptions = freeClamp
      ? {
          voiceTier: undefined,
          stability,
          similarity,
          subtitleStyle: freeClamp.subtitleStyle,
          modelTier: freeClamp.modelTier,
          musicTrackId: undefined,
          stinger: false,
          stingerId: undefined,
          targetDuration: freeClamp.targetDuration,
        }
      : {
          voiceTier,
          stability,
          similarity,
          subtitleStyle,
          modelTier,
          musicTrackId,
          stinger,
          stingerId,
          targetDuration,
        };

    // Start pipeline (fire-and-forget). The free tier now runs REAL AI
    // generation (LLM script + AI images + auto-matched music + subtitle
    // compositing) on the Standard engine — always 'full' mode. The watermark
    // and 720p cap are applied by the pipeline based on the reel's free tier;
    // a failed free reel restores the user's lifetime entitlement.
    runGenerationPipeline(job.id, reel.id, userId, 'full', pipelineOpts).catch(console.error);

    return NextResponse.json({
      jobId: job.id,
      reelId: reel.id,
      coinCost,
      isFreePreview,
      motion: motion && !isFreePreview,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
  }
}
