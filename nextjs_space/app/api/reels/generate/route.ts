export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkGeneration, consumeCoins } from '@/lib/quota';
import { runGenerationPipeline } from '@/lib/generation-pipeline';
import type { PipelineOptions } from '@/lib/generation-pipeline';
import { consumeRateLimit } from '@/lib/rate-limit';


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
    const ALLOWED_LENGTHS = [5, 10, 15, 25, 30];
    const reqLen = Number(body?.targetLength ?? body?.targetDuration);
    const targetDuration = ALLOWED_LENGTHS.includes(reqLen) ? reqLen : 25;

    if (!prompt || !platform || !style || !voice || !mood) {
      return NextResponse.json({ error: 'All fields are required: prompt, platform, style, voice, mood' }, { status: 400 });
    }

    // SERVER-SIDE GATE: feature + volume (coins) before any paid API call.
    // Coin cost is now duration-based: model-tier × reel-length.
    const gate = await checkGeneration(userId, motion, modelTier, targetDuration);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, reason: gate.reason, balance: gate.balance }, { status: 403 });
    }

    let coinCost = gate.cost;
    const clientIp = getClientIp(request);
    const isTrialing = gate.balance.isTrialing;

    // TRIAL COOLDOWN: trial users may start at most one reel per 60 seconds.
    // This throttles burst abuse of the 3 trial reels (paid subscribers are
    // unaffected). Applied after the feature/coin gate, before any DB writes.
    if (isTrialing) {
      const cooldown = await consumeRateLimit('generate-cooldown', userId, 1, 60_000);
      if (!cooldown.allowed) {
        return NextResponse.json(
          { error: `Please wait ${cooldown.retryAfterSec}s before starting another trial reel.`, reason: 'cooldown', retryAfterSec: cooldown.retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(cooldown.retryAfterSec) } },
        );
      }
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
        motion,
        coinCost,
        tier: gate.balance.tier,
        clientIp: clientIp ?? undefined,
        ...(validPresetId ? { brandPresetId: validPresetId } : {}),
      },
    });

    // Trial reel counter: increment atomically so concurrent requests
    // can't exceed the 3-reel trial limit.
    if (isTrialing) {
      await prisma.subscription.update({
        where: { userId },
        data: { trialReelsUsed: { increment: 1 } },
      });
    }

    // Track preset usage for analytics (Phase 4b). Best-effort, non-blocking.
    if (validPresetId) {
      prisma.brandPreset.update({ where: { id: validPresetId }, data: { usageCount: { increment: 1 } } }).catch(() => {});
    }

    const job = await prisma.generationJob.create({
      data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
    });

    await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

    // Consume coins up-front (trial reels still cost coins from the trial allocation).
    if (coinCost > 0) {
      await consumeCoins(userId, coinCost);
    }

    // Build pipeline options from advanced settings.
    const pipelineOpts: PipelineOptions = {
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

    // Start pipeline (fire-and-forget).
    runGenerationPipeline(job.id, reel.id, userId, 'full', pipelineOpts).catch(console.error);

    return NextResponse.json({
      jobId: job.id,
      reelId: reel.id,
      coinCost,
      isTrialing,
      motion,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
  }
}
