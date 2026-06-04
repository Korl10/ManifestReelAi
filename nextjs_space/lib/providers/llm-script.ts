import { Provider, ScriptInput, ScriptOutput, ScriptScene, ScriptLine } from './types';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';
const SCRIPT_MODEL = process.env.SCRIPT_MODEL || 'gpt-5.4';

// Average narration pacing (seconds per word) used to time scenes/captions.
const SEC_PER_WORD = 0.46;
const SCENE_PAD = 0.9;

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

function buildPrompt(input: ScriptInput): string {
  const { prompt, platform, style, mood } = input;
  return `You are an elite short-form scriptwriter who has written hundreds of VIRAL manifestation, Law of Attraction, abundance and spiritual reels for Instagram Reels, TikTok and YouTube Shorts. You understand hooks, retention, emotional pacing and the hypnotic affirmation cadence that makes these videos go viral and get saved/shared.

Write a complete script for ONE vertical reel.

USER TOPIC: "${prompt}"
STYLE: ${style}
MOOD: ${mood || style}
PLATFORM: ${platform}

REQUIREMENTS:
- Open with a SCROLL-STOPPING hook (first 3 seconds). It must create curiosity, emotion or a bold promise. Speak directly to "you".
- Then 5 to 6 short, powerful affirmation/manifestation lines that build an emotional arc: hook -> belief -> visualization -> identity shift -> command to the universe -> uplifting close.
- Each line MUST be short (6-12 words), present tense, first or second person, emotionally charged, easy to narrate slowly.
- For EACH line (including the hook) write a richly detailed CINEMATIC image prompt for a text-to-image model. Each image prompt must describe a stunning, premium, photoreal yet ethereal vertical 9:16 spiritual scene (e.g. glowing magical rivers, cosmic skies with planets, golden light, fireflies, lotus, sacred geometry, abundance, water reflections, particles, volumetric god-rays, cinematic color grade). NO text, NO words, NO letters in the image. Keep a consistent dreamy, luxurious, cinematic aesthetic across all scenes.
- Write a platform caption (1-2 sentences + a few emojis) and a longer description.
- Provide 12 highly relevant, high-reach hashtags (mix broad + niche), each starting with #, no spaces.

Return RAW JSON ONLY (no markdown, no code fences) in EXACTLY this schema:
{
  "suggestedTitle": "short title (max 6 words)",
  "hook": "the opening hook line",
  "hookImagePrompt": "cinematic image prompt for the hook scene",
  "lines": [
    { "text": "affirmation line", "imagePrompt": "cinematic image prompt" }
  ],
  "caption": "platform caption with emojis",
  "description": "longer description",
  "hashtags": ["#tag1", "#tag2"]
}`;
}

export class LLMScriptProvider implements Provider<ScriptInput, ScriptOutput> {
  getName(): string { return `LLMScript(${SCRIPT_MODEL})`; }
  estimateCost(): number { return 0.02; }

  async generate(input: ScriptInput): Promise<ScriptOutput> {
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) throw new Error('LLM script generation failed: ABACUSAI_API_KEY is not configured.');

    const res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: SCRIPT_MODEL,
        messages: [{ role: 'user', content: buildPrompt(input) }],
        max_tokens: 2200,
        temperature: 0.9,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`LLM script generation failed (${res.status}): ${t.slice(0, 300)}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('LLM script generation failed: could not parse JSON response.');
      parsed = JSON.parse(m[0]);
    }

    const hook: string = (parsed.hook || '').toString().trim();
    const hookImagePrompt: string = (parsed.hookImagePrompt || parsed.hook_image_prompt || '').toString().trim();
    const rawLines: any[] = Array.isArray(parsed.lines) ? parsed.lines : [];

    // Build the ordered scene list: hook first, then each affirmation line.
    const sceneSeeds: { text: string; imagePrompt: string }[] = [];
    if (hook) sceneSeeds.push({ text: hook, imagePrompt: hookImagePrompt || hook });
    for (const l of rawLines) {
      const text = (l?.text || '').toString().trim();
      if (!text) continue;
      sceneSeeds.push({ text, imagePrompt: (l?.imagePrompt || l?.image_prompt || text).toString().trim() });
    }
    if (sceneSeeds.length === 0) throw new Error('LLM script generation failed: empty script returned.');

    // Time the scenes by word count.
    let t = 0;
    const scenes: ScriptScene[] = sceneSeeds.map((s) => {
      const dur = Math.max(2.6, wordCount(s.text) * SEC_PER_WORD + SCENE_PAD);
      const start = t;
      const end = t + dur;
      t = end;
      return { text: s.text, imagePrompt: s.imagePrompt, startTime: +start.toFixed(2), endTime: +end.toFixed(2) };
    });

    const fullScript: ScriptLine[] = scenes.map((s) => ({ text: s.text, startTime: s.startTime, endTime: s.endTime }));
    const rawText = scenes.map((s) => s.text).join(' ');
    const hashtags: string[] = (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
      .map((h: any) => h.toString().trim())
      .filter(Boolean)
      .map((h: string) => (h.startsWith('#') ? h : `#${h}`))
      .slice(0, 15);

    return {
      hook: hook || scenes[0].text,
      fullScript,
      scenes,
      caption: (parsed.caption || '').toString().trim() || `${hook} \u2728`,
      description: (parsed.description || '').toString().trim(),
      hashtags: hashtags.length ? hashtags : ['#manifestation', '#lawofattraction', '#abundance'],
      suggestedTitle: (parsed.suggestedTitle || parsed.title || hook || 'Manifestation').toString().trim().slice(0, 60),
      rawText,
      estimatedDurationSec: +t.toFixed(2),
    };
  }
}
