import type { Provider, VideoClipInput, VideoClipOutput } from './types';
import { buildHybridMotionPrompt } from './motion-prompts';
import { modelQueue, modelFamily } from '@/lib/concurrency/model-queue';

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
 * RELIABILITY (Fix B):
 *  - Every fal request is gated by a GLOBAL per-model semaphore (modelQueue) so
 *    concurrent reels never saturate the shared fal.ai key.
 *  - submit + poll are wrapped in exponential backoff (4 attempts: 2/4/8/16s)
 *    that retries transient 429 / 5xx / timeout errors.
 *  - Each hero clip is retried ONCE end-to-end before giving up.
 *  - Per-reel concurrency is throttled (Veo 3 = 1, Kling = 2) with a small
 *    inter-submit delay so a single reel doesn't self-rate-limit.
 *
 * Content-policy (422) rejections are treated as PERMANENT and not retried.
 */

const DEFAULT_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const DEFAULT_PRICE_PER_SECOND = 0.07; // USD
const QUEUE_BASE = 'https://queue.fal.run';

// Max time to wait for a single clip before giving up one attempt.
const CLIP_TIMEOUT_MS = 240_000;
const POLL_INTERVAL_MS = 3_000;

// Exponential backoff schedule for transient failures (ms). 4 attempts total.
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000];
// End-to-end clip retries (a fresh submit+poll) before falling back.
const CLIP_RETRIES = 1;
// Small delay between submits within ONE reel so we don't burst the key.
const INTER_SUBMIT_DELAY_MS = 1_200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Jittered backoff for attempt N (0-based). */
function backoffDelay(attempt: number): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  return base + Math.floor(Math.random() * 1_000); // +0-1s jitter
}

function authHeader(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');
  return `Key ${key}`;
}

function isVeo3(model: string): boolean {
  return model.includes('veo3') || model.includes('veo-3');
}

/** A retryable error carries a flag so the caller knows to back off + retry. */
class RetryableError extends Error {
  retryable = true;
  constructor(msg: string) { super(msg); }
}
class PermanentError extends Error {
  retryable = false;
  constructor(msg: string) { super(msg); }
}

interface SubmitResponse {
  request_id?: string;
  status_url?: string;
  response_url?: string;
}

function buildBody(model: string, imageUrl: string, prompt: string, durationSec: number): Record<string, any> {
  if (isVeo3(model)) {
    return { image_url: imageUrl, prompt, duration: '8s', generate_audio: false, resolution: '720p' };
  }
  const duration = durationSec >= 10 ? '10' : '5';
  return {
    image_url: imageUrl,
    prompt,
    duration,
    cfg_scale: 0.35,
    negative_prompt: 'blur, distortion, low quality, warping, flicker, jitter',
  };
}

async function submitClip(model: string, imageUrl: string, prompt: string, durationSec: number): Promise<SubmitResponse> {
  const body = buildBody(model, imageUrl, prompt, durationSec);
  const res = await fetch(`${QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => '');
    const msg = `fal submit ${res.status}: ${e.slice(0, 200)}`;
    // 429 (rate limit) and 5xx (server) are transient -> retry. 4xx (except 429)
    // are usually permanent (bad request / policy).
    if (res.status === 429 || res.status >= 500) {
      console.warn(`[fal.ai] SUBMIT transient ${res.status} (will retry): ${e.slice(0, 160)}`);
      throw new RetryableError(msg);
    }
    console.error(`[fal.ai] SUBMIT permanent ${res.status}: ${e.slice(0, 200)}`);
    throw new PermanentError(msg);
  }
  const result = await res.json();
  console.log(`[fal.ai] SUBMIT OK model=${model} request_id=${result.request_id}`);
  return result;
}

async function pollClip(model: string, sub: SubmitResponse): Promise<string | null> {
  const statusUrl = sub.status_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}/status`;
  const responseUrl = sub.response_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}`;
  const deadline = Date.now() + CLIP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
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
        const lower = eb.toLowerCase();
        // Distinguish a genuine content/safety block (PERMANENT — retrying is
        // pointless and wastes credits) from a transient generation miss.
        const isPolicy =
          lower.includes('content_policy') || lower.includes('content policy') ||
          lower.includes('safety') || lower.includes('flagged') ||
          lower.includes('prohibited') || lower.includes('violat') ||
          lower.includes('nsfw') || lower.includes('not allowed');
        // Veo 3 frequently returns a 422 "The model did not generate the
        // expected output for this prompt. This may occur for several reasons"
        // even for perfectly benign prompts. This is a TRANSIENT generation
        // miss, not a policy block — a fresh submission usually succeeds. We
        // must retry it (this was previously misclassified as permanent and was
        // the #1 cause of cinematic all-or-fail render failures).
        const isTransientGenMiss =
          lower.includes('did not generate the expected output') ||
          lower.includes('may occur for several reasons') ||
          lower.includes('please try again');
        if (isPolicy && !isTransientGenMiss) {
          throw new PermanentError('fal content policy: ' + eb.slice(0, 160));
        }
        if (isTransientGenMiss) {
          // Bubble up so attemptClip resubmits a FRESH Veo 3 job (with backoff).
          throw new RetryableError('fal generation miss (model produced no output, will retry): ' + eb.slice(0, 160));
        }
        // Unknown 422 right after COMPLETED — likely a finalize race; retry the
        // result fetch a few times before bubbling up as retryable.
        await sleep(2_000);
      }
      throw new RetryableError('fal result not ready after COMPLETED');
    }
    if (status === 'FAILED' || status === 'ERROR') {
      throw new RetryableError('fal job reported FAILED');
    }
    // IN_QUEUE / IN_PROGRESS → keep polling.
  }
  // Timed out — transient under load, allow a fresh attempt.
  throw new RetryableError('fal clip timed out');
}

/**
 * One submit+poll cycle WITH exponential backoff over transient failures.
 * Each network attempt is gated by the global per-model semaphore so we never
 * exceed the concurrency ceiling for that model family.
 */
async function attemptClip(model: string, imageUrl: string, prompt: string, durationSec: number): Promise<string | null> {
  const family = modelFamily(model);
  let lastErr: any;
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    const release = await modelQueue.acquire(family);
    try {
      const sub = await submitClip(model, imageUrl, prompt, durationSec);
      const url = await pollClip(model, sub);
      return url;
    } catch (e: any) {
      lastErr = e;
      if (e instanceof PermanentError || e?.retryable === false) {
        // Don't retry permanent failures.
        throw e;
      }
      const delay = backoffDelay(attempt);
      console.warn(`[fal.ai] attempt ${attempt + 1}/${BACKOFF_MS.length} failed (${e?.message?.slice(0, 120)}); backoff ${delay}ms`);
      release(); // release before sleeping so others can proceed
      if (attempt < BACKOFF_MS.length - 1) await sleep(delay);
      continue;
    } finally {
      release();
    }
  }
  throw lastErr ?? new Error('fal clip failed after retries');
}

/**
 * Generate one hero clip with full reliability: backoff retries (attemptClip)
 * PLUS one end-to-end clip retry. Returns null only after everything is
 * exhausted (or a permanent policy rejection).
 */
async function generateOneClip(model: string, imageUrl: string, prompt: string, durationSec: number): Promise<string | null> {
  for (let tryNo = 0; tryNo <= CLIP_RETRIES; tryNo++) {
    try {
      const url = await attemptClip(model, imageUrl, prompt, durationSec);
      if (url) {
        console.log(`[fal.ai] CLIP COMPLETE model=${model} video_url=${url.slice(0, 70)}...`);
        return url;
      }
      console.warn(`[fal.ai] CLIP returned null url (try ${tryNo + 1}/${CLIP_RETRIES + 1})`);
    } catch (e: any) {
      if (e?.retryable === false) {
        console.error(`[fal.ai] CLIP permanent failure, no fallback retry: ${e?.message}`);
        return null;
      }
      console.error(`[fal.ai] CLIP failed (try ${tryNo + 1}/${CLIP_RETRIES + 1}): ${e?.message}`);
    }
    if (tryNo < CLIP_RETRIES) await sleep(backoffDelay(tryNo));
  }
  return null;
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

    // Per-reel internal concurrency: Veo 3 is the rate-limit-sensitive engine,
    // so a single reel submits its Veo 3 clips ONE at a time; Kling can do 2.
    // (The GLOBAL ceiling across all reels is enforced separately by modelQueue.)
    const perReelConcurrency = isVeo3(model) ? 1 : 2;

    const queue = [...heroIndices];
    let generatedCount = 0;
    let submitted = 0;

    const self = this;
    async function worker() {
      while (queue.length) {
        const idx = queue.shift();
        if (idx === undefined) break;
        const imageUrl = sceneImageUrls[idx];
        if (!imageUrl) continue;
        // Stagger submits within the reel to avoid a self-inflicted burst.
        if (submitted > 0) await sleep(INTER_SUBMIT_DELAY_MS);
        submitted += 1;
        const prompt = motionPromptFor(imagePrompts[idx] || '', style, mood);
        const url = await generateOneClip(model, imageUrl, prompt, durationSec);
        if (url) {
          clipUrls[idx] = url;
          generatedCount += 1;
        }
      }
    }

    const workers = Array.from({ length: Math.min(perReelConcurrency, heroIndices.length) }, () => worker());
    await Promise.all(workers);

    const cost = +(generatedCount * perClip).toFixed(2);
    return { clipUrls, generatedCount, provider: `fal:${model}`, cost };
  }
}
