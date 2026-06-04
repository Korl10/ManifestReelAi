import { Provider, ImageInput, ImageOutput } from './types';
import { uploadPublicBuffer, dataUrlToBuffer } from '@/lib/media-storage';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';
// gpt-5.4 supports modalities:["image"] with 9:16 aspect ratio. Can also use
// flux_pro_ultra, nano_banana_pro, or gemini multimodal models via env override.
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-5.4';

const STYLE_SUFFIX =
  'Ultra-detailed cinematic photograph, vertical 9:16 composition, dreamy ethereal spiritual atmosphere, ' +
  'volumetric god-rays, glowing particles and bokeh, luxurious gold and deep royal-purple color grade, ' +
  'soft film grain, shallow depth of field, hyper-real, awe-inspiring, premium, NO text, NO words, NO letters, NO watermark.';

async function generateOne(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: 'user', content: `${prompt}. ${STYLE_SUFFIX}` }],
      modalities: ['image'],
      image_config: { aspect_ratio: '9:16', num_images: 1, quality: 'high', resolution: '2K' },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Image generation failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const images = data?.choices?.[0]?.message?.images ?? data?.choices?.[0]?.delta?.images ?? [];
  const url = images?.[0]?.image_url?.url;
  if (!url || !url.startsWith('data:')) throw new Error('Image generation returned no image data.');
  const { buffer, contentType } = dataUrlToBuffer(url);
  return uploadPublicBuffer(buffer, `scene.${contentType.includes('png') ? 'png' : 'jpg'}`, contentType);
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
