/**
 * Live single-reel test harness. Mirrors app/api/reels/generate/route.ts but
 * calls runGenerationPipeline directly so we can drive controlled batches and
 * capture exact results (MP4 url, duration vs target, motion clip count, cost).
 *
 * Usage: npx tsx scripts/run-reel.ts <modelTier> <targetDuration> <label> [prompt] [mood] [style]
 */
import { prisma } from '../lib/prisma';
import { runGenerationPipeline } from '../lib/generation-pipeline';
import type { PipelineOptions } from '../lib/generation-pipeline';

const USER_EMAIL = 'john@doe.com';

async function main() {
  const [, , modelTier, targetDurationStr, label, promptArg, moodArg, styleArg] = process.argv;
  const targetDuration = Number(targetDurationStr);
  const prompt = promptArg || 'I am worthy of abundance and my dreams are manifesting now';
  const mood = moodArg || 'uplifting';
  const style = styleArg || 'celestial';

  const u = await prisma.user.findUnique({ where: { email: USER_EMAIL }, select: { id: true } });
  if (!u) throw new Error('test user not found');
  const userId = u.id;
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { tier: true } });
  const tier = sub?.tier ?? 'free';

  const reel = await prisma.reel.create({
    data: {
      userId, prompt, platform: 'instagram', style, voice: 'female_soft', mood,
      status: 'rendering', motion: true, coinCost: 0, tier,
    },
  });
  const job = await prisma.generationJob.create({
    data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
  });
  await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

  const opts: PipelineOptions = { modelTier, targetDuration };
  const t0 = Date.now();
  console.log(`[harness] START label=${label} tier=${modelTier} target=${targetDuration}s reel=${reel.id}`);
  try {
    await runGenerationPipeline(job.id, reel.id, userId, 'full', opts);
  } catch (e: any) {
    console.error(`[harness] pipeline threw: ${e?.message}`);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const fresh = await prisma.reel.findUnique({ where: { id: reel.id } });
  const j = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { status: true, errorMessage: true, currentStep: true } });
  const sj: any = fresh?.scenesJson ?? {};
  const result = {
    label, modelTier, target: targetDuration,
    reelId: reel.id,
    status: fresh?.status,
    jobStatus: j?.status,
    errorMessage: j?.errorMessage ?? null,
    videoUrl: fresh?.videoUrl ?? null,
    finalDuration: fresh?.durationSec ?? null,
    durationDelta: sj.durationDelta ?? null,
    durationMet: sj.durationMet ?? null,
    motionClipCount: sj.motionClipCount ?? null,
    motionExpected: sj.motionExpected ?? null,
    motionVerified: sj.motionVerified ?? null,
    motionProvider: sj.motionProvider ?? null,
    sceneCount: Array.isArray(sj.scenes) ? sj.scenes.length : null,
    totalCost: fresh?.totalCost ?? null,
    costBreakdown: fresh?.costBreakdown ?? null,
    elapsedSec: elapsed,
  };
  console.log('[harness] RESULT ' + JSON.stringify(result));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
