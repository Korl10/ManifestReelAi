/**
 * Hardened single-reel test harness.
 * - Heartbeat log every 30s so hangs are visible.
 * - Per-reel hard timeout (default 15min) -> graceful skip + logged, no cascade.
 * - Writes RESULT json line to <resultsFile> AND a `<resultsFile>.done` sentinel
 *   so a poller can detect completion without parsing logs.
 * - Resumable: caller passes a fresh resultsFile per run; appends, never deletes.
 *
 * Usage:
 *   npx tsx scripts/run-reel-hardened.ts <modelTier> <targetDuration> <label> <resultsFile> [prompt] [mood] [style] [voice]
 */
import { appendFileSync, writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { runGenerationPipeline } from '../lib/generation-pipeline';
import type { PipelineOptions } from '../lib/generation-pipeline';

const USER_EMAIL = 'john@doe.com';
const TIMEOUT_MS = Number(process.env.REEL_TIMEOUT_MS || 15 * 60 * 1000);

function ts() { return new Date().toISOString(); }

async function main() {
  const [, , modelTier, targetDurationStr, label, resultsFile, promptArg, moodArg, styleArg, voiceArg] = process.argv;
  const targetDuration = Number(targetDurationStr);
  const prompt = promptArg || 'I am worthy of abundance and my dreams are manifesting now';
  const mood = moodArg || 'uplifting';
  const style = styleArg || 'celestial';
  const voice = voiceArg || 'female_soft';
  const doneFile = resultsFile + '.done';

  const u = await prisma.user.findUnique({ where: { email: USER_EMAIL }, select: { id: true } });
  if (!u) throw new Error('test user not found');
  const userId = u.id;
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { tier: true } });
  const tier = sub?.tier ?? 'free';

  const reel = await prisma.reel.create({
    data: { userId, prompt, platform: 'instagram', style, voice, mood, status: 'rendering', motion: true, coinCost: 0, tier },
  });
  const job = await prisma.generationJob.create({
    data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
  });
  await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });

  const opts: PipelineOptions = { modelTier, targetDuration };
  const t0 = Date.now();
  console.log(`[harness ${ts()}] START label=${label} tier=${modelTier} target=${targetDuration}s niche/mood=${mood} style=${style} voice=${voice} reel=${reel.id}`);

  // Heartbeat: surface job currentStep + elapsed every 30s
  const hb = setInterval(async () => {
    try {
      const j = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { currentStep: true, progressPct: true, status: true } });
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`[hb ${ts()}] +${el}s status=${j?.status} pct=${j?.progressPct} step="${j?.currentStep}"`);
    } catch { /* ignore heartbeat db blips */ }
  }, 30000);

  let timedOut = false;
  try {
    await Promise.race([
      runGenerationPipeline(job.id, reel.id, userId, 'full', opts),
      new Promise((_, rej) => setTimeout(() => { timedOut = true; rej(new Error('REEL_TIMEOUT')); }, TIMEOUT_MS)),
    ]);
  } catch (e: any) {
    console.error(`[harness ${ts()}] ${timedOut ? 'TIMEOUT after ' + (TIMEOUT_MS/1000) + 's' : 'pipeline threw'}: ${e?.message}`);
  }
  clearInterval(hb);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const fresh = await prisma.reel.findUnique({ where: { id: reel.id } });
  const j = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { status: true, errorMessage: true } });
  const sj: any = fresh?.scenesJson ?? {};
  const result = {
    label, modelTier, target: targetDuration, mood, style, voice,
    reelId: reel.id,
    status: timedOut ? 'timeout' : fresh?.status,
    jobStatus: j?.status,
    errorMessage: j?.errorMessage ?? null,
    videoUrl: fresh?.videoUrl ?? null,
    thumbnailUrl: fresh?.thumbnailUrl ?? null,
    finalDuration: fresh?.durationSec ?? null,
    durationDelta: sj.durationDelta ?? null,
    durationMet: sj.durationMet ?? null,
    motionClipCount: sj.motionClipCount ?? null,
    motionExpected: sj.motionExpected ?? null,
    motionVerified: sj.motionVerified ?? null,
    motionProvider: sj.motionProvider ?? null,
    sceneCount: Array.isArray(sj.scenes) ? sj.scenes.length : null,
    perScene: Array.isArray(sj.scenes) ? sj.scenes.map((s: any, i: number) => ({ i, dur: s.duration ?? s.durationSec ?? null, animated: s.animated ?? s.motion ?? null })) : null,
    whisperLog: sj.whisperDecision ?? null,
    totalCost: fresh?.totalCost ?? null,
    costBreakdown: fresh?.costBreakdown ?? null,
    elapsedSec: elapsed,
  };
  const line = JSON.stringify(result);
  console.log('[harness] RESULT ' + line);
  appendFileSync(resultsFile, line + '\n');
  writeFileSync(doneFile, result.reelId + ' ' + result.status + '\n');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch {} process.exit(1); });
