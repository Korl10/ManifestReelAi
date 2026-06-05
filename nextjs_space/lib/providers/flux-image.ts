import { Provider, ImageInput, ImageOutput } from './types';
import { uploadPublicBuffer } from '@/lib/media-storage';

/**
 * fal.ai Flux text-to-image provider (model-aware).
 *
 * Used by the Standard / Pro / Cinematic model tiers (Flux 1.1 Pro vs Flux 1.1
 * Pro Ultra). Generates one vertical 9:16 still per scene via fal's async queue
 * API, downloads each result, and re-uploads to our S3 for permanence.
 *
 * Fails GRACEFULLY: any scene that errors resolves to null so the pipeline can
 * fill the gap (other Flux scenes, the Abacus image provider, or bundled stills).
 */

const DEFAULT_MODEL = 'fal-ai/flux-pro/v1.1';
const QUEUE_BASE = 'https://queue.fal.run';
const MAX_CONCURRENCY = 3;
const IMG_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

const STYLE_SUFFIX =
  'Ultra-detailed cinematic photograph, vertical 9:16 composition, dreamy ethereal atmosphere, ' +
  'volumetric light rays, glowing particles and bokeh, luxurious gold and deep royal-purple color grade, ' +
  'soft film grain, shallow depth of field, hyper-real, awe-inspiring, premium, no text, no words, no watermark.';

function authHeader(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');
  return `Key ${key}`;
}

interface SubmitResponse { request_id?: string; status_url?: string; response_url?: string; }

async function submitImage(model: string, prompt: string): Promise<SubmitResponse> {
  const body = {
    prompt: `${prompt}. ${STYLE_SUFFIX}`,
    aspect_ratio: '9:16',
    num_images: 1,
    output_format: 'jpeg',
    safety_tolerance: '5',
    enable_safety_checker: false,
  };
  const res = await fetch(`${QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => '');
    console.error(`[flux] SUBMIT FAILED ${res.status}: ${e.slice(0, 200)}`);
    throw new Error(`flux submit ${res.status}`);
  }
  return res.json();
}

async function pollImage(model: string, sub: SubmitResponse): Promise<string | null> {
  const statusUrl = sub.status_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}/status`;
  const responseUrl = sub.response_url || `${QUEUE_BASE}/${model}/requests/${sub.request_id}`;
  const deadline = Date.now() + IMG_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const sres = await fetch(statusUrl, { headers: { Authorization: authHeader() } });
    if (!sres.ok) continue;
    const sjson: any = await sres.json().catch(() => ({}));
    if (sjson?.status === 'COMPLETED') {
      for (let r = 0; r < 5; r++) {
        const rres = await fetch(responseUrl, { headers: { Authorization: authHeader() } });
        if (rres.ok) {
          const rjson: any = await rres.json().catch(() => ({}));
          return rjson?.images?.[0]?.url || rjson?.data?.images?.[0]?.url || null;
        }
        const eb = await rres.text().catch(() => '');
        if (rres.status === 422 || eb.includes('content_policy')) {
          throw new Error('flux content policy: ' + eb.slice(0, 120));
        }
        await new Promise((res) => setTimeout(res, 1_500));
      }
      throw new Error('flux result not ready after COMPLETED');
    }
  }
  throw new Error('flux image timed out');
}

async function generateOne(model: string, prompt: string): Promise<string | null> {
  try {
    const sub = await submitImage(model, prompt);
    const url = await pollImage(model, sub);
    if (!url) return null;
    // Re-upload to our S3 for permanence (fal URLs are temporary).
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    return uploadPublicBuffer(buf, `scene.${ct.includes('png') ? 'png' : 'jpg'}`, ct);
  } catch (e) {
    console.error(`[flux] scene FAILED: ${(e as any)?.message}`);
    return null;
  }
}

export class FluxImageProvider implements Provider<ImageInput, ImageOutput> {
  private readonly model: string;
  private readonly pricePerImage: number;

  constructor(model?: string, pricePerImage?: number) {
    this.model = model || DEFAULT_MODEL;
    this.pricePerImage = typeof pricePerImage === 'number' ? pricePerImage : 0.04;
  }

  getName(): string { return `flux:${this.model}`; }
  estimateCost(input: ImageInput): number { return +(((input?.scenes?.length ?? 0) * this.pricePerImage).toFixed(2)); }

  async generate(input: ImageInput): Promise<ImageOutput> {
    if (!process.env.FAL_KEY) throw new Error('Flux image generation failed: FAL_KEY not configured.');
    const scenes = input?.scenes ?? [];
    if (scenes.length === 0) throw new Error('Flux image generation failed: no scenes provided.');

    const results: (string | null)[] = new Array(scenes.length).fill(null);
    let idx = 0;
    const model = this.model;
    async function worker() {
      while (idx < scenes.length) {
        const i = idx++;
        results[i] = await generateOne(model, scenes[i].imagePrompt);
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, scenes.length) }, () => worker()));

    const ok = results.filter(Boolean) as string[];
    if (ok.length === 0) throw new Error('Flux returned no images.');
    // Return aligned array (nulls allowed); pipeline fills gaps.
    return { sceneImageUrls: results.map((r) => r ?? '') as string[], thumbnailUrl: ok[0], provider: this.getName() };
  }
}
