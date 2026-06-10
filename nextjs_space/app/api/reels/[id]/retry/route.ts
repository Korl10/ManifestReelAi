export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { checkGeneration, consumeCoins } from '@/lib/quota';
import { runGenerationPipeline } from '@/lib/generation-pipeline';
import type { PipelineOptions } from '@/lib/generation-pipeline';

const ALLOWED_LENGTHS = [5, 10, 15, 25, 30];

/**
 * Fix B4 — explicit failure-recovery retry.
 *
 * Re-runs generation for a previously FAILED reel. The original reel was already
 * refunded by the pipeline guardrails, so this creates a brand-new reel + job and
 * re-charges the user. The caller can choose to:
 *   - mode 'same'        → retry on the same engine (e.g. Veo 3 again)
 *   - mode 'switch_pro'  → fall back to the Pro tier (Kling 2.5) for faster, more
 *                          reliable generation when the cinematic engine is busy.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;

    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === 'switch_pro' ? 'switch_pro' : 'same';

    const source = await prisma.reel.findFirst({ where: { id: params.id, userId } });
    if (!source) return NextResponse.json({ error: 'Reel not found' }, { status: 404 });

    const scenes = (source.scenesJson as any) ?? {};
    const originalTier: string = scenes?.model_tier ?? 'cinematic';
    const modelTier = mode === 'switch_pro' ? 'pro' : originalTier;
    const reqLen = Number(scenes?.targetDuration ?? source.durationSec);
    const targetDuration = ALLOWED_LENGTHS.includes(reqLen) ? reqLen : 25;
    const motion = modelTier === 'pro' || modelTier === 'cinematic';

    // Re-gate: feature access + coin balance before any paid work.
    const gate = await checkGeneration(userId, motion, modelTier, targetDuration);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.message, reason: gate.reason, balance: gate.balance }, { status: 403 });
    }
    const coinCost = gate.cost;

    const reel = await prisma.reel.create({
      data: {
        userId,
        prompt: source.prompt,
        platform: source.platform,
        style: source.style,
        voice: source.voice,
        mood: source.mood,
        status: 'rendering',
        motion,
        coinCost,
        tier: gate.balance.tier,
        ...(source.brandPresetId ? { brandPresetId: source.brandPresetId } : {}),
      },
    });

    const job = await prisma.generationJob.create({
      data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
    });
    await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

    if (coinCost > 0) await consumeCoins(userId, coinCost);

    const pipelineOpts: PipelineOptions = {
      modelTier,
      musicTrackId: source.musicTrackId ?? undefined,
      targetDuration,
    };

    runGenerationPipeline(job.id, reel.id, userId, 'full', pipelineOpts).catch(console.error);

    return NextResponse.json({ jobId: job.id, reelId: reel.id, coinCost, modelTier, motion }, { status: 201 });
  } catch (err: any) {
    console.error('Retry error:', err);
    return NextResponse.json({ error: 'Failed to start retry' }, { status: 500 });
  }
}
