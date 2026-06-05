import type { Provider, VideoClipInput, VideoClipOutput } from './types';
import { MOTION_THEMES, resolveMotionThemeFromPrompt } from './motion-prompts';

/**
 * For image-to-video, Kling already has the full visual content from the
 * source image — the prompt should describe ONLY the desired camera movement
 * and atmospheric animation. Re-sending the static scene description (which in
 * the manifestation niche is full of words like "divine", "sacred temple")
 * needlessly trips fal's content checker. So we send the clean motion-direction
 * template, themed from the image prompt's subject matter.
 */
function motionPromptFor(imagePrompt: string, style: string): string {
  const theme = resolveMotionThemeFromPrompt(imagePrompt, style);
  return MOTION_THEMES[theme];
}

/**
 * fal.ai image-to-video provider (Kling 2.5 Turbo Pro).
 *
 * Animates selected "hero" scene images into short cinematic motion clips
 * using fal.ai's async queue API. Designed to fail GRACEFULLY: any clip that
 * errors out (rate limit, timeout, credits exhausted) resolves to `null`, and
 * the compositor falls back to a Ken Burns still for that scene. The reel is
 * never blocked by motion generation.
 *
 * Pricing (Kling 2.5 Turbo Pro): $0.07/sec → $0.35 per 5s clip.
 */

const MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const QUEUE_BASE = 'https://queue.fal.run';
const PRICE_PER_SECOND = 0.07; // USD

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

interface SubmitResponse {
  request_id?: string;
  status_url?: string;
  response_url?: string;
}

async function submitClip(imageUrl: string, prompt: string, durationSec: number): Promise<SubmitResponse> {
  const duration = durationSec >= 10 ? '10' : '5';
  const body = {
    image_url: imageUrl,
    prompt,
    duration,
    cfg_scale: 0.35,
    negative_prompt: 'blur, distortion, low quality, warping, flicker, jitter',
  };
  console.log(`[fal.ai] SUBMIT model=${MODEL} duration=${duration}s prompt="${prompt.slice(0, 80)}..." image_url=${imageUrl.slice(0, 80)}...`);
  const res = await fetch(`${QUEUE_BASE}/${MODEL}`, {
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

async function pollClip(sub: SubmitResponse): Promise<string | null> {
  const statusUrl = sub.status_url || `${QUEUE_BASE}/${MODEL}/requests/${sub.request_id}/status`;
  const responseUrl = sub.response_url || `${QUEUE_BASE}/${MODEL}/requests/${sub.request_id}`;
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

async function generateOneClip(imageUrl: string, prompt: string, durationSec: number): Promise<string | null> {
  try {
    const sub = await submitClip(imageUrl, prompt, durationSec);
    const url = await pollClip(sub);
    console.log(`[fal.ai] CLIP COMPLETE request_id=${sub.request_id} video_url=${url ? url.slice(0, 80) + '...' : 'null'}`);
    return url;
  } catch (e) {
    console.error(`[fal.ai] CLIP FAILED (falling back to Ken Burns still): ${(e as any)?.message}`);
    return null;
  }
}

export class FalaiVideoProvider implements Provider<VideoClipInput, VideoClipOutput> {
  getName(): string {
    return 'fal-ai/kling-2.5-turbo-pro';
  }

  estimateCost(input: VideoClipInput): number {
    const per = (input.durationSec >= 10 ? 10 : 5) * PRICE_PER_SECOND;
    return +(input.heroIndices.length * per).toFixed(2);
  }

  async generate(input: VideoClipInput): Promise<VideoClipOutput> {
    const { sceneImageUrls, heroIndices, imagePrompts, style, durationSec } = input;
    const clipUrls: (string | null)[] = new Array(sceneImageUrls.length).fill(null);

    if (!process.env.FAL_KEY || heroIndices.length === 0) {
      return { clipUrls, generatedCount: 0, provider: this.getName(), cost: 0 };
    }

    const perClip = (durationSec >= 10 ? 10 : 5) * PRICE_PER_SECOND;

    // Process hero scenes with bounded concurrency.
    const queue = [...heroIndices];
    let generatedCount = 0;

    async function worker() {
      while (queue.length) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const imageUrl = sceneImageUrls[idx];
        if (!imageUrl) continue;
        const prompt = motionPromptFor(imagePrompts[idx] || '', style);
        const url = await generateOneClip(imageUrl, prompt, durationSec);
        if (url) {
          clipUrls[idx] = url;
          generatedCount += 1;
        }
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, heroIndices.length) }, () => worker());
    await Promise.all(workers);

    const cost = +(generatedCount * perClip).toFixed(2);
    return { clipUrls, generatedCount, provider: this.getName(), cost };
  }
}
