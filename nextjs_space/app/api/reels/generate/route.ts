export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkGeneration, consumeCoins } from '@/lib/quota';
import { runGenerationPipeline } from '@/lib/generation-pipeline';
import type { PipelineOptions } from '@/lib/generation-pipeline';

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

    if (!prompt || !platform || !style || !voice || !mood) {
      return NextResponse.json({ error: 'All fields are required: prompt, platform, style, voice, mood' }, { status: 400 });
    }

    // SERVER-SIDE GATE: feature (motion=Premium) + volume (coins) before any paid API call.
    const gate = await checkGeneration(userId, motion, modelTier);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, reason: gate.reason, balance: gate.balance }, { status: 403 });
    }

    const isFreePreview = gate.isFreePreview === true;
    const coinCost = isFreePreview ? 0 : gate.cost;

    // Create reel + job
    const reel = await prisma.reel.create({
      data: {
        userId, prompt, platform, style, voice, mood,
        status: 'rendering',
        motion: motion && !isFreePreview,
        coinCost,
      },
    });

    const job = await prisma.generationJob.create({
      data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
    });

    await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

    // Consume coins up-front for paid generations (free previews cost nothing).
    if (!isFreePreview && coinCost > 0) {
      await consumeCoins(userId, coinCost);
    }

    // Build pipeline options from advanced settings
    const pipelineOpts: PipelineOptions = {
      voiceTier,
      stability,
      similarity,
      subtitleStyle,
      modelTier,
      musicTrackId,
    };

    // Start pipeline (fire-and-forget). Free tier runs a preview built from
    // cached/sample assets only — no live paid API calls.
    runGenerationPipeline(job.id, reel.id, userId, isFreePreview ? 'preview' : 'full', pipelineOpts).catch(console.error);

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
