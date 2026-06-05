import type { Provider, VideoClipInput, VideoClipOutput } from './types';
import { buildHybridMotionPrompt } from './motion-prompts';

/**
 * Build a hybrid motion prompt: camera-movement template + 2-3 safe
 * mood/style vibe tokens (e.g. "warm golden hour, hopeful energy").
 * This ensures motion reflects the reel's emotional tone without
 * triggering fal.ai content-policy rejections.
 */
function motionPromptFor(imagePrompt: string, style: string, mood?: string): string {
  return buildHybridMotionPrompt(imagePrompt, style, mood);
}

/**
 * fal.ai image-to-video provider (model-aware).
 *
 * Animates selected "hero" scene images into short cinematic motion clips
 * using fal.ai's async queue API. The concrete model + per-second pricing come
 * from the selected MODEL TIER (Standard=Kling Turbo, Pro=Kling Turbo Pro,
 * Cinematic=Veo 3 Fast); if none is supplied it defaults to Kling 2.5 Turbo Pro.
 *
 * Designed to fail GRACEFULLY: any clip that errors out (rate limit, timeout,
 * credits exhausted, content policy) resolves to `null`, and the compositor
 * falls back to a Ken Burns still for that scene. The reel is never blocked.
 */

const DEFAULT_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const DEFAULT_PRICE_PER_SECOND = 0.07; // USD
const QUEUE_BASE = 'https://queue.fal.run';

// Limit concurrent fal.ai requests to stay friendly with rate limits.
const MAX_CONCURRENCY = 2;
// Max time to wait for a single clip before giving up (and falling back).
const CLIP_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 3_000;

function authHeader(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');
  return `Key ${key}`;
}

function isVeo3(model: string): boolean {
  return model.includes('veo3') || model.includes('veo-3');
}

interface SubmitResponse {
  request_id?: string;
  status_url?: string;
  response_url?: string;
}

async function submitClip(model: string, imageUrl: string, prompt: string, durationSec: number): Promise<SubmitResponse> {
  let body: Record<string, any>;
  if (isVeo3(model)) {
    // Veo 3 Fast (image-to-video): duration is a string like '8s'; we don't
    // want model-generated audio since we add our own voiceover + music.
    body = {
      image_url: imageUrl,
      prompt,
      duration: '8s',
      generate_audio: false,
      resolution: '720p',
    };
  } else {
    // Kling 2.5 Turbo (standard/pro): numeric-string duration + cfg/negative.
    const duration = durationSec >= 10 ? '10' : '5';
    body = {
      image_url: imageUrl,
      prompt,
      duration,
      cfg_scale: 0.35,
      negative_prompt: 'blur, distortion, low quality, warping, flicker, jitter',
    };
  }
  console.log(`[fal.ai] SUBMIT model=${model} prompt="${prompt.slice(0, 70)}..." image_url=${imageUrl.slice(0, 70)}...`);
  const res = await fetch(`${QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => '');
    console.error(`[fal.ai] SUBMIT FAILED ${res.status}: ${e.slice(0, 300)}`);
    throw new Error(`fal submit ${res.status}: ${e.slice(0, 200)}`);
  }
  const result = await res.json();
  console.log(`[fal.ai] SUBMIT OK request_id=${result.request_id} status_url=${result.status_url}`);
  return result;
}

async function pollClip(model: string, sub: SubmitResponse): Promise<string | null> {
  const statusUrl = sub.status_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}/status`;
  const responseUrl = sub.response_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}`;
  const deadline = Date.now() + CLIP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const sres = await fetch(statusUrl, { headers: { Authorization: authHeader() } });
    if (!sres.ok) continue;
    const sjson: any = await sres.json().catch(() => ({}));
    const status = sjson?.status;
    if (status === 'COMPLETED') {
      // The result can briefly 422 right after COMPLETED while fal finalizes
      // the payload — retry a few times before giving up.
      for (let r = 0; r < 6; r++) {
        const rres = await fetch(responseUrl, { headers: { Authorization: authHeader() } });
        if (rres.ok) {
          const rjson: any = await rres.json().catch(() => ({}));
          return rjson?.video?.url || rjson?.data?.video?.url || null;
        }
        const eb = await rres.text().catch(() => '');
        // Content-policy rejections are permanent — don't waste time retrying.
        if (rres.status === 422 || eb.includes('content_policy')) {
          throw new Error('fal content policy / unprocessable: ' + eb.slice(0, 120));
        }
        await new Promise((res) => setTimeout(res, 2_000));
      }
      throw new Error('fal result not ready after COMPLETED');
    }
    // IN_QUEUE / IN_PROGRESS → keep polling.
  }
  throw new Error('fal clip timed out');
}

async function generateOneClip(model: string, imageUrl: string, prompt: string, durationSec: number): Promise<string | null> {
  try {
    const sub = await submitClip(model, imageUrl, prompt, durationSec);
    const url = await pollClip(model, sub);
    console.log(`[fal.ai] CLIP COMPLETE request_id=${sub.request_id} video_url=${url ? url.slice(0, 80) + '...' : 'null'}`);
    return url;
  } catch (e) {
    console.error(`[fal.ai] CLIP FAILED (falling back to Ken Burns still): ${(e as any)?.message}`);
    return null;
  }
}

export class FalaiVideoProvider implements Provider<VideoClipInput, VideoClipOutput> {
  private readonly model: string;
  private readonly pricePerSec: number;

  constructor(model?: string, pricePerSec?: number) {
    this.model = model || DEFAULT_MODEL;
    this.pricePerSec = typeof pricePerSec === 'number' ? pricePerSec : DEFAULT_PRICE_PER_SECOND;
  }

  getName(): string {
    return `fal:${this.model}`;
  }

  private clipSeconds(durationSec: number): number {
    if (isVeo3(this.model)) return 8;
    return durationSec >= 10 ? 10 : 5;
  }

  estimateCost(input: VideoClipInput): number {
    const model = input.videoModel || this.model;
    const price = typeof input.videoPricePerSec === 'number' ? input.videoPricePerSec : this.pricePerSec;
    const secs = isVeo3(model) ? 8 : (input.durationSec >= 10 ? 10 : 5);
    return +(input.heroIndices.length * secs * price).toFixed(2);
  }

  async generate(input: VideoClipInput): Promise<VideoClipOutput> {
    const { sceneImageUrls, heroIndices, imagePrompts, style, mood, durationSec } = input;
    const model = input.videoModel || this.model;
    const price = typeof input.videoPricePerSec === 'number' ? input.videoPricePerSec : this.pricePerSec;
    const clipUrls: (string | null)[] = new Array(sceneImageUrls.length).fill(null);

    if (!process.env.FAL_KEY || heroIndices.length === 0) {
      return { clipUrls, generatedCount: 0, provider: this.getName(), cost: 0 };
    }

    const secs = isVeo3(model) ? 8 : (durationSec >= 10 ? 10 : 5);
    const perClip = secs * price;

    // Process hero scenes with bounded concurrency.
    const queue = [...heroIndices];
    let generatedCount = 0;

    async function worker() {
      while (queue.length) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const imageUrl = sceneImageUrls[idx];
        if (!imageUrl) continue;
        const prompt = motionPromptFor(imagePrompts[idx] || '', style, mood);
        const url = await generateOneClip(model, imageUrl, prompt, durationSec);
        if (url) {
          clipUrls[idx] = url;
          generatedCount += 1;
        }
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, heroIndices.length) }, () => worker());
    await Promise.all(workers);

    const cost = +(generatedCount * perClip).toFixed(2);
    return { clipUrls, generatedCount, provider: `fal:${model}`, cost };
  }
}
