/**
 * ManifestReel AI — Subtitle Style Types
 *
 * All configuration types for the enhanced subtitle system.
 */

export type SubtitleAnimation = 'pop' | 'fade-in' | 'typewriter' | 'karaoke' | 'slide-up' | 'bounce';

export type SubtitlePosition = 'top' | 'center' | 'bottom';

export type PlatformSafeZone = 'reels' | 'tiktok' | 'shorts' | 'none';

export interface SubtitleStyle {
  // Master toggle
  subtitlesEnabled: boolean;    // default true; when false, no subtitles are burned

  // Font
  fontFamily: string;           // one of SUBTITLE_FONTS
  fontSize: number;             // in ASS units (default 72)

  // Colors (hex #RRGGBB)
  textColor: string;            // default #FFFFFF
  activeWordColor: string;      // for karaoke highlight, default #7B2FBE

  // Stroke/outline
  strokeColor: string;          // default #000000
  strokeWidth: number;          // 0-8, default 4

  // Highlight box
  highlightEnabled: boolean;    // background box behind text
  highlightColor: string;       // default #000000
  highlightOpacity: number;     // 0-100, default 60

  // Drop shadow
  shadowEnabled: boolean;       // default false (off)
  shadowColor: string;          // default #000000
  shadowDepth: number;          // 0-8, default 2
  shadowOpacity: number;        // 0-100, default 60

  // Animation
  animation: SubtitleAnimation; // default 'karaoke'

  // Position
  position: SubtitlePosition;   // default 'bottom'
  customYOffset: number;        // additional Y offset in pixels (from base position)

  // Platform safe zone
  platform: PlatformSafeZone;   // affects MarginV to avoid platform UI overlays

  // Auto line-break settings
  maxCharsPerLine: number;      // default 32
  maxLines: number;             // default 2
  wordsPerPhrase: number;       // how many words shown at once, default 3
}

/** Available fonts for subtitles (ASS-compatible names). */
export const SUBTITLE_FONTS = [
  'Inter',
  'Poppins',
  'Bebas Neue',
  'Montserrat',
  'Anton',
  'Oswald',
  'Playfair Display',
  'Roboto Condensed',
  'Archivo Black',
  'Karla',
  'Lato',
  'Raleway',
  'Open Sans',
  'Bangers',
  'DM Sans',
] as const;

/** Default subtitle style. */
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  subtitlesEnabled: true,
  fontFamily: 'DM Sans',
  fontSize: 72,
  textColor: '#FFFFFF',
  activeWordColor: '#7B2FBE',
  strokeColor: '#000000',
  strokeWidth: 4,
  highlightEnabled: false,
  highlightColor: '#000000',
  highlightOpacity: 60,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowDepth: 2,
  shadowOpacity: 60,
  animation: 'karaoke',
  position: 'bottom',
  customYOffset: 0,
  platform: 'none',
  maxCharsPerLine: 32,
  maxLines: 2,
  wordsPerPhrase: 3,
};

/** Animation presets with descriptions. */
export const ANIMATION_PRESETS: { value: SubtitleAnimation; label: string; desc: string }[] = [
  { value: 'karaoke', label: 'Karaoke', desc: 'Word-by-word highlight (viral style)' },
  { value: 'pop', label: 'Pop', desc: 'Words pop in with scale' },
  { value: 'fade-in', label: 'Fade In', desc: 'Smooth fade entrance' },
  { value: 'typewriter', label: 'Typewriter', desc: 'Characters appear one by one' },
  { value: 'slide-up', label: 'Slide Up', desc: 'Text slides up from below' },
  { value: 'bounce', label: 'Bounce', desc: 'Bouncy entrance effect' },
];

/**
 * Platform-specific safe zone margins (bottom % of 1920px frame).
 * These keep subtitles above platform UI elements.
 */
export const PLATFORM_SAFE_MARGINS: Record<PlatformSafeZone, number> = {
  reels: Math.round(1920 * 0.18),    // 346px from bottom
  tiktok: Math.round(1920 * 0.18),   // 346px from bottom
  shorts: Math.round(1920 * 0.22),   // 422px from bottom
  none: 430,                          // default aesthetic position
};
