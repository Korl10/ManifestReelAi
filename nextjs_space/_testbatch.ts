/**
 * Verification test runner — Batch A (duration) + Batch B (motion success).
 * Usage:
 *   tsx _testbatch.ts duration   — 8 reels: standard+cinematic × 15/20/25/30s
 *   tsx _testbatch.ts motion     — 10 cinematic reels, varied intentions/moods
 */
import { prisma } from './lib/db';
import { runGenerationPipeline } from './lib/generation-pipeline';

const USER_ID = 'cmpya5two0000ya8tc39di0va'; // john@doe.com admin/premium

interface TestSpec {
  label: string;
  prompt: string;
  mood: string;
  style: string;
  tier: string;
  targetDuration: number;
  motion: boolean;
}

const BATCH_A: TestSpec[] = [];
for (const tier of ['standard', 'cinematic']) {
  for (const dur of [15, 20, 25, 30]) {
    BATCH_A.push({
      label: `A-${tier}-${dur}s`,
      prompt: `Abundance flows to me every day (${tier} ${dur}s test)`,
      mood: 'abundant',
      style: 'spiritual',
      tier,
      targetDuration: dur,
      motion: true,
    });
  }
}

const BATCH_B: TestSpec[] = [
  { label: 'B1', prompt: 'I attract abundance daily', mood: 'abundant', style: 'wealth', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B2', prompt: 'I am unstoppable', mood: 'empowered', style: 'motivational', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B3', prompt: 'Grateful for every blessing', mood: 'grateful', style: 'spiritual', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B4', prompt: 'Calm mind, open heart', mood: 'calm', style: 'meditation', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B5', prompt: 'Hustle until they whisper', mood: 'hype', style: 'motivational', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B6', prompt: 'Luxury is my standard', mood: 'abundant', style: 'luxury', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B7', prompt: 'I am the one I have been waiting for', mood: 'inspired', style: 'spiritual', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B8', prompt: 'Joy fills my morning', mood: 'joyful', style: 'spiritual', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B9', prompt: 'Manifesting my dream life', mood: 'inspired', style: 'law-of-attraction', tier: 'cinematic', targetDuration: 25, motion: true },
  { label: 'B10', prompt: 'Wealth flows to me effortlessly', mood: 'abundant', style: 'abundance', tier: 'cinematic', targetDuration: 25, motion: true },
];

async function runOne(spec: TestSpec) {
  const start = Date.now();
  console.log(`\n========= ${spec.label} (${spec.tier} ${spec.targetDuration}s) START =========`);
  try {
    // Create reel + job
    const reel = await prisma.reel.create({
      data: {
        userId: USER_ID,
        title: `Test: ${spec.label}`,
        prompt: spec.prompt,
        style: spec.style,
        mood: spec.mood,
        motion: spec.motion,
        voice: 'pNInz6obpgDQGcFmaJgB',
        status: 'pending',
        platform: 'instagram',
        scriptJson: {},
        scenesJson: {},
      },
    });
    const job = await prisma.generationJob.create({
      data: {
        reelId: reel.id,
        userId: USER_ID,
        status: 'queued',
      },
    });
    console.log(`[${spec.label}] reel=${reel.id} job=${job.id}`);

    await runGenerationPipeline(job.id, reel.id, USER_ID, 'full', {
      modelTier: spec.tier,
      targetDuration: spec.targetDuration,
    });

    // Read results
    const updated = await prisma.reel.findUnique({ where: { id: reel.id } });
    const meta: any = typeof (updated as any)?.scenesJson === 'string'
      ? JSON.parse((updated as any).scenesJson)
      : ((updated as any)?.scenesJson ?? {});

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`========= ${spec.label} DONE (${elapsed}s) =========`);
    console.log(`  status      = ${updated?.status}`);
    console.log(`  durationSec = ${meta.durationSec ?? 'N/A'}`);
    console.log(`  targetDur   = ${meta.targetDuration ?? spec.targetDuration}`);
    console.log(`  durationMet = ${meta.durationMet ?? 'N/A'}`);
    console.log(`  delta       = ${meta.durationDelta ?? 'N/A'}`);
    console.log(`  motionClips = ${meta.motionClipCount ?? 'N/A'}/${meta.motionExpected ?? 'N/A'}`);
    console.log(`  motionOK    = ${meta.motionVerified ?? 'N/A'}`);
    console.log(`  motionDown  = ${meta.motionDowngraded ?? false}`);
    console.log(`  failReason  = ${meta.failureReason ?? 'none'}`);
    console.log(`  coinCost    = ${(updated as any)?.coinCost ?? 'N/A'}`);
    console.log(`  refunded    = ${meta.refundedCoins ?? 0}`);

    return {
      label: spec.label,
      tier: spec.tier,
      targetDuration: spec.targetDuration,
      status: updated?.status,
      actualDuration: meta.durationSec,
      durationMet: meta.durationMet,
      delta: meta.durationDelta,
      motionClips: meta.motionClipCount,
      motionExpected: meta.motionExpected,
      motionVerified: meta.motionVerified,
      motionDowngraded: meta.motionDowngraded ?? false,
      failureReason: meta.failureReason,
    };
  } catch (e: any) {
    console.error(`========= ${spec.label} ERROR: ${e?.message?.slice(0, 200)} =========`);
    return { label: spec.label, tier: spec.tier, targetDuration: spec.targetDuration, status: 'error', error: e?.message?.slice(0, 200) };
  }
}

async function main() {
  const mode = process.argv[2];
  if (!mode || !['duration', 'motion', 'all'].includes(mode)) {
    console.error('Usage: tsx _testbatch.ts <duration|motion|all>');
    process.exit(1);
  }

  const specs = mode === 'duration' ? BATCH_A
    : mode === 'motion' ? BATCH_B
    : [...BATCH_A, ...BATCH_B];

  console.log(`\n🚀 Starting ${specs.length} test reels (mode=${mode})...\n`);

  // Run sequentially to avoid overwhelming providers
  const results: any[] = [];
  for (const spec of specs) {
    const r = await runOne(spec);
    results.push(r);
  }

  console.log('\n\n========================================');
  console.log('  FINAL RESULTS SUMMARY');
  console.log('========================================');
  for (const r of results) {
    if (mode === 'duration' || mode === 'all') {
      console.log(`${r.label} | status=${r.status} | target=${r.targetDuration}s | actual=${r.actualDuration ?? '?'}s | delta=${r.delta ?? '?'} | met=${r.durationMet ?? '?'} | motionClips=${r.motionClips ?? '?'}/${r.motionExpected ?? '?'}`);
    } else {
      console.log(`${r.label} | status=${r.status} | motionClips=${r.motionClips ?? '?'}/${r.motionExpected ?? '?'} | motionOK=${r.motionVerified ?? '?'} | downgraded=${r.motionDowngraded}`);
    }
  }

  if (mode === 'motion' || mode === 'all') {
    const motionResults = results.filter(r => r.motionExpected > 0);
    const totalScenes = motionResults.reduce((s, r) => s + (r.motionExpected ?? 0), 0);
    const gotScenes = motionResults.reduce((s, r) => s + Math.min(r.motionClips ?? 0, r.motionExpected ?? 0), 0);
    console.log(`\nMOTION AGGREGATE: ${gotScenes}/${totalScenes} scenes = ${totalScenes > 0 ? Math.round((gotScenes/totalScenes)*100) : 0}%`);
  }

  console.log('\n✅ ALL DONE');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
