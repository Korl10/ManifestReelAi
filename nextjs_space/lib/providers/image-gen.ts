import { Provider, ImageInput, ImageOutput } from './types';
import { uploadPublicBuffer, dataUrlToBuffer } from '@/lib/media-storage';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-5.4';

const STYLE_SUFFIX =
  'Ultra-detailed cinematic photograph, vertical 9:16 composition, dreamy ethereal spiritual atmosphere, ' +
  'volumetric god-rays, glowing particles and bokeh, luxurious gold and deep royal-purple color grade, ' +
  'soft film grain, shallow depth of field, hyper-real, awe-inspiring, premium, NO text, NO words, NO letters, NO watermark.';

async function generateOnce(prompt: string, apiKey: string): Promise<string> {
  // image_size 1024x1536 gives a tall vertical image compatible with OpenAI
  // models (aspect_ratio 9:16 is Gemini-only). The compositor crops to 1080x1920.
  const payload = {
    model: IMAGE_MODEL,
    messages: [{ role: 'user', content: `${prompt}. ${STYLE_SUFFIX}` }],
    modalities: ['image'],
    image_config: { image_size: '1024x1536', num_images: 1, quality: 'high' },
  };
  console.log(`[image-gen] request model=${IMAGE_MODEL} prompt="${prompt.slice(0, 100)}..."`);
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error(`[image-gen] API error ${res.status}: ${t.slice(0, 300)}`);
    throw new Error(`Image generation failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const images = data?.choices?.[0]?.message?.images ?? data?.choices?.[0]?.delta?.images ?? [];
  let url = images?.[0]?.image_url?.url ?? images?.[0]?.url ?? null;
  // Also check for an image URL in content (some models return it there)
  if (!url) {
    const content = data?.choices?.[0]?.message?.content ?? '';
    const urlMatch = content.match(/https?:\/\/[^\s"'\]]+\.(png|jpg|jpeg|webp)/i);
    if (urlMatch) url = urlMatch[0];
  }
  if (!url) {
    console.error('[image-gen] no image URL in response:', JSON.stringify(data).slice(0, 500));
    throw new Error('Image generation returned no image data.');
  }
  console.log(`[image-gen] response OK, url_type=${url.startsWith('data:') ? 'data_url' : 'http_url'}`);
  if (url.startsWith('data:')) {
    const { buffer, contentType } = dataUrlToBuffer(url);
    return uploadPublicBuffer(buffer, `scene.${contentType.includes('png') ? 'png' : 'jpg'}`, contentType);
  }
  // Regular URL: download, re-upload to our S3 for permanence.
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const ct = imgRes.headers.get('content-type') || 'image/jpeg';
  return uploadPublicBuffer(buf, `scene.${ct.includes('png') ? 'png' : 'jpg'}`, ct);
}

/**
 * Generate a single scene image with a few retries. The Abacus image endpoint
 * occasionally returns a transient 400/429/5xx under load; without retries a
 * single hiccup would otherwise force the whole reel onto bundled stills.
 */
async function generateOne(prompt: string, apiKey: string): Promise<string> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await generateOnce(prompt, apiKey);
    } catch (e) {
      lastErr = e;
      console.error(`[image-gen] attempt ${attempt + 1} failed: ${(e as any)?.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export class AbacusImageProvider implements Provider<ImageInput, ImageOutput> {
  getName(): string { return `AbacusImage(${IMAGE_MODEL})`; }
  estimateCost(input: ImageInput): number { return (input?.scenes?.length ?? 0) * 0.04; }

  async generate(input: ImageInput): Promise<ImageOutput> {
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) throw new Error('Image generation failed: ABACUSAI_API_KEY is not configured.');
    const scenes = input?.scenes ?? [];
    if (scenes.length === 0) throw new Error('Image generation failed: no scenes provided.');

    // Generate images with limited concurrency to balance speed and rate limits.
    const results: string[] = new Array(scenes.length);
    const concurrency = 3;
    let idx = 0;
    async function worker() {
      while (idx < scenes.length) {
        const i = idx++;
        results[i] = await generateOne(scenes[i].imagePrompt, apiKey!);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, scenes.length) }, () => worker()));

    return { sceneImageUrls: results, thumbnailUrl: results[0], provider: this.getName() };
  }
}
