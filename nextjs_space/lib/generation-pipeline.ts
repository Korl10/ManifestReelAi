import { prisma } from '@/lib/prisma';
import { getScriptProvider, getVoiceProvider, getMusicProvider, getVideoProvider, getRenderProvider } from '@/lib/providers';

const STEPS = ['script', 'voice', 'music', 'visuals', 'captions', 'rendering'] as const;
const STEP_PCT: Record<string, number> = { script: 15, voice: 35, music: 50, visuals: 70, captions: 85, rendering: 100 };

export async function runGenerationPipeline(jobId: string, reelId: string, userId: string): Promise<void> {
  try {
    const reel = await prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) throw new Error('Reel not found');

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    const watermark = tier === 'free';
    const costBreakdown: Record<string, number> = {};

    // Step 1: Script
    await updateJob(jobId, 'script', STEP_PCT['script']);
    const scriptProvider = getScriptProvider();
    costBreakdown['script_cost'] = scriptProvider.estimateCost({ prompt: reel.prompt, platform: reel.platform, style: reel.style });
    const script = await scriptProvider.generate({ prompt: reel.prompt, platform: reel.platform, style: reel.style });

    await prisma.reel.update({
      where: { id: reelId },
      data: {
        title: script.suggestedTitle,
        scriptJson: script as any,
        caption: script.caption,
        description: script.description,
        hashtags: script.hashtags,
      },
    });

    // Step 2: Voice
    await updateJob(jobId, 'voice', STEP_PCT['voice']);
    const voiceProvider = getVoiceProvider();
    costBreakdown['voice_cost'] = voiceProvider.estimateCost({ scriptText: script.rawText, voicePreset: reel.voice });
    const voice = await voiceProvider.generate({ scriptText: script.rawText, voicePreset: reel.voice });
    await prisma.reel.update({ where: { id: reelId }, data: { audioUrl: voice.audioUrl } });

    // Step 3: Music
    await updateJob(jobId, 'music', STEP_PCT['music']);
    const musicProvider = getMusicProvider();
    costBreakdown['music_cost'] = musicProvider.estimateCost({ mood: reel.mood, durationSec: voice.durationSec });
    const music = await musicProvider.generate({ mood: reel.mood, durationSec: voice.durationSec });
    await prisma.reel.update({ where: { id: reelId }, data: { musicUrl: music.musicUrl } });

    // Step 4: Visuals
    await updateJob(jobId, 'visuals', STEP_PCT['visuals']);
    const videoProvider = getVideoProvider();
    const themes = script.fullScript?.map((l: any) => l?.text ?? '').slice(0, 3) ?? [];
    costBreakdown['image_cost'] = videoProvider.estimateCost({ style: reel.style, mood: reel.mood, themes });
    const visuals = await videoProvider.generate({ style: reel.style, mood: reel.mood, themes });
    await prisma.reel.update({ where: { id: reelId }, data: { thumbnailUrl: visuals.thumbnailUrl } });

    // Step 5: Captions
    await updateJob(jobId, 'captions', STEP_PCT['captions']);
    await new Promise(r => setTimeout(r, 500)); // Simulated caption sync

    // Step 6: Render
    await updateJob(jobId, 'rendering', STEP_PCT['rendering']);
    const renderProvider = getRenderProvider();
    costBreakdown['render_cost'] = renderProvider.estimateCost({ voiceover: voice, music, visuals, timestamps: voice.timestamps, watermark });
    costBreakdown['storage_cost'] = 0.01;
    const render = await renderProvider.generate({ voiceover: voice, music, visuals, timestamps: voice.timestamps, watermark });

    const totalCost = Object.values(costBreakdown).reduce((a: number, b: number) => a + b, 0);

    await prisma.reel.update({
      where: { id: reelId },
      data: {
        videoUrl: render.videoUrl,
        status: 'ready',
        watermarked: watermark,
        costBreakdown,
        totalCost: Math.round(totalCost * 100) / 100,
      },
    });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'complete', currentStep: 'complete', progressPct: 100, completedAt: new Date() },
    });
  } catch (err: any) {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: err?.message ?? 'Unknown error' },
    }).catch(() => {});
    await prisma.reel.update({
      where: { id: reelId },
      data: { status: 'failed' },
    }).catch(() => {});
  }
}

async function updateJob(jobId: string, step: string, pct: number) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: step, currentStep: step, progressPct: pct, startedAt: new Date() },
  });
  // Simulate processing time
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
}
