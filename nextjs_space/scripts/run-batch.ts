/**
 * Sequential batch reel runner for live test suite. Runs each config one at a
 * time, appending a RESULT json line to the results file so progress survives
 * even if the process is interrupted. Launched via setsid for detachment.
 *
 * Configs are read from scripts/batch-configs.json (array of {label, modelTier, target, mood, style, prompt}).
 */
import { prisma } from '../lib/prisma';
import { runGenerationPipeline } from '../lib/generation-pipeline';
import type { PipelineOptions } from '../lib/generation-pipeline';
import * as fs from 'fs';

const USER_EMAIL = 'john@doe.com';
const RESULTS = process.argv[2] || '/tmp/testlogs/batch-results.jsonl';

async function runOne(cfg: any, userId: string, tier: string) {
  const prompt = cfg.prompt || 'I am worthy of abundance and my dreams are manifesting now';
  const reel = await prisma.reel.create({
    data: {
      userId, prompt, platform: 'instagram', style: cfg.style || 'celestial',
      voice: cfg.voice || 'female_soft', mood: cfg.mood || 'uplifting',
      status: 'rendering', motion: true, coinCost: 0, tier,
    },
  });
  const job = await prisma.generationJob.create({
    data: { userId, reelId: reel.id, status: 'queued', currentStep: 'queued', progressPct: 0, startedAt: new Date() },
  });
  await prisma.reel.update({ where: { id: reel.id }, data: { jobId: job.id } });
  const opts: PipelineOptions = { modelTier: cfg.modelTier, targetDuration: cfg.target };
  const t0 = Date.now();
  console.log(`\n[batch] === START ${cfg.label} tier=${cfg.modelTier} target=${cfg.target}s reel=${reel.id} ===`);
  try {
    await runGenerationPipeline(job.id, reel.id, userId, 'full', opts);
  } catch (e: any) {
    console.error(`[batch] pipeline threw: ${e?.message}`);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const fresh = await prisma.reel.findUnique({ where: { id: reel.id } });
  const j = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { status: true, errorMessage: true } });
  const sj: any = fresh?.scenesJson ?? {};
  const result = {
    label: cfg.label, modelTier: cfg.modelTier, target: cfg.target, mood: cfg.mood,
    reelId: reel.id, status: fresh?.status, jobStatus: j?.status,
    errorMessage: j?.errorMessage ?? null,
    videoUrl: fresh?.videoUrl ?? null,
    finalDuration: fresh?.durationSec ?? null,
    durationDelta: sj.durationDelta ?? null, durationMet: sj.durationMet ?? null,
    motionClipCount: sj.motionClipCount ?? null, motionExpected: sj.motionExpected ?? null,
    motionVerified: sj.motionVerified ?? null, motionProvider: sj.motionProvider ?? null,
    sceneCount: Array.isArray(sj.scenes) ? sj.scenes.length : null,
    totalCost: fresh?.totalCost ?? null, costBreakdown: fresh?.costBreakdown ?? null,
    elapsedSec: elapsed,
  };
  fs.appendFileSync(RESULTS, JSON.stringify(result) + '\n');
  console.log(`[batch] === DONE ${cfg.label}: status=${result.status} dur=${result.finalDuration}s motion=${result.motionClipCount}/${result.motionExpected} cost=$${result.totalCost} (${elapsed}s) ===`);
}

async function main() {
  const configs = JSON.parse(fs.readFileSync(__dirname + '/batch-configs.json', 'utf8'));
  const u = await prisma.user.findUnique({ where: { email: USER_EMAIL }, select: { id: true } });
  if (!u) throw new Error('test user not found');
  const sub = await prisma.subscription.findUnique({ where: { userId: u.id }, select: { tier: true } });
  const tier = sub?.tier ?? 'free';
  console.log(`[batch] running ${configs.length} reels as ${USER_EMAIL} (tier=${tier})`);
  for (const cfg of configs) {
    await runOne(cfg, u.id, tier);
  }
  console.log(`[batch] ALL DONE (${configs.length} reels)`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
