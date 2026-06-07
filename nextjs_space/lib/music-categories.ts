// ── Vol. 2 Music Category → metadata mapping ──────────────────────────
// Maps the 8 Suno track categories (1:1 with voice categories) to the
// mood / style / energy tags used by the smart matcher.

export const MUSIC_CATEGORIES = [
  'spiritual', 'luxury', 'motivational', 'mysterious',
  'historical', 'biblical', 'educated', 'meditation',
] as const;
export type MusicCategory = (typeof MUSIC_CATEGORIES)[number];

export interface CategoryMeta {
  mood: string[];
  style: string[];
  energy: string;   // default; can override per-track
  bpmRange: [number, number]; // default guess; user doc overrides
  description: string;
}

export const CATEGORY_MAP: Record<MusicCategory, CategoryMeta> = {
  spiritual: {
    mood: ['calm', 'grateful'],
    style: ['spiritual', 'meditation'],
    energy: 'low',
    bpmRange: [60, 90],
    description: 'Ethereal, sacred, devotional — yoga & prayer reels',
  },
  luxury: {
    mood: ['abundant'],
    style: ['luxury', 'wealth', 'law-of-attraction'],
    energy: 'mid',
    bpmRange: [80, 110],
    description: 'Opulent, sleek, aspirational — wealth & lifestyle reels',
  },
  motivational: {
    mood: ['empowered', 'inspired'],
    style: ['motivational', 'cinematic'],
    energy: 'high',
    bpmRange: [100, 140],
    description: 'Driving, powerful, uplifting — mindset & hustle reels',
  },
  mysterious: {
    mood: ['inspired'],
    style: ['cinematic', 'emotional'],
    energy: 'mid',
    bpmRange: [70, 100],
    description: 'Dark, enigmatic, atmospheric — hidden-truth reels',
  },
  historical: {
    mood: ['empowered'],
    style: ['cinematic', 'emotional'],
    energy: 'mid-high',
    bpmRange: [80, 120],
    description: 'Epic, orchestral, sweeping — history & legacy reels',
  },
  biblical: {
    mood: ['grateful', 'calm'],
    style: ['spiritual'],
    energy: 'low',
    bpmRange: [55, 85],
    description: 'Reverent, solemn, choral — scripture & devotion reels',
  },
  educated: {
    mood: ['inspired'],
    style: ['cinematic', 'modern'],
    energy: 'mid',
    bpmRange: [85, 115],
    description: 'Thoughtful, articulate, clean — knowledge & explainer reels',
  },
  meditation: {
    mood: ['calm'],
    style: ['meditation'],
    energy: 'low',
    bpmRange: [50, 75],
    description: 'Ambient, soothing, minimal — breathwork & mindfulness reels',
  },
};

// Parse a filename like "spiritual_03_ambient_peace.mp3"
export function parseTrackFilename(filename: string): {
  category: MusicCategory;
  sequence: number;
  slug: string;
  title: string;
} | null {
  // Strip extension
  const name = filename.replace(/\.[^.]+$/, '');
  // Pattern: {category}_{nn}_{descriptor}
  const match = name.match(/^([a-z]+)_(\d{1,3})_(.+)$/i);
  if (!match) return null;
  const rawCat = match[1].toLowerCase();
  const seq = parseInt(match[2], 10);
  const descriptor = match[3];
  if (!MUSIC_CATEGORIES.includes(rawCat as MusicCategory)) return null;
  // Build human title from descriptor: "ambient_peace" → "Ambient Peace"
  const title = descriptor
    .split(/[_-]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return {
    category: rawCat as MusicCategory,
    sequence: seq,
    slug: descriptor.toLowerCase().replace(/\s+/g, '_'),
    title,
  };
}
