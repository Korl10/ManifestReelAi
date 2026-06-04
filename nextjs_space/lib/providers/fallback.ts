import { ScriptInput, ScriptOutput, ScriptScene, ScriptLine } from './types';
import { ensurePublicLocalAsset } from '@/lib/media-storage';

// Narration pacing (must match llm-script.ts for consistent caption sync).
const SEC_PER_WORD = 0.46;
const SCENE_PAD = 0.9;

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

// Curated affirmation templates with matching cinematic scene imagery.
const TEMPLATES: Record<string, { title: string; hook: string; hookImg: string; lines: { text: string; img: string }[] }> = {
  spiritual: {
    title: 'The Universe Is Listening',
    hook: 'The universe is conspiring in your favor right now.',
    hookImg: 'a vast cosmic night sky with a glowing golden planet rising over a serene mirror-like lake, soft nebula clouds, drifting light particles',
    lines: [
      { text: 'Feel the divine energy flowing through you.', img: 'silhouette of a person meditating on water under streams of golden light from the heavens, glowing aura' },
      { text: 'You are a being of infinite light and power.', img: 'a radiant human silhouette made of golden constellations standing in an ethereal galaxy, sacred geometry glowing softly' },
      { text: 'Every cell of your body vibrates with abundance.', img: 'macro of glowing golden energy particles swirling in a deep purple cosmic mist, bokeh light, dreamlike' },
      { text: 'The universe hears your deepest desires.', img: 'a tranquil temple floating among clouds at golden hour, beams of light, lotus flowers drifting' },
      { text: 'Trust the process. It is already on its way.', img: 'a glowing path of light winding through a magical misty forest with fireflies and god-rays at dawn' },
      { text: 'Open your heart and receive your blessings.', img: 'a luminous golden lotus blooming over calm reflective water, soft particles rising, purple and gold sky' },
    ],
  },
  wealth: {
    title: 'Wealth Flows To You',
    hook: 'Money flows to you easily and effortlessly.',
    hookImg: 'a luxurious golden waterfall of light cascading into a serene reflective pool, opulent, cinematic gold and emerald tones',
    lines: [
      { text: 'You are a powerful magnet for prosperity.', img: 'glowing golden magnetic energy field pulling streams of light, abstract luxury, deep gold bokeh' },
      { text: 'Abundance is your birthright. Claim it now.', img: 'a majestic golden palace gate opening to a sunrise over endless fields of light, regal and cinematic' },
      { text: 'Opportunities surround you everywhere.', img: 'countless glowing golden doors of light floating in a dreamy purple sky, surreal and inviting' },
      { text: 'Your wealth grows larger every single day.', img: 'a flourishing golden tree of light growing over calm water, glowing leaves drifting upward, magical' },
      { text: 'You are worthy of financial freedom.', img: 'a person standing on a mountain peak at golden sunrise arms open, radiant light, vast luxurious vista' },
      { text: 'Wealth consciousness is your natural state.', img: 'serene golden meditation scene with floating coins of light dissolving into stars, elegant and ethereal' },
    ],
  },
  motivational: {
    title: 'Everything Changes Today',
    hook: 'Today is the day everything changes for you.',
    hookImg: 'a lone figure climbing toward a brilliant sunrise over dramatic mountains, volumetric light, epic and inspiring',
    lines: [
      { text: 'You were not born to play small.', img: 'a powerful silhouette standing against a vast glowing sky with sweeping golden clouds, cinematic and bold' },
      { text: 'Inside you is a power the world has never seen.', img: 'a glowing heart of golden energy radiating light beams outward in a dark dramatic cosmos' },
      { text: 'Every setback is a setup for your comeback.', img: 'a phoenix of golden light rising from glowing embers against a deep purple sky, majestic' },
      { text: 'Champions are built when nobody is watching.', img: 'a solitary runner on a misty road at dawn, dramatic god-rays breaking through clouds, determined mood' },
      { text: 'Your potential is limitless. Believe it.', img: 'an endless staircase of light ascending into a radiant golden sky, surreal and uplifting' },
      { text: 'Rise up. Show up. Level up. Every day.', img: 'a triumphant figure at a mountain summit arms raised as the sun explodes over the horizon, epic glory' },
    ],
  },
  meditation: {
    title: 'Find Your Peace',
    hook: 'Find your center. Find your peace.',
    hookImg: 'a calm figure meditating on still water at twilight, soft mist, gentle glowing reflections, deeply serene',
    lines: [
      { text: 'Let go of all that no longer serves you.', img: 'soft glowing light dissolving into a tranquil misty lake at dawn, minimal and peaceful' },
      { text: 'With each breath you release all worry.', img: 'gentle waves of pastel light rippling across a serene sky, slow and calming, dreamy bokeh' },
      { text: 'You are grounded, centered, and at peace.', img: 'a glowing lotus floating on calm water surrounded by soft candlelight, zen and tranquil' },
      { text: 'The stillness within holds infinite wisdom.', img: 'a quiet starlit valley with a mirror-still lake reflecting the galaxy, profound serenity' },
      { text: 'Allow yourself to simply be, right now.', img: 'soft morning light filtering through a misty bamboo forest, gentle and meditative' },
      { text: 'Peace flows through every part of your being.', img: 'gentle golden ripples spreading across calm water at sunrise, soothing and infinite' },
    ],
  },
  default: {
    title: 'Your Reality Shifts Now',
    hook: 'Your reality is about to shift.',
    hookImg: 'a breathtaking cosmic doorway of golden light opening over a calm reflective ocean, magical and surreal',
    lines: [
      { text: 'Everything you desire is seeking you too.', img: 'streams of golden light flowing toward a glowing silhouette under a starlit purple sky' },
      { text: 'Align your energy with your highest vision.', img: 'concentric rings of glowing golden energy radiating in a deep cosmic space, harmonious' },
      { text: 'You are creating your dream life right now.', img: 'a dreamlike floating island bathed in golden light above the clouds at sunset, awe-inspiring' },
      { text: 'The universe rewards inspired action.', img: 'a glowing trail of stardust leading toward a radiant sunrise over mountains, hopeful and grand' },
      { text: 'Trust your journey. Every step has purpose.', img: 'a luminous path of light winding through an enchanted misty forest with fireflies, magical' },
      { text: 'Manifest it. Believe it. Receive it.', img: 'a radiant burst of golden light over a calm sea with rising particles, triumphant and ethereal' },
    ],
  },
};

const STYLE_HASHTAGS: Record<string, string[]> = {
  spiritual: ['#spiritualawakening', '#highervibration', '#divineguidance', '#souljourney', '#lightworker'],
  wealth: ['#wealthmindset', '#moneyaffirmations', '#abundancemindset', '#financialfreedom', '#prosperity'],
  motivational: ['#motivation', '#mindset', '#successmindset', '#levelup', '#nevergiveup'],
  meditation: ['#meditation', '#innerpeace', '#mindfulness', '#calmvibes', '#zenlife'],
  luxury: ['#luxurylife', '#abundanceliving', '#manifestluxury', '#richlife', '#opulence'],
  abundance: ['#abundance', '#manifestation', '#lawofattraction', '#manifest', '#attracting'],
};

function pickTemplate(style: string) {
  const s = (style || '').toLowerCase();
  if (TEMPLATES[s]) return TEMPLATES[s];
  for (const key of Object.keys(TEMPLATES)) {
    if (key !== 'default' && s.includes(key)) return TEMPLATES[key];
  }
  if (s.includes('money') || s.includes('rich') || s.includes('luxury') || s.includes('abundance')) return TEMPLATES.wealth;
  if (s.includes('calm') || s.includes('peace') || s.includes('sleep')) return TEMPLATES.meditation;
  return TEMPLATES.default;
}

/**
 * Build a complete, properly-timed template script (with per-scene cinematic
 * image prompts) when the LLM is unavailable. Mirrors the LLM provider schema.
 */
export function buildTemplateScript(input: ScriptInput): ScriptOutput {
  const tpl = pickTemplate(input.style);
  const seeds: { text: string; imagePrompt: string }[] = [{ text: tpl.hook, imagePrompt: tpl.hookImg }];
  for (const l of tpl.lines) seeds.push({ text: l.text, imagePrompt: l.img });

  let t = 0;
  const scenes: ScriptScene[] = seeds.map((s) => {
    const dur = Math.max(2.6, wordCount(s.text) * SEC_PER_WORD + SCENE_PAD);
    const start = t;
    const end = t + dur;
    t = end;
    return { text: s.text, imagePrompt: s.imagePrompt, startTime: +start.toFixed(2), endTime: +end.toFixed(2) };
  });

  const fullScript: ScriptLine[] = scenes.map((s) => ({ text: s.text, startTime: s.startTime, endTime: s.endTime }));
  const styleKey = (input.style || '').toLowerCase();
  const base = STYLE_HASHTAGS[styleKey] ?? STYLE_HASHTAGS['abundance'];
  const platformTag = input.platform === 'tiktok' ? '#tiktokviral' : input.platform === 'youtube' ? '#shorts' : '#reels';
  const hashtags = [...base, '#manifestation', '#lawofattraction', platformTag, '#manifestreel'].slice(0, 12);

  return {
    hook: tpl.hook,
    fullScript,
    scenes,
    caption: `${tpl.hook} \u2728`,
    description: `${tpl.hook} A powerful manifestation reel to align you with your highest vision. Save this and watch it daily.`,
    hashtags,
    suggestedTitle: tpl.title,
    rawText: scenes.map((s) => s.text).join(' '),
    estimatedDurationSec: +t.toFixed(2),
  };
}

// Map a style to a thematically-ordered set of bundled cinematic stills.
const STYLE_IMAGE_SETS: Record<string, string[]> = {
  spiritual: ['spiritual.jpg', 'law-of-attraction.jpg', 'meditation.jpg', 'abundance.jpg'],
  wealth: ['wealth.jpg', 'luxury.jpg', 'abundance.jpg', 'law-of-attraction.jpg'],
  luxury: ['luxury.jpg', 'wealth.jpg', 'abundance.jpg', 'spiritual.jpg'],
  motivational: ['motivational.jpg', 'spiritual.jpg', 'law-of-attraction.jpg', 'abundance.jpg'],
  meditation: ['meditation.jpg', 'spiritual.jpg', 'law-of-attraction.jpg', 'abundance.jpg'],
  abundance: ['abundance.jpg', 'law-of-attraction.jpg', 'wealth.jpg', 'spiritual.jpg'],
  'law of attraction': ['law-of-attraction.jpg', 'spiritual.jpg', 'abundance.jpg', 'meditation.jpg'],
};

const ALL_IMAGES = ['spiritual.jpg', 'law-of-attraction.jpg', 'abundance.jpg', 'meditation.jpg', 'wealth.jpg', 'luxury.jpg', 'motivational.jpg'];

/**
 * Fallback scene imagery: rehost bundled /public/styles stills to public S3 and
 * rotate them across the required number of scenes for visual variety.
 */
export async function fallbackSceneImages(style: string, sceneCount: number): Promise<string[]> {
  const s = (style || '').toLowerCase();
  let set = STYLE_IMAGE_SETS[s];
  if (!set) {
    for (const key of Object.keys(STYLE_IMAGE_SETS)) {
      if (s.includes(key)) { set = STYLE_IMAGE_SETS[key]; break; }
    }
  }
  if (!set) set = ALL_IMAGES;

  const urls: string[] = [];
  for (const name of set) {
    try {
      urls.push(await ensurePublicLocalAsset(`styles/${name}`, 'image/jpeg'));
    } catch (e) {
      console.error('Fallback image upload failed for', name, e);
    }
  }
  if (urls.length === 0) throw new Error('No fallback scene images available.');

  // Rotate to fill the scene count (avoid immediate repeats where possible).
  const out: string[] = [];
  for (let i = 0; i < sceneCount; i++) out.push(urls[i % urls.length]);
  return out;
}
