/**
 * Server-side helpers for Brand Presets: map Prisma rows <-> API shape and
 * sanitize incoming input into safe Prisma data.
 */
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/lib/captions/subtitle-types';
import type { BrandPreset } from '@/lib/brand-presets';

const WATERMARK_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
const WATERMARK_SIZES = ['S', 'M', 'L'];
const ASPECT_RATIOS = ['9:16', '1:1', '16:9'];
const PLATFORMS = ['reels', 'tiktok', 'shorts', 'youtube'];
const LENGTHS = [15, 25, 30];

function clampInt(v: any, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function clampFloat(v: any, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function str(v: any, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function hex(v: any, dflt: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : dflt;
}
function oneOf(v: any, allowed: string[], dflt: string): string {
  return typeof v === 'string' && allowed.includes(v) ? v : dflt;
}
function strArray(v: any, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)).slice(0, max);
}

/** Map a Prisma BrandPreset row to the API/UI shape. */
export function rowToPreset(r: any): BrandPreset {
  const ss = (r.subtitleStyle && typeof r.subtitleStyle === 'object')
    ? { ...DEFAULT_SUBTITLE_STYLE, ...(r.subtitleStyle as object) } as SubtitleStyle
    : { ...DEFAULT_SUBTITLE_STYLE };
  return {
    id: r.id,
    name: r.name,
    isDefault: !!r.isDefault,
    usageCount: r.usageCount ?? 0,
    logoPath: r.logoPath ?? null,
    logoUrl: r.logoUrl ?? null,
    primaryColor: r.primaryColor,
    accentColor: r.accentColor,
    watermarkShow: !!r.watermarkShow,
    watermarkPosition: r.watermarkPosition,
    watermarkOpacity: r.watermarkOpacity,
    watermarkSize: r.watermarkSize,
    watermarkPulse: !!r.watermarkPulse,
    subtitleStyle: ss,
    voiceId: r.voiceId ?? null,
    voiceStability: r.voiceStability,
    voiceSimilarity: r.voiceSimilarity,
    voiceTier: r.voiceTier,
    clonedVoiceId: r.clonedVoiceId ?? null,
    musicMoods: r.musicMoods ?? [],
    musicStyles: r.musicStyles ?? [],
    stingerEnabled: !!r.stingerEnabled,
    lockedTrackId: r.lockedTrackId ?? null,
    modelTier: r.modelTier,
    aspectRatio: r.aspectRatio,
    visualKeywords: r.visualKeywords ?? null,
    motionDefault: !!r.motionDefault,
    defaultPlatform: r.defaultPlatform,
    defaultLength: r.defaultLength,
    ctaText: r.ctaText ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? undefined,
    updatedAt: r.updatedAt?.toISOString?.() ?? undefined,
  };
}

/** Sanitize incoming body into Prisma-writable data (excludes isDefault). */
export function sanitizePresetInput(body: any): any {
  const ss = (body?.subtitleStyle && typeof body.subtitleStyle === 'object')
    ? { ...DEFAULT_SUBTITLE_STYLE, ...body.subtitleStyle }
    : { ...DEFAULT_SUBTITLE_STYLE };
  return {
    name: str(body?.name, 60) ?? 'Untitled Preset',
    logoPath: str(body?.logoPath, 500),
    logoUrl: str(body?.logoUrl, 1000),
    primaryColor: hex(body?.primaryColor, '#D4AF37'),
    accentColor: hex(body?.accentColor, '#7B2FBE'),
    watermarkShow: body?.watermarkShow !== false,
    watermarkPosition: oneOf(body?.watermarkPosition, WATERMARK_POSITIONS, 'bottom-right'),
    watermarkOpacity: clampInt(body?.watermarkOpacity, 0, 100, 80),
    watermarkSize: oneOf(body?.watermarkSize, WATERMARK_SIZES, 'M'),
    watermarkPulse: body?.watermarkPulse === true,
    subtitleStyle: ss,
    voiceId: str(body?.voiceId, 80),
    voiceStability: clampFloat(body?.voiceStability, 0, 1, 0.5),
    voiceSimilarity: clampFloat(body?.voiceSimilarity, 0, 1, 0.75),
    voiceTier: oneOf(body?.voiceTier, ['flash', 'multilingual', 'turbo'], 'multilingual'),
    clonedVoiceId: str(body?.clonedVoiceId, 80),
    musicMoods: strArray(body?.musicMoods),
    musicStyles: strArray(body?.musicStyles),
    stingerEnabled: body?.stingerEnabled === true,
    lockedTrackId: str(body?.lockedTrackId, 120),
    modelTier: oneOf(body?.modelTier, ['standard', 'pro', 'cinematic'], 'standard'),
    aspectRatio: oneOf(body?.aspectRatio, ASPECT_RATIOS, '9:16'),
    visualKeywords: str(body?.visualKeywords, 300),
    motionDefault: body?.motionDefault === true,
    defaultPlatform: oneOf(body?.defaultPlatform, PLATFORMS, 'reels'),
    defaultLength: LENGTHS.includes(Math.round(Number(body?.defaultLength))) ? Math.round(Number(body.defaultLength)) : 25,
    ctaText: str(body?.ctaText, 120),
  };
}
