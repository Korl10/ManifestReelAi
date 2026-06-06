/**
 * ManifestReel AI — Brand Presets ("Craft")
 *
 * Client-safe types, defaults, and tier helpers for reusable brand presets.
 * A preset locks in brand identity, watermark, subtitle style, voice, music,
 * visual style, and metadata defaults so a creator can produce on-brand reels
 * in one click.
 */

import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/lib/captions/subtitle-types';

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export const WATERMARK_POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'center', label: 'Center' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

export type WatermarkSize = 'S' | 'M' | 'L';
export const WATERMARK_SIZES: WatermarkSize[] = ['S', 'M', 'L'];

export type AspectRatio = '9:16' | '1:1' | '16:9';
export const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '9:16', label: '9:16 · Vertical' },
  { id: '1:1', label: '1:1 · Square' },
  { id: '16:9', label: '16:9 · Wide' },
];

export type PresetPlatform = 'reels' | 'tiktok' | 'shorts' | 'youtube';
export const PRESET_PLATFORMS: { id: PresetPlatform; label: string }[] = [
  { id: 'reels', label: 'Instagram Reels' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'shorts', label: 'YouTube Shorts' },
  { id: 'youtube', label: 'YouTube' },
];

export const REEL_LENGTHS: { id: number; label: string }[] = [
  { id: 15, label: '15s' },
  { id: 20, label: '20s' },
  { id: 25, label: '25s' },
  { id: 30, label: '30s' },
];

/** Library moods (must match lib/music-library LIBRARY_MOODS). */
export const PRESET_MUSIC_MOODS = [
  'abundant',
  'calm',
  'empowered',
  'grateful',
  'hype',
  'inspired',
  'joyful',
] as const;

/**
 * Full shape of a brand preset as consumed by the UI and reel form. Mirrors the
 * BrandPreset DB model (camelCase). `subtitleStyle` is the full subtitle preset.
 */
export interface BrandPreset {
  id: string;
  name: string;
  isDefault: boolean;
  usageCount: number;

  // Brand identity
  logoPath: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;

  // Watermark
  watermarkShow: boolean;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number; // 0-100
  watermarkSize: WatermarkSize;
  watermarkPulse: boolean; // subtle scale pulse every ~8s

  // Subtitle style
  subtitleStyle: SubtitleStyle;

  // Voice lock
  voiceId: string | null;
  voiceStability: number;
  voiceSimilarity: number;
  voiceTier: string;
  clonedVoiceId: string | null;

  // Music lock
  musicMoods: string[];
  musicStyles: string[];
  stingerEnabled: boolean;
  lockedTrackId: string | null;

  // Visual style lock
  modelTier: string;
  aspectRatio: AspectRatio;
  visualKeywords: string | null;
  motionDefault: boolean;
  subjectLock: boolean; // keep the same subject/look across all scenes (premium quality)

  // Metadata defaults
  defaultPlatform: PresetPlatform;
  defaultLength: number;
  ctaText: string | null;

  createdAt?: string;
  updatedAt?: string;
}

/** Editable form payload (no server-managed fields). */
export type BrandPresetInput = Omit<
  BrandPreset,
  'id' | 'usageCount' | 'createdAt' | 'updatedAt'
>;

/** A fresh preset with sensible on-brand defaults. */
export function emptyPreset(): BrandPresetInput {
  return {
    name: '',
    isDefault: false,
    logoPath: null,
    logoUrl: null,
    primaryColor: '#D4AF37',
    accentColor: '#7B2FBE',
    watermarkShow: true,
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 80,
    watermarkSize: 'M',
    watermarkPulse: false,
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    voiceId: 'female-aria',
    voiceStability: 0.5,
    voiceSimilarity: 0.75,
    voiceTier: 'multilingual',
    clonedVoiceId: null,
    musicMoods: [],
    musicStyles: [],
    stingerEnabled: false,
    lockedTrackId: null,
    modelTier: 'standard',
    aspectRatio: '9:16',
    visualKeywords: '',
    motionDefault: false,
    subjectLock: true,
    defaultPlatform: 'reels',
    defaultLength: 25,
    ctaText: '',
  };
}

/**
 * Per-tier brand-preset limits.
 *  free    → 0  (upgrade to unlock)
 *  pro     → 1
 *  premium → unlimited
 * (A future $99 mid-tier would map to 5; -1 == unlimited.)
 */
export function brandPresetLimit(tier?: string | null): number {
  switch ((tier ?? 'free').toLowerCase()) {
    case 'premium':
      return -1; // unlimited
    case 'pro':
      return 1;
    default:
      return 0;
  }
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/** Human-readable limit label for upgrade prompts. */
export function presetLimitLabel(tier?: string | null): string {
  const lim = brandPresetLimit(tier);
  if (lim < 0) return 'unlimited presets';
  if (lim === 0) return 'no presets';
  return `${lim} preset${lim > 1 ? 's' : ''}`;
}
