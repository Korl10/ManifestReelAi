/**
 * Per-theme cinematic motion prompt templates for fal.ai image-to-video.
 *
 * Each reel style maps to one of four cinematic motion themes:
 *   COSMIC   — galaxies, sacred geometry, starfields, divine light
 *   WEALTH   — gold, luxury, coins, crystals, opulent interiors
 *   WATER    — rivers, oceans, waterfalls, reflections, rain
 *   NATURE   — forests, gardens, sunrise, butterflies, fireflies
 *
 * The motion prompt is appended to (or replaces) the static image prompt
 * when generating an image-to-video clip via fal.ai (Kling / Veo).
 * It describes the desired CAMERA MOVEMENT and ATMOSPHERIC ANIMATION,
 * not the static scene itself (that's already in the image prompt).
 */

// ── Motion theme templates ───────────────────────────────────────

export const MOTION_THEMES = {
  cosmic: [
    'Slow cinematic camera push-in through cosmic space,',
    'gentle parallax on stars and nebula,',
    'softly drifting golden light particles,',
    'subtle lens glow pulsing in rhythm,',
    'sacred geometry slowly rotating,',
    'ethereal floating dust,',
    'serene weightless motion.',
  ].join(' '),

  wealth: [
    'Slow elegant dolly across the scene,',
    'warm golden light shimmer rippling over surfaces,',
    'fine gold particles drifting upward,',
    'soft sparkle highlights catching the light,',
    'gentle depth-of-field shift,',
    'luxurious slow-motion atmosphere,',
    'calm and rich.',
  ].join(' '),

  water: [
    'Gentle flowing water with realistic ripples and reflections,',
    'slow cinematic camera glide along the surface,',
    'soft mist and light spray particles,',
    'sun rays refracting on the water,',
    'calm rhythmic motion,',
    'dreamy slow-motion,',
    'peaceful and meditative.',
  ].join(' '),

  nature: [
    'Soft morning light rays filtering through trees,',
    'slow camera drift through the scene,',
    'gently swaying foliage,',
    'fluttering butterflies and floating fireflies,',
    'warm golden-hour glow,',
    'drifting pollen particles,',
    'tranquil and alive, slow cinematic feel.',
  ].join(' '),
} as const;

export type MotionTheme = keyof typeof MOTION_THEMES;

// ── Style → motion theme mapping ────────────────────────────────
// Maps each app-level reel style (lowercase) to the best-fit motion theme.

const STYLE_MOTION_MAP: Record<string, MotionTheme> = {
  spiritual: 'cosmic',
  'law of attraction': 'cosmic',
  'law-of-attraction': 'cosmic',
  wealth: 'wealth',
  luxury: 'wealth',
  abundance: 'wealth',
  meditation: 'water',
  motivational: 'nature',
};

/**
 * Resolve the motion theme for a given reel style.
 * Falls back to 'cosmic' (the most universally cinematic theme).
 */
export function resolveMotionTheme(style: string): MotionTheme {
  const s = (style || '').toLowerCase().trim();
  if (STYLE_MOTION_MAP[s]) return STYLE_MOTION_MAP[s];
  // Fuzzy matches
  if (s.includes('spirit') || s.includes('cosmic') || s.includes('attract') || s.includes('soul')) return 'cosmic';
  if (s.includes('wealth') || s.includes('rich') || s.includes('luxury') || s.includes('gold') || s.includes('abund') || s.includes('money')) return 'wealth';
  if (s.includes('water') || s.includes('ocean') || s.includes('flow') || s.includes('rain') || s.includes('meditat') || s.includes('calm') || s.includes('zen')) return 'water';
  if (s.includes('nature') || s.includes('forest') || s.includes('garden') || s.includes('sunrise') || s.includes('motiv')) return 'nature';
  return 'cosmic';
}

/**
 * Get the full cinematic motion prompt for a given reel style.
 */
export function getMotionPrompt(style: string): string {
  return MOTION_THEMES[resolveMotionTheme(style)];
}

/**
 * Build a complete image-to-video prompt by combining the scene's static
 * image description with the theme-appropriate motion instructions.
 *
 * This is the prompt that gets sent to fal.ai (Kling / Veo).
 */
export function buildMotionVideoPrompt(imagePrompt: string, style: string): string {
  const motion = getMotionPrompt(style);
  // The image prompt describes WHAT the scene shows;
  // the motion prompt describes HOW the camera moves and atmosphere animates.
  return `${imagePrompt.replace(/[.\s]+$/, '')}. ${motion}`;
}

/**
 * Given a reel's total scene count, decide which scene indices should
 * be animated with motion ("hero scenes") vs. kept as static Ken Burns.
 *
 * Strategy: animate the hook (scene 0), the emotional peak (~60% through),
 * and 1-2 other strategic beats. Cap at maxMotionScenes.
 *
 * Returns an array of 0-based scene indices to animate.
 */
export function selectHeroScenes(
  totalScenes: number,
  maxMotionScenes: number = 4,
): number[] {
  if (totalScenes <= 0) return [];
  if (totalScenes === 1) return [0];
  if (totalScenes <= maxMotionScenes) {
    // Animate all scenes when count is small
    return Array.from({ length: totalScenes }, (_, i) => i);
  }

  const heroes = new Set<number>();

  // Always animate the hook (first scene)
  heroes.add(0);

  // Emotional peak — roughly 60% through
  heroes.add(Math.round(totalScenes * 0.6));

  // A mid-point scene
  heroes.add(Math.round(totalScenes * 0.35));

  // The closer (last scene)
  heroes.add(totalScenes - 1);

  // Trim to maxMotionScenes, preferring earlier indices (hook is most important)
  const sorted = Array.from(heroes).sort((a, b) => a - b);
  return sorted.slice(0, maxMotionScenes);
}
