/**
 * Mood-specific visual style mappings for image generation.
 *
 * Each mood gets a distinct color palette, atmosphere, and visual language so
 * generated scenes actually match the user's intention rather than defaulting
 * to the same luxury-gold aesthetic for every reel.
 */

export interface MoodStyle {
  /** Appended to every image prompt sent to the generation model. */
  imageSuffix: string;
  /** Injected into the LLM script prompt to guide imagePrompt descriptions. */
  sceneGuidance: string;
}

const MOOD_STYLES: Record<string, MoodStyle> = {
  manifestation: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, warm natural light, ' +
      'sunrise tones and golden hour glow, soft lens flare, nature elements, gentle particles and bokeh, ' +
      'hopeful energy, diverse real-looking person or abstract energy visuals, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'warm, natural light, sunrise/golden-hour scenes, nature imagery (forests, fields, ocean horizons), ' +
      'diverse people or abstract energy visuals, hopeful and grounded aesthetic, soft warm color grade.',
  },
  meditation: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, calm serene atmosphere, ' +
      'soft blues and greens, zen garden elements, water reflections, minimal composition, ' +
      'gentle ambient light, misty depth, peaceful, tranquil, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'calm, minimal, zen gardens, still water, soft blues and greens, muted serene tones, ' +
      'misty landscapes, lotus flowers, smooth stones, peaceful meditation atmosphere.',
  },
  'wealth-frequency': {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, luxurious opulent atmosphere, ' +
      'gold and deep royal-purple color grade, glowing particles and bokeh, volumetric god-rays, ' +
      'affluence and abundance imagery, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, awe-inspiring, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'luxurious, gold, affluence, flowing liquid gold, crystal chandeliers, marble textures, ' +
      'velvet, premium objects, volumetric god-rays, opulent deep royal-purple and gold color grade.',
  },
  cinematic: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, dramatic lighting, ' +
      'wide establishing shots, film-grain aesthetic, high contrast, teal-and-orange color grade, ' +
      'moody atmosphere, volumetric haze, premium movie-quality, ' +
      'shallow depth of field, hyper-real, awe-inspiring, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'dramatic cinematic lighting, wide shots, film-grain look, high contrast, teal-and-orange grade, ' +
      'moody atmosphere, volumetric haze, epic landscapes, movie-quality framing.',
  },
  dreamy: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, soft focus ethereal atmosphere, ' +
      'pastel color palette, clouds and light, gentle lens flare, gossamer textures, ' +
      'floating particles, whimsical surreal beauty, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'soft focus, pastels (lavender, blush, sky-blue), clouds, ethereal light, gossamer textures, ' +
      'floating elements, whimsical surreal beauty, dreamlike haze.',
  },
  uplifting: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, bright vibrant atmosphere, ' +
      'sunshine and warm golden light, nature in bloom, movement and energy, cheerful colors, ' +
      'lens flare, dynamic composition, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'bright, vibrant, nature in bloom, sunlight bursting through trees, open sky, cheerful warm tones, ' +
      'movement and energy, flowers, birds in flight, dynamic optimistic compositions.',
  },
  powerful: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, bold high-contrast atmosphere, ' +
      'dark moody backgrounds, strong directional lighting, deep shadows, intense focused energy, ' +
      'metallic and obsidian textures, dramatic, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'bold, high-contrast, dark backgrounds, strong directional light, deep shadows, intense energy, ' +
      'metallic and obsidian textures, silhouettes, dramatic powerful imagery.',
  },
  serene: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, peaceful calm atmosphere, ' +
      'muted earthy tones, still water reflections, gentle horizon light, minimal composition, ' +
      'soft ambient glow, tranquil landscapes, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'peaceful landscapes, still water, gentle horizon light, muted earthy tones, minimal composition, ' +
      'mountains at dawn, calm seas, dew on leaves, serene and meditative.',
  },
  // Aliases / fallback for moods that may be spelled slightly differently.
  spiritual: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, ethereal spiritual atmosphere, ' +
      'sacred geometry, soft golden light rays, cosmic energy, glowing aura, lotus and mandala elements, ' +
      'volumetric god-rays, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'ethereal spiritual scenes, sacred geometry, soft golden light rays, cosmic elements, ' +
      'glowing aura, lotus, mandalas, mystical atmosphere, warm purple-gold tones.',
  },
  abundance: {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, rich abundant atmosphere, ' +
      'overflowing nature and golden light, blooming flowers, fruit, harvest, warm amber tones, ' +
      'radiant prosperity energy, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'overflowing abundance, blooming golden flowers, lush vibrant growth, radiant light, ' +
      'harvest scenes, amber and warm gold tones, prosperity and natural richness.',
  },
  'law-of-attraction': {
    imageSuffix:
      'Ultra-detailed cinematic photograph, vertical 9:16 composition, cosmic manifestation atmosphere, ' +
      'swirling galaxy energy, magnetic golden particles, mystical universe, star fields, ' +
      'aurora light, ethereal purple and gold, premium quality, ' +
      'soft film grain, shallow depth of field, hyper-real, NO text, NO words, NO letters, NO watermark.',
    sceneGuidance:
      'cosmic manifestation, swirling galaxy energy, magnetic golden particles, star fields, ' +
      'aurora light, mystical universe vibes, deep space with warm ethereal accents.',
  },
};

// Default fallback for unrecognized moods.
const DEFAULT_STYLE: MoodStyle = {
  imageSuffix:
    'Ultra-detailed cinematic photograph, vertical 9:16 composition, dreamy ethereal atmosphere, ' +
    'volumetric light rays, glowing particles and bokeh, rich warm color grade, ' +
    'soft film grain, shallow depth of field, hyper-real, awe-inspiring, premium, NO text, NO words, NO letters, NO watermark.',
  sceneGuidance:
    'stunning, premium, photoreal yet ethereal vertical 9:16 scenes, volumetric light, ' +
    'glowing particles, rich warm color grade, cinematic quality.',
};

/**
 * Resolve a mood string (case-insensitive, slug-safe) to its visual style config.
 * Falls back gracefully to a neutral cinematic style when the mood isn't mapped.
 */
export function getMoodStyle(mood?: string | null): MoodStyle {
  if (!mood) return DEFAULT_STYLE;
  // Normalize: lowercase, trim, replace underscores/spaces with hyphens.
  const key = mood.toLowerCase().trim().replace(/[_\s]+/g, '-');
  return MOOD_STYLES[key] ?? DEFAULT_STYLE;
}
