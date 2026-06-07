import { prisma } from '@/lib/prisma';
import { getScriptProvider, getImageProvider, getFluxImageProvider, getVoiceProvider, getMusicProvider, getVideoProvider } from '@/lib/providers';
import { resolveModelTier, getModelTier } from '@/lib/model-tiers';
import { reelCoinCost } from '@/lib/pricing';
import { refundCoins } from '@/lib/quota';
import { matchTrack, matchTrackAsync, getTrackById, getStingerById, defaultStinger, isCloudTrack } from '@/lib/music-library';
import { getFileUrl } from '@/lib/s3';
import { selectHeroScenes } from '@/lib/providers/motion-prompts';
import { buildTemplateScript, fallbackSceneImages } from '@/lib/providers/fallback';
import { estimateTimestamps } from '@/lib/providers/elevenlabs-voice';
import type { ExtendedVoiceInput } from '@/lib/providers/elevenlabs-voice';
import { transcribeWithWhisper } from '@/lib/providers/whisper';
import { compositeReel, extractPosterFrame, type WatermarkConfig, WM_SIZE_MAP } from '@/lib/compositor';
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
// MUST match the crossfade used by the compositor (lib/compositor.ts XFADE).
const PIPELINE_XFADE = 0.6;

/**
 * Per-scene minimum spoken span (seconds) WITHOUT breathing padding — the
 * floor below which we cannot shrink a scene without cutting actual speech.
 */
function speechSpansFromWords(lineTexts: string[], words: WordTimestamp[]): number[] {
  const out: number[] = [];
  let cursor = 0;
  for (let s = 0; s < lineTexts.length; s++) {
    const count = (lineTexts[s] || '').trim().split(/\s+/).filter(Boolean).length;
    const slice = words.slice(cursor, cursor + count);
    cursor += count;
    if (slice.length === 0) { out.push(1.2); continue; }
    const span = slice[slice.length - 1].end - slice[0].start;
    out.push(Math.max(1.0, +span.toFixed(2)));
  }
  return out;
}

/**
 * Enforce the requested duration target on the scene timeline.
 * Compositor final length T = sum(durations) - XFADE*(n-1). We solve for
 * sum(durations) = target + XFADE*(n-1):
 *   - Under target  -> hold/extend the FINAL scene (slow-zoom + music sustain).
 *   - Over target   -> shrink scene padding proportionally, never below the
 *                      spoken span of each scene (never cut narration).
 * Returns the adjusted durations plus whether the target is mathematically
 * reachable without cutting speech (gate enforces the actual rendered output).
 */
function enforceDurationTarget(
  sceneDurations: number[],
  speechFloors: number[],
  targetDur: number,
): { durations: number[]; predictedTimeline: number; fitFeasible: boolean } {
  const n = sceneDurations.length;
  if (n === 0) return { durations: sceneDurations, predictedTimeline: 0, fitFeasible: false };
  const xfadeTotal = PIPELINE_XFADE * Math.max(0, n - 1);
  const targetSum = targetDur + xfadeTotal; // sum of raw scene durations needed
  const durs = sceneDurations.slice();
  const curSum = durs.reduce((a, b) => a + b, 0);

  if (curSum <= targetSum) {
    // UNDER target: extend the final scene (held frame + slow zoom + ambient).
    durs[n - 1] = +(durs[n - 1] + (targetSum - curSum)).toFixed(2);
    const timeline = durs.reduce((a, b) => a + b, 0) - xfadeTotal;
    return { durations: durs, predictedTimeline: +timeline.toFixed(2), fitFeasible: true };
  }

  // OVER target: shrink the non-speech padding proportionally, floored at the
  // spoken span so we never cut narration.
  const floors = speechFloors.length === n ? speechFloors.slice() : durs.map((d) => Math.min(d, 1.5));
  const floorSum = floors.reduce((a, b) => a + b, 0);
  if (floorSum >= targetSum) {
    // Even at the speech floor we exceed target — cannot fit without cutting
    // speech. Use the floors (tightest possible); the gate decides pass/fail.
    return { durations: floors.map((d) => +d.toFixed(2)), predictedTimeline: +(floorSum - xfadeTotal).toFixed(2), fitFeasible: false };
  }
  const slack = curSum - floorSum;          // total shrinkable padding available
  const needShrink = curSum - targetSum;    // how much we must remove
  const ratio = needShrink / slack;          // 0..1 portion of padding to remove
  const fitted = durs.map((d, i) => +(d - (d - floors[i]) * ratio).toFixed(2));
  const timeline = fitted.reduce((a, b) => a + b, 0) - xfadeTotal;
  return { durations: fitted, predictedTimeline: +timeline.toFixed(2), fitFeasible: true };
}

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
  targetDuration?: number; // requested final reel length in seconds (15/20/25/30)
}

// Clamp + default the requested reel length. The output MUST land within ±1s.
export function resolveTargetDuration(v?: number): number {
  const n = Math.round(v ?? 25);
  if (!Number.isFinite(n)) return 25;
  // Floor of 5s still supported; the free tier uses 7s reels; paid tiers never
  // request below 15s (enforced by ALLOWED_LENGTHS in the generate route).
  return Math.min(60, Math.max(5, n));
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
    const isFree = isPreview || tier === 'free';
    // Legacy text-only watermark in captions (disabled when logo overlay is active
    // to avoid double-watermarking). Falls back to text if logo overlay fails.
    let watermark = isFree;

    // ---- Resolve watermark overlay config (Phase 4c) ----
    // Free tier: forced ManifestReel branded watermark.
    // Paid tier + preset + watermarkShow: user's logo watermark.
    // Paid tier without: no watermark.
    let watermarkConfig: WatermarkConfig | null = null;
    try {
      if (isFree) {
        // Force ManifestReel branded watermark for free-tier users.
        const brandedUrl = await ensurePublicLocalAsset('watermark/manifestreel-watermark.png', 'image/png');
        watermarkConfig = {
          logoUrl: brandedUrl,
          position: 'bottom-right',
          sizeFraction: WM_SIZE_MAP['M'] ?? 0.12,
          opacity: 50,
          fadeIn: true,
          pulse: false,
        };
        console.log('[pipeline] Free-tier: ManifestReel watermark forced.');
      } else if (reel.brandPresetId) {
        const preset = await prisma.brandPreset.findUnique({ where: { id: reel.brandPresetId } });
        if (preset && preset.watermarkShow && preset.logoUrl) {
          watermarkConfig = {
            logoUrl: preset.logoUrl,
            position: (preset.watermarkPosition as any) ?? 'bottom-right',
            sizeFraction: WM_SIZE_MAP[preset.watermarkSize] ?? WM_SIZE_MAP['M'],
            opacity: preset.watermarkOpacity ?? 80,
            fadeIn: true,
            pulse: !!(preset as any).watermarkPulse,
          };
          console.log(`[pipeline] Preset watermark: pos=${preset.watermarkPosition} size=${preset.watermarkSize} opacity=${preset.watermarkOpacity}`);
        }
      }
    } catch (e) {
      console.warn('[pipeline] watermark config error (continuing without logo overlay):', (e as any)?.message);
      // Fallback: pipeline continues without logo overlay — text watermark still fires for free tier.
    }
    // When we have a proper logo overlay, disable the text-only caption watermark
    // so users don't get double-branded.
    if (watermarkConfig) {
      watermark = false;
    }

    // Resolve the selected model tier (clamped to what this subscription can use).
    const modelTier = resolveModelTier(pipelineOpts?.modelTier, tier);
    // Requested final reel length — hard duration target enforced below.
    const targetDur = resolveTargetDuration(pipelineOpts?.targetDuration);
    console.log(`[pipeline] target duration = ${targetDur}s`);
    const wantsMotion = !isPreview && reel.motion === true && !!process.env.FAL_KEY;
    console.log(`[pipeline] model tier=${modelTier.id} (video=${modelTier.videoModel}, image=${modelTier.imageModel}), wantsMotion=${wantsMotion}`);

    // Subject lock (premium quality): keep the same subject/look across scenes.
    // Default ON for paid motion reels; a brand preset may override it.
    let subjectLock = wantsMotion;
    if (reel.brandPresetId) {
      try {
        const p = await prisma.brandPreset.findUnique({ where: { id: reel.brandPresetId }, select: { subjectLock: true } });
        if (p) subjectLock = !!p.subjectLock && wantsMotion;
      } catch { /* keep default */ }
    }
    console.log(`[pipeline] subjectLock=${subjectLock}`);

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
      script = await sp.generate({ prompt: reel.prompt, platform: reel.platform, style: reel.style, mood: reel.mood, targetDuration: targetDur, voicePreset: reel.voice });
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
      const imgInput = { scenes: script.scenes.map((s) => ({ imagePrompt: s.imagePrompt })), style: reel.style, mood: reel.mood, subjectLock };
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
    let motionExpected = 0;
    let motionVerified = false;
    let motionDowngraded = false;
    let motionHardFailed = false;
    costBreakdown['video_cost'] = 0;
    // A paid motion reel was promised: tier requested motion and we have a key.
    const motionAttempted = !isPreview && reel.motion === true && !!process.env.FAL_KEY;
    if (motionAttempted) {
      try {
        // Cinematic animates EVERY scene (no slideshow feel). Lower tiers
        // animate the hero scenes (hook + emotional peaks) to control cost.
        const maxMotion = modelTier.id === 'cinematic' ? sceneCount : 4;
        const heroIndices = selectHeroScenes(sceneCount, maxMotion);
        motionExpected = heroIndices.length;
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
        // reel still gets REAL motion (cheaper engine). This is a genuine
        // downgrade — we refund the price delta below.
        if (((motion as any).generatedCount ?? 0) === 0 && modelTier.id === 'cinematic') {
          console.warn('[pipeline] cinematic produced 0 clips, retrying with Kling 2.5 Turbo Pro');
          const fb = getVideoProvider('fal-ai/kling-video/v2.5-turbo/pro/image-to-video', 0.07);
          motion = await fb.generate({
            ...motionInput,
            videoModel: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
            videoPricePerSec: 0.07,
          });
          if (((motion as any).generatedCount ?? 0) > 0) motionDowngraded = true;
        }

        sceneClipUrls = motion.clipUrls;
        motionClipCount = (motion as any).generatedCount ?? motion.clipUrls.filter(Boolean).length;
        motionProviderName = motion.provider;
        costBreakdown['video_cost'] = (motion as any).cost ?? 0;
        console.log(`[pipeline] motion: ${motionClipCount}/${motionExpected} clips generated, provider=${motionProviderName}, downgraded=${motionDowngraded}, video_cost=$${costBreakdown['video_cost']}`);
      } catch (e) {
        console.error('[pipeline] motion generation failed, 0 clips:', (e as any)?.message);
        sceneClipUrls = undefined;
        motionClipCount = 0;
        costBreakdown['video_cost'] = 0;
      }
    }

    // Motion verification: a motion-tier reel MUST have at least one real clip.
    motionVerified = motionAttempted ? motionClipCount > 0 : false;
    if (motionAttempted && !motionVerified) motionHardFailed = true;

    // ----------------------------------------------------------------
    // GUARDRAIL — Motion render hard-fail (billing integrity)
    // A premium/cinematic reel that produced ZERO motion clips is NOT a
    // reel the user paid for. Fail loudly, refund ALL credits, alert admin,
    // and stop before spending more on voice/music/compositing.
    // ----------------------------------------------------------------
    if (motionHardFailed) {
      const refundAmt = reel.coinCost ?? 0;
      let refundedCoins = 0;
      try {
        refundedCoins = await refundCoins(userId, refundAmt, 'motion_render_failed');
      } catch (e) {
        console.error('[pipeline] refund failed during motion hard-fail:', (e as any)?.message);
      }
      console.error(`[ALERT][motion-fail] reel=${reelId} user=${userId} tier=${modelTier.id} expected=${motionExpected} clips=0 refunded=${refundedCoins} — Cinematic engines busy / silent fallback prevented.`);
      await prisma.reel.update({
        where: { id: reelId },
        data: {
          status: 'failed',
          coinCost: 0,
          scenesJson: {
            motionVerified: false,
            motionExpected,
            motionClipCount: 0,
            model_tier: modelTier.id,
            refundedCoins,
            failureReason: 'motion_render_failed',
          } as any,
        },
      }).catch(() => {});
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          currentStep: 'error',
          errorMessage: 'Cinematic engines were busy — your reel was not charged. Please try again in a few minutes, or switch to Standard for instant generation.',
        },
      }).catch(() => {});

      // Reset free-tier entitlement so a technical failure doesn't burn their one shot.
      if (tier === 'free' && userId) {
        await prisma.user.update({ where: { id: userId }, data: { freeReelUsed: false } }).catch(() => {});
        console.log(`[pipeline] cinematic-timeout: restored freeReelUsed=false for user=${userId}`);
      }
      return;
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
    const rawSceneDurations = voiceUrl
      ? sceneDurationsFromWords(lineTexts, words, fallbackDurs)
      : fallbackDurs;

    // ---- Duration guarantee: fit/extend the timeline to the requested target ----
    const speechFloors = voiceUrl
      ? speechSpansFromWords(lineTexts, words)
      : rawSceneDurations.map((d) => Math.max(1.0, d - 0.9));
    const naturalTimeline = +(rawSceneDurations.reduce((a, b) => a + b, 0) - PIPELINE_XFADE * Math.max(0, rawSceneDurations.length - 1)).toFixed(2);
    const { durations: sceneDurations, predictedTimeline, fitFeasible } = enforceDurationTarget(rawSceneDurations, speechFloors, targetDur);
    console.log(`[pipeline] duration fit: natural=${naturalTimeline}s -> target=${targetDur}s, predicted=${predictedTimeline}s, feasible=${fitFeasible}`);

    // ----------------------------------------------------------------
    // STEP 4 — Music
    // ----------------------------------------------------------------
    await updateJob(jobId, 'music', STEP_PCT['music']);
    const totalDur = sceneDurations.reduce((a, b) => a + b, 0);
    let musicUrlLocal = resolveReelAssets({ style: reel.style, mood: reel.mood, voice: reel.voice }).musicUrl;
    let musicPublicUrl: string | null = null;
    let musicTrackId: string | null = pipelineOpts?.musicTrackId ?? null;
    let musicSource: string | null = null; // 'curated_v1' | 'default' | 'custom' | 'legacy'
    costBreakdown['music_cost'] = 0; // curated library + custom uploads are $0/reel

    // 1) Explicit custom-music upload (db id that isn't in the static library).
    const libExplicit = musicTrackId ? getTrackById(musicTrackId) : null;
    if (musicTrackId && !libExplicit) {
      try {
        const cm = await prisma.customMusic.findUnique({ where: { id: musicTrackId } });
        if (cm && cm.userId === userId) {
          musicPublicUrl = await getFileUrl(cm.cloudStoragePath, cm.isPublic);
          musicUrlLocal = musicPublicUrl;
          musicSource = 'custom';
          console.log(`[pipeline] music: custom upload "${cm.name}" (${cm.id}) source=custom`);
        } else {
          musicTrackId = null; // not theirs / missing → fall through to matcher
        }
      } catch (e) {
        console.error('[pipeline] custom music lookup failed:', (e as any)?.message);
        musicTrackId = null;
      }
    }

    // 2) Curated library: explicit pick or the async smart matcher (includes Vol. 2 DB tracks).
    if (!musicPublicUrl) {
      const matched = libExplicit || await matchTrackAsync({ mood: reel.mood, style: reel.style, platform: reel.platform });
      if (matched) {
        musicTrackId = matched.id;
        musicSource = (matched as any).source ?? 'curated_v1';
        try {
          // V2 tracks already have cloud URLs; V1 tracks need ensurePublicLocalAsset
          if (isCloudTrack(matched)) {
            musicPublicUrl = matched.file;
          } else {
            musicPublicUrl = await ensurePublicLocalAsset(matched.file, 'audio/mpeg');
          }
          musicUrlLocal = matched.file;
          console.log(`[pipeline] music: matched "${matched.title}" (${matched.id}) source=${musicSource} mood=${reel.mood} bpm=${matched.bpm} energy=${matched.energy}`);
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
        musicSource = 'legacy';
        const m = await mp.generate({ mood: reel.mood, durationSec: totalDur });
        musicUrlLocal = m.musicUrl;
        musicPublicUrl = m.publicMusicUrl;
      } catch (e) {
        console.error('[pipeline] Music provider failed, using bundled default:', (e as any)?.message);
        try { musicPublicUrl = await ensurePublicLocalAsset(musicUrlLocal, 'audio/mpeg'); } catch { musicPublicUrl = null; }
      }
    }
    await prisma.reel.update({ where: { id: reelId }, data: { musicUrl: musicUrlLocal, musicTrackId: musicTrackId ?? undefined, musicSource: musicSource ?? undefined } });

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
        watermarkConfig,
        // Free tier is capped at 720p; paid tiers render at full 1080p.
        ...(isFree ? { width: 720, height: 1280 } : {}),
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

    // ----------------------------------------------------------------
    // GUARDRAIL — Duration validation gate (billing integrity)
    // The user selected a length; the delivered MP4 MUST be target ±1s.
    // If it isn't, fail loudly, refund ALL credits and alert admin rather
    // than charging full price for a short-delivered reel.
    // ----------------------------------------------------------------
    const durationDelta = +(finalDuration - targetDur).toFixed(2);
    // Standard duration guarantee for ALL tiers: the delivered MP4 must land
    // within ±1s of target. Free reels now use a tight 3-scene/short-word script
    // so narration lands under 7s and the pipeline extends the final scene to the
    // exact target — they pass this gate just like paid reels.
    const durationMet = Math.abs(durationDelta) <= 1;
    console.log(`[pipeline] duration check: target=${targetDur}s actual=${finalDuration.toFixed(2)}s delta=${durationDelta}s met=${durationMet} tier=${tier}`);
    if (!isPreview && !durationMet) {
      const refundAmt = reel.coinCost ?? 0;
      let refundedDur = 0;
      try {
        refundedDur = await refundCoins(userId, refundAmt, 'duration_check_failed');
      } catch (e) {
        console.error('[pipeline] refund failed during duration hard-fail:', (e as any)?.message);
      }
      console.error(`[ALERT][duration-fail] reel=${reelId} user=${userId} tier=${modelTier.id} target=${targetDur}s actual=${finalDuration.toFixed(2)}s delta=${durationDelta}s refunded=${refundedDur} — output failed duration guarantee, credits refunded.`);
      await prisma.reel.update({
        where: { id: reelId },
        data: {
          status: 'failed',
          coinCost: 0,
          durationSec: +finalDuration.toFixed(2),
          scenesJson: {
            durationMet: false,
            targetDuration: targetDur,
            durationDelta,
            model_tier: modelTier.id,
            refundedCoins: refundedDur,
            failureReason: 'duration_check_failed',
          } as any,
        },
      }).catch(() => {});
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          currentStep: 'error',
          errorMessage: 'Render failed duration check — credits refunded, please retry.',
        },
      }).catch(() => {});

      // Reset free-tier entitlement so a technical failure doesn't burn their one shot.
      if (tier === 'free' && userId) {
        await prisma.user.update({ where: { id: userId }, data: { freeReelUsed: false } }).catch(() => {});
        console.log(`[pipeline] duration-fail: restored freeReelUsed=false for user=${userId}`);
      }
      return;
    }

    // Downgrade refund: a cinematic reel that fell back to a cheaper engine
    // (real motion, but not the flagship the user paid for) is refunded the
    // price delta so we never charge cinematic price for pro-tier motion.
    let refundedCoins = 0;
    if (motionDowngraded && modelTier.id === 'cinematic') {
      const delta = reelCoinCost('cinematic', targetDur) - reelCoinCost('pro', targetDur);
      if (delta > 0) {
        try {
          refundedCoins = await refundCoins(userId, delta, 'motion_downgraded');
          console.warn(`[pipeline] motion downgraded cinematic→pro: refunded ${refundedCoins} coins (delta=${delta}) reel=${reelId}`);
        } catch (e) {
          console.error('[pipeline] downgrade refund failed:', (e as any)?.message);
        }
      }
    }

    const totalCost = Object.values(costBreakdown).reduce((a, b) => a + b, 0);
    console.log(`[pipeline] COST BREAKDOWN reel=${reelId}:`, JSON.stringify(costBreakdown), `TOTAL=$${totalCost.toFixed(4)}`);
    console.log(`[pipeline] PROVIDERS: script=${scriptProviderName} image=${imageProviderName} voice=${voiceProviderName} motion=${motionProviderName}(${motionClipCount}clips)`);

    // Real poster frame: grab the actual first frame of the FINAL rendered MP4
    // (subtitles + watermark baked in) so cards/player show real reel content,
    // not a generic style template. Best-effort: fall back to the scene image.
    let posterThumbUrl = thumbnailUrl;
    if (composited && finalVideoUrl) {
      const frame = await extractPosterFrame(finalVideoUrl);
      if (frame) {
        posterThumbUrl = frame;
        console.log(`[pipeline] poster frame extracted for reel=${reelId}`);
      } else {
        console.warn(`[pipeline] poster frame extraction failed reel=${reelId} — keeping scene image`);
      }
    }

    await prisma.reel.update({
      where: { id: reelId },
      data: {
        videoUrl: finalVideoUrl,
        thumbnailUrl: posterThumbUrl,
        audioUrl: voiceUrl,
        musicUrl: musicUrlLocal,
        musicTrackId: musicTrackId ?? undefined,
        musicSource: musicSource ?? undefined,
        durationSec: +finalDuration.toFixed(2),
        scenesJson: {
          composited,
          scriptProvider: scriptProviderName,
          imageProvider: imageProviderName,
          voiceProvider: voiceProviderName,
          motionProvider: motionProviderName,
          motionClipCount,
          motionExpected,
          motionVerified,
          motionDowngraded,
          refundedCoins,
          durationMet,
          targetDuration: targetDur,
          durationDelta,
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
        watermarked: watermark || !!watermarkConfig,
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
    // A free-tier reel that failed should NOT burn the user's single lifetime
    // free reel — restore their entitlement so they can retry.
    try {
      const r = await prisma.reel.findUnique({ where: { id: reelId }, select: { tier: true, userId: true } });
      if (r?.tier === 'free' && r.userId) {
        await prisma.user.update({ where: { id: r.userId }, data: { freeReelUsed: false } });
        console.log(`[pipeline] Free reel failed — restored freeReelUsed=false for user=${r.userId}`);
      }
    } catch { /* best-effort */ }
  }
}

async function updateJob(jobId: string, step: string, pct: number) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: step, currentStep: step, progressPct: pct, startedAt: new Date() },
  }).catch(() => {});
}
