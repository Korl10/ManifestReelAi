import { Provider, ScriptInput, ScriptOutput, ScriptScene, ScriptLine } from './types';
import { getMoodStyle } from './mood-styles';
import { speedValue } from '@/lib/voice-catalog';

const LLM_URL = 'https://apps.abacus.ai/v1/chat/completions';
const SCRIPT_MODEL = process.env.SCRIPT_MODEL || 'gpt-5.4';

// Average narration pacing (seconds per word) used to time scenes/captions.
const SEC_PER_WORD = 0.46;
const SCENE_PAD = 0.9;

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

// Map a requested reel length to a TOTAL spoken-word budget + line count.
//
// FIX A (duration discipline): we now budget words so the narration nearly
// FILLS the requested duration instead of landing 2.5s short. Landing short was
// the root cause of the "held final frame" dead zones — the pipeline dumped all
// the slack onto the last scene. We budget for (target - 0.8s) of speech: a tiny
// 0.8s headroom for the closing breath/fade, distributed (capped) across scenes
// by enforceDurationTarget so no single scene holds a frozen frame.
// Slow affirmation narration runs ~0.55s per word (including natural pauses).
const SEC_PER_SPOKEN_WORD = 0.55;
// `speed` is the ElevenLabs native speed multiplier (0.85 slow / 1.0 / 1.15 fast).
// Effective time-per-word scales inversely with speed, so the word budget scales
// directly with speed: a 7s reel at 0.85 needs ~15% LESS script than at 1.0, and
// at 1.15 it can fit ~15% MORE. This keeps the delivered duration on target.
function scriptPlanForDuration(targetDuration?: number, speed: number = 1.0): { affirmationLines: number; totalScenes: number; wordBudget: number } {
  const target = Math.min(60, Math.max(7, Math.round(targetDuration ?? 25)));
  const spd = Math.min(1.15, Math.max(0.85, speed || 1.0));
  // SHORT reels (free tier ~7s): a tight 3-scene plan (hook + 2 affirmations)
  // with a small word budget so the spoken narration lands WELL UNDER target.
  // The pipeline then extends the final scene to hit the exact target, so the
  // delivered MP4 reliably passes the ±1s duration gate. A 4-scene/16-word
  // script (the normal floor) spoke for ~8s and overran a 7s target.
  if (target <= 9) {
    // Short reels: fill close to target (target - 0.6s) so the final scene
    // never holds a long frozen frame on a tiny reel.
    const wordBudget = Math.max(9, Math.round(((target - 0.6) / SEC_PER_SPOKEN_WORD) * spd));
    return { affirmationLines: 2, totalScenes: 3, wordBudget };
  }
  const wordBudget = Math.max(16, Math.round(((target - 0.8) / SEC_PER_SPOKEN_WORD) * spd));
  const totalScenes = Math.max(4, Math.round(wordBudget / 7)); // ~7 words per scene incl. hook
  const affirmationLines = Math.max(3, totalScenes - 1);
  return { affirmationLines, totalScenes, wordBudget };
}

function buildPrompt(input: ScriptInput): string {
  const { prompt, platform, style, mood } = input;
  const { affirmationLines, totalScenes, wordBudget } = scriptPlanForDuration(input.targetDuration, speedValue(input.voicePreset));
  const target = Math.min(60, Math.max(7, Math.round(input.targetDuration ?? 25)));
  return `You are an elite short-form scriptwriter who has written hundreds of VIRAL manifestation, Law of Attraction, abundance and spiritual reels for Instagram Reels, TikTok and YouTube Shorts. You understand hooks, retention, emotional pacing and the hypnotic affirmation cadence that makes these videos go viral and get saved/shared.

Write a complete script for ONE vertical reel.

USER TOPIC: "${prompt}"
STYLE: ${style}
MOOD: ${mood || style}
PLATFORM: ${platform}

REQUIREMENTS:
- Open with a SCROLL-STOPPING hook (first 3 seconds). It must create curiosity, emotion or a bold promise. Speak directly to "you".
- LENGTH BUDGET (critical): this reel is narrated slowly and must fit in ${target} seconds. The ENTIRE narration (the hook PLUS every affirmation line combined) must total NO MORE THAN ${wordBudget} words. Going over ${wordBudget} words will make the video too long and is NOT allowed. Aim slightly under.
- Write EXACTLY ${affirmationLines} short affirmation/manifestation lines (in addition to the hook, for ${totalScenes} scenes total) that build an emotional arc: hook -> belief -> visualization -> identity shift -> command to the universe -> uplifting close. Do NOT write more than ${affirmationLines} lines.
- Each line MUST be SHORT (4-9 words), present tense, first or second person, emotionally charged, easy to narrate slowly. Favor brevity so the whole script stays within the ${wordBudget}-word budget.
- For EACH line (including the hook) write a richly detailed CINEMATIC image prompt for a text-to-image model. Each image prompt must describe a stunning, premium, photoreal vertical 9:16 scene that MATCHES the mood "${mood || style}". Visual style guidance for this mood: ${getMoodStyle(mood || style).sceneGuidance}. NO text, NO words, NO letters in the image. Keep a CONSISTENT visual style across all scenes that matches the mood — do NOT default to generic luxury/gold unless the mood calls for it. Vary compositions and subjects between scenes.
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

    // SAFETY NET: if the LLM ignored the word budget and the narration runs long,
    // drop TRAILING affirmation scenes (always keep the hook + first affirmation,
    // min 4 scenes) until total spoken words fit within ~1.15x the budget. This
    // guarantees the narration never overruns the requested duration; the pipeline
    // then pads/holds the final scene to land exactly on target.
    const { wordBudget, totalScenes: planScenes } = scriptPlanForDuration(input.targetDuration, speedValue(input.voicePreset));
    const minScenes = Math.max(3, planScenes); // short reels floor at 3 scenes, normal at 4+
    const totalWords = () => sceneSeeds.reduce((sum, s) => sum + wordCount(s.text), 0);
    while (sceneSeeds.length > minScenes && totalWords() > Math.round(wordBudget * 1.15)) {
      sceneSeeds.pop();
    }

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
