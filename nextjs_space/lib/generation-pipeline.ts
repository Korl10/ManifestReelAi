import { prisma } from '@/lib/prisma';
import { getScriptProvider, getImageProvider, getFluxImageProvider, getVoiceProvider, getMusicProvider, getVideoProvider } from '@/lib/providers';
import { resolveModelTier } from '@/lib/model-tiers';
import { matchTrack, getTrackById, getStingerById, defaultStinger } from '@/lib/music-library';
import { getFileUrl } from '@/lib/s3';
import { selectHeroScenes } from '@/lib/providers/motion-prompts';
import { buildTemplateScript, fallbackSceneImages } from '@/lib/providers/fallback';
import { estimateTimestamps } from '@/lib/providers/elevenlabs-voice';
import type { ExtendedVoiceInput } from '@/lib/providers/elevenlabs-voice';
import { transcribeWithWhisper } from '@/lib/providers/whisper';
import { compositeReel } from '@/lib/compositor';
import { ensurePublicLocalAsset } from '@/lib/media-storage';
import { resolveReelAssets } from '@/lib/reel-assets';
import type { ScriptOutput, WordTimestamp } from '@/lib/providers/types';
import type { SubtitleStyle } from '@/lib/captions/subtitle-types';

// Progress milestones for each pipeline stage.
const STEP_PCT: Record<string, number> = {
  script: 12,
  visuals: 45,
  voice: 60,
  music: 70,
  rendering: 90,
  complete: 100,
};

/**
 * Greedily map a flat word-timestamp list onto the ordered scene texts and
 * derive a real per-scene duration from the actual narration timing.
 */
function sceneDurationsFromWords(lineTexts: string[], words: WordTimestamp[], fallback: number[]): number[] {
  if (!words || words.length === 0) return fallback;
  const out: number[] = [];
  let cursor = 0;
  for (let s = 0; s < lineTexts.length; s++) {
    const count = (lineTexts[s] || '').trim().split(/\s+/).filter(Boolean).length;
    const slice = words.slice(cursor, cursor + count);
    cursor += count;
    if (slice.length === 0) { out.push(fallback[s] ?? 4); continue; }
    const start = slice[0].start;
    const end = slice[slice.length - 1].end;
    // Add a little breathing room before/after the line.
    const dur = Math.max(2.4, (end - start) + 0.7);
    out.push(+dur.toFixed(2));
  }
  return out;
}

export interface PipelineOptions {
  voiceTier?: string;      // flash | multilingual | turbo
  stability?: number;      // 0-1
  similarity?: number;     // 0-1
  subtitleStyle?: Partial<SubtitleStyle>;
  modelTier?: string;      // standard | pro | cinematic
  musicTrackId?: string;   // explicit library track id or custom-music db id
  stinger?: boolean;       // add intro/outro accent stinger
  stingerId?: string;      // explicit stinger id (optional; else platform default)
}

export async function runGenerationPipeline(
  jobId: string,
  reelId: string,
  userId: string,
  mode: 'full' | 'preview' = 'full',
  pipelineOpts?: PipelineOptions,
): Promise<void> {
  const costBreakdown: Record<string, number> = {};
  // Preview mode (free tier): build entirely from cached/sample assets with
  // NO live paid API calls (no LLM, no AI images, no premium voice).
  const isPreview = mode === 'preview';
  try {
    const reel = await prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) throw new Error('Reel not found');

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const tier = sub?.tier ?? 'free';
    const watermark = isPreview || tier === 'free';

    // Resolve the selected model tier (clamped to what this subscription can use).
    const modelTier = resolveModelTier(pipelineOpts?.modelTier, tier);
    const wantsMotion = !isPreview && reel.motion === true && !!process.env.FAL_KEY;
    console.log(`[pipeline] model tier=${modelTier.id} (video=${modelTier.videoModel}, image=${modelTier.imageModel}), wantsMotion=${wantsMotion}`);

    // ----------------------------------------------------------------
    // STEP 1 — Script (LLM, with template fallback)
    // ----------------------------------------------------------------
    await updateJob(jobId, 'script', STEP_PCT['script']);
    let script: ScriptOutput;
    let scriptProviderName = 'template';
    if (isPreview) {
      script = buildTemplateScript({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood });
      costBreakdown['script_cost'] = 0;
    } else try {
      const sp = getScriptProvider();
      script = await sp.generate({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood });
      scriptProviderName = sp.getName();
      costBreakdown['script_cost'] = sp.estimateCost({ prompt: reel.prompt, platform: reel.platform, style: reel.style });
    } catch (e) {
      console.error('[pipeline] LLM script failed, using template fallback:', (e as any)?.message);
      script = buildTemplateScript({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood });
      costBreakdown['script_cost'] = 0;
    }

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

    const lineTexts = script.scenes.map((s) => s.text);
    const sceneCount = script.scenes.length;
    console.log(`[pipeline] Script: ${sceneCount} scenes, hook="${script.hook?.slice(0, 60)}...", provider=${scriptProviderName}`);

    // ----------------------------------------------------------------
    // STEP 2 — Cinematic visuals (AI images, with bundled-still fallback)
    // ----------------------------------------------------------------
    await updateJob(jobId, 'visuals', STEP_PCT['visuals']);
    let sceneImageUrls: string[] = [];
    let imageProviderName = 'fallback-stills';
    if (isPreview) {
      sceneImageUrls = await fallbackSceneImages(reel.style, sceneCount);
      imageProviderName = 'fallback-stills';
      costBreakdown['image_cost'] = 0;
      console.log('[pipeline] Preview mode — using bundled stills (expected)');
    } else {
      const imgInput = { scenes: script.scenes.map((s) => ({ imagePrompt: s.imagePrompt })), style: reel.style, mood: reel.mood };
      let done = false;

      // TIER 1 — Flux (per model tier) for motion reels.
      if (wantsMotion) {
        try {
          const fip = getFluxImageProvider(modelTier.imageModel, modelTier.imagePricePerImage);
          console.log(`[pipeline] Generating ${sceneCount} images via ${fip.getName()}...`);
          const imgs = await fip.generate(imgInput);
          const ok = imgs.sceneImageUrls.filter(Boolean);
          if (ok.length >= Math.ceil(sceneCount / 2)) {
            // Fill any failed-scene gaps by cycling the successful Flux stills.
            sceneImageUrls = imgs.sceneImageUrls.map((u, i) => u || ok[i % ok.length]);
            imageProviderName = imgs.provider;
            costBreakdown['image_cost'] = (fip as any).estimateCost(imgInput);
            done = true;
            console.log(`[pipeline] Flux images OK: ${ok.length}/${sceneCount}, provider=${imageProviderName}, cost=$${costBreakdown['image_cost']}`);
          } else {
            console.warn(`[pipeline] Flux only produced ${ok.length}/${sceneCount} — falling back to Abacus images`);
          }
        } catch (e) {
          console.error('[pipeline] Flux image generation failed, falling back to Abacus:', (e as any)?.message);
        }
      }

      // TIER 2 — Abacus image generation (default for static reels + Flux fallback).
      if (!done) try {
        const ip = getImageProvider();
        console.log(`[pipeline] Generating ${sceneCount} AI images via ${ip.getName()}...`);
        const imgs = await ip.generate(imgInput);
        sceneImageUrls = imgs.sceneImageUrls.filter(Boolean);
        imageProviderName = imgs.provider;
        costBreakdown['image_cost'] = ip.estimateCost(imgInput);
        if (sceneImageUrls.length === 0) throw new Error('no images returned');
        done = true;
        console.log(`[pipeline] AI images OK: ${sceneImageUrls.length}/${sceneCount} generated, provider=${imageProviderName}, cost=$${costBreakdown['image_cost']}`);
      } catch (e) {
        console.error('[pipeline] ⚠ AI image generation FAILED, falling back to bundled stills:', (e as any)?.message);
      }

      // TIER 3 — Bundled stills.
      if (!done) {
        sceneImageUrls = await fallbackSceneImages(reel.style, sceneCount);
        imageProviderName = 'fallback-stills';
        costBreakdown['image_cost'] = 0;
      }
    }
    // Ensure one image per scene.
    if (sceneImageUrls.length < sceneCount) {
      const base = sceneImageUrls.length ? sceneImageUrls : await fallbackSceneImages(reel.style, sceneCount);
      sceneImageUrls = Array.from({ length: sceneCount }, (_, i) => base[i % base.length]);
    }
    const thumbnailUrl = sceneImageUrls[0];
    await prisma.reel.update({ where: { id: reelId }, data: { thumbnailUrl } });

    // ----------------------------------------------------------------
    // STEP 2.5 — Cinematic motion (HYBRID): animate only hero scenes
    // (hook + emotional peaks) into real video clips; everything else
    // stays a Ken Burns still. Premium-only, never in preview mode.
    // Fails gracefully: any clip that errors → Ken Burns still for it.
    // ----------------------------------------------------------------
    let sceneClipUrls: (string | null)[] | undefined;
    let motionProviderName = 'none';
    let motionClipCount = 0;
    costBreakdown['video_cost'] = 0;
    if (!isPreview && reel.motion && process.env.FAL_KEY) {
      try {
        const heroIndices = selectHeroScenes(sceneCount, 4);
        const motionInput = {
          sceneImageUrls,
          heroIndices,
          imagePrompts: script.scenes.map((s) => s.imagePrompt),
          style: reel.style,
          mood: reel.mood,
          durationSec: 5,
          videoModel: modelTier.videoModel,
          videoPricePerSec: modelTier.videoPricePerSec,
        };
        const vp = getVideoProvider(modelTier.videoModel, modelTier.videoPricePerSec);
        let motion = await vp.generate(motionInput);

        // Cinematic fallback: if the flagship model produced 0 clips (rate
        // limit / policy / outage), retry ONCE with Kling 2.5 Turbo Pro so the
        // reel still gets real motion. Reels never break.
        if (((motion as any).generatedCount ?? 0) === 0 && modelTier.id === 'cinematic') {
          console.warn('[pipeline] cinematic produced 0 clips, retrying with Kling 2.5 Turbo Pro');
          const fb = getVideoProvider('fal-ai/kling-video/v2.5-turbo/pro/image-to-video', 0.07);
          motion = await fb.generate({
            ...motionInput,
            videoModel: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
            videoPricePerSec: 0.07,
          });
        }

        sceneClipUrls = motion.clipUrls;
        motionClipCount = (motion as any).generatedCount ?? motion.clipUrls.filter(Boolean).length;
        motionProviderName = motion.provider;
        costBreakdown['video_cost'] = (motion as any).cost ?? 0;
        console.log(`[pipeline] motion: ${motionClipCount}/${heroIndices.length} hero clips generated, video_cost=$${costBreakdown['video_cost']}`);
      } catch (e) {
        console.error('[pipeline] motion generation failed, all scenes stay Ken Burns:', (e as any)?.message);
        sceneClipUrls = undefined;
        costBreakdown['video_cost'] = 0;
      }
    }

    // ----------------------------------------------------------------
    // STEP 3 — Voiceover (ElevenLabs; graceful null when no key)
    // ----------------------------------------------------------------
    await updateJob(jobId, 'voice', STEP_PCT['voice']);
    let voiceUrl: string | null = null;
    let words: WordTimestamp[] = [];
    let voiceProviderName = 'none';
    if (isPreview) {
      const est = estimateTimestamps(script.fullScript, script.rawText);
      words = est.timestamps;
      costBreakdown['voice_cost'] = 0;
    } else try {
      const vp = getVoiceProvider();
      const voiceInput: ExtendedVoiceInput = {
        scriptText: script.rawText,
        voicePreset: reel.voice,
        lines: script.fullScript,
        voiceTier: (pipelineOpts?.voiceTier as any) ?? undefined,
        stability: pipelineOpts?.stability,
        similarity: pipelineOpts?.similarity,
      };
      const v = await vp.generate(voiceInput);
      voiceUrl = v.audioUrl;
      words = v.timestamps;
      voiceProviderName = v.provider;
      costBreakdown['voice_cost'] = voiceUrl ? vp.estimateCost(voiceInput) : 0;

      // Whisper re-transcription for frame-accurate word timestamps
      if (voiceUrl && process.env.FAL_KEY) {
        try {
          const whisperResult = await transcribeWithWhisper(voiceUrl, v.durationSec);
          if (whisperResult.words.length > 0) {
            words = whisperResult.words;
            costBreakdown['whisper_cost'] = whisperResult.cost;
            console.log(`[pipeline] Whisper timestamps: ${whisperResult.words.length} words, cost=$${whisperResult.cost.toFixed(4)}`);
          }
        } catch (e) {
          console.warn('[pipeline] Whisper transcription failed, using ElevenLabs timestamps:', (e as any)?.message);
          costBreakdown['whisper_cost'] = 0;
        }
      }
    } catch (e) {
      console.error('[pipeline] Voice generation failed, continuing music-only:', (e as any)?.message);
      const est = estimateTimestamps(script.fullScript, script.rawText);
      words = est.timestamps;
      costBreakdown['voice_cost'] = 0;
    }
    if (!words || words.length === 0) {
      words = estimateTimestamps(script.fullScript, script.rawText).timestamps;
    }
    await prisma.reel.update({ where: { id: reelId }, data: { audioUrl: voiceUrl } });

    // Per-scene durations: lock to real narration timing when we have a voice.
    const fallbackDurs = script.scenes.map((s) => Math.max(2.4, s.endTime - s.startTime));
    const sceneDurations = voiceUrl
      ? sceneDurationsFromWords(lineTexts, words, fallbackDurs)
      : fallbackDurs;

    // ----------------------------------------------------------------
    // STEP 4 — Music
    // ----------------------------------------------------------------
    await updateJob(jobId, 'music', STEP_PCT['music']);
    const totalDur = sceneDurations.reduce((a, b) => a + b, 0);
    let musicUrlLocal = resolveReelAssets({ style: reel.style, mood: reel.mood, voice: reel.voice }).musicUrl;
    let musicPublicUrl: string | null = null;
    let musicTrackId: string | null = pipelineOpts?.musicTrackId ?? null;
    costBreakdown['music_cost'] = 0; // curated library + custom uploads are $0/reel

    // 1) Explicit custom-music upload (db id that isn't in the static library).
    const libExplicit = musicTrackId ? getTrackById(musicTrackId) : null;
    if (musicTrackId && !libExplicit) {
      try {
        const cm = await prisma.customMusic.findUnique({ where: { id: musicTrackId } });
        if (cm && cm.userId === userId) {
          musicPublicUrl = await getFileUrl(cm.cloudStoragePath, cm.isPublic);
          musicUrlLocal = musicPublicUrl;
          console.log(`[pipeline] music: custom upload "${cm.name}" (${cm.id})`);
        } else {
          musicTrackId = null; // not theirs / missing → fall through to matcher
        }
      } catch (e) {
        console.error('[pipeline] custom music lookup failed:', (e as any)?.message);
        musicTrackId = null;
      }
    }

    // 2) Curated library: explicit pick or the smart matcher.
    if (!musicPublicUrl) {
      const matched = libExplicit || matchTrack({ mood: reel.mood, style: reel.style, platform: reel.platform });
      if (matched) {
        musicTrackId = matched.id;
        try {
          musicPublicUrl = await ensurePublicLocalAsset(matched.file, 'audio/mpeg');
          musicUrlLocal = matched.file;
          console.log(`[pipeline] music: matched "${matched.title}" (${matched.id}) bpm=${matched.bpm} energy=${matched.energy}`);
        } catch (e) {
          console.error('[pipeline] matched track upload failed, using legacy provider:', (e as any)?.message);
          musicPublicUrl = null;
        }
      }
    }

    // 3) Legacy fallback (mood→bundled track) so a reel always has music.
    if (!musicPublicUrl) {
      try {
        const mp = getMusicProvider();
        const m = await mp.generate({ mood: reel.mood, durationSec: totalDur });
        musicUrlLocal = m.musicUrl;
        musicPublicUrl = m.publicMusicUrl;
      } catch (e) {
        console.error('[pipeline] Music provider failed, using bundled default:', (e as any)?.message);
        try { musicPublicUrl = await ensurePublicLocalAsset(musicUrlLocal, 'audio/mpeg'); } catch { musicPublicUrl = null; }
      }
    }
    await prisma.reel.update({ where: { id: reelId }, data: { musicUrl: musicUrlLocal } });

    // Optional intro/outro accent stinger (default OFF).
    let stingerPublicUrl: string | null = null;
    let stingerTrackId: string | null = null;
    if (pipelineOpts?.stinger) {
      const sting = getStingerById(pipelineOpts.stingerId || '') || defaultStinger(reel.platform);
      if (sting) {
        try {
          stingerPublicUrl = await ensurePublicLocalAsset(sting.file, 'audio/mpeg');
          stingerTrackId = sting.id;
          console.log(`[pipeline] stinger: "${sting.title}" (${sting.id})`);
        } catch (e) {
          console.error('[pipeline] stinger upload failed, skipping:', (e as any)?.message);
          stingerPublicUrl = null;
        }
      }
    }

    // ----------------------------------------------------------------
    // STEP 5 — Render / composite the final reel
    // ----------------------------------------------------------------
    await updateJob(jobId, 'rendering', STEP_PCT['rendering']);
    costBreakdown['render_cost'] = 0.02;
    costBreakdown['storage_cost'] = 0.01;

    let finalVideoUrl: string;
    let finalDuration = totalDur;
    let composited = false;
    try {
      const result = await compositeReel({
        sceneImageUrls,
        sceneDurations,
        lineTexts,
        words,
        voiceUrl,
        musicUrl: musicPublicUrl,
        stingerUrl: stingerPublicUrl,
        watermark,
        sceneClipUrls,
        subtitleStyle: pipelineOpts?.subtitleStyle,
      });
      finalVideoUrl = result.videoUrl;
      finalDuration = result.durationSec;
      composited = true;
    } catch (e) {
      console.error('[pipeline] Compositing failed, falling back to stock background:', (e as any)?.message);
      const assets = resolveReelAssets({ style: reel.style, mood: reel.mood, voice: reel.voice });
      finalVideoUrl = assets.videoUrl;
      composited = false;
    }

    const totalCost = Object.values(costBreakdown).reduce((a, b) => a + b, 0);
    console.log(`[pipeline] COST BREAKDOWN reel=${reelId}:`, JSON.stringify(costBreakdown), `TOTAL=$${totalCost.toFixed(4)}`);
    console.log(`[pipeline] PROVIDERS: script=${scriptProviderName} image=${imageProviderName} voice=${voiceProviderName} motion=${motionProviderName}(${motionClipCount}clips)`);

    await prisma.reel.update({
      where: { id: reelId },
      data: {
        videoUrl: finalVideoUrl,
        thumbnailUrl,
        audioUrl: voiceUrl,
        musicUrl: musicUrlLocal,
        durationSec: +finalDuration.toFixed(2),
        scenesJson: {
          composited,
          scriptProvider: scriptProviderName,
          imageProvider: imageProviderName,
          voiceProvider: voiceProviderName,
          motionProvider: motionProviderName,
          motionClipCount,
          model_tier: modelTier.id,
          music_track_id: musicTrackId,
          stinger_track_id: stingerTrackId,
          voice_tier: pipelineOpts?.voiceTier ?? null,
          scenes: script.scenes.map((s, i) => ({
            text: s.text,
            imageUrl: sceneImageUrls[i] ?? null,
            clipUrl: sceneClipUrls?.[i] ?? null,
            durationSec: sceneDurations[i] ?? null,
          })),
        } as any,
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
    console.error('[pipeline] fatal error:', err?.message, err?.stack);
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
  }).catch(() => {});
}
