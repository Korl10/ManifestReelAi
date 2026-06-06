// ── Free-tier policy (single source of truth) ────────────────────────
// Every free-tier limit lives here so the server, the UI, and the admin
// dashboard all agree. The SERVER is the authority: `validateFreeTierRequest`
// rejects any request that tries to exceed these limits (a curl/Postman bypass
// attempt gets a 403), and `clampFreeTierParams` defensively normalizes the
// values that actually reach the pipeline.

import { SUBTITLE_FONTS } from '@/lib/captions/subtitle-types';

// Hard generation limits ----------------------------------------------------
export const FREE_DURATION_SEC = 5;          // 5-second reels only
export const FREE_WIDTH = 720;               // 720p output (portrait)
export const FREE_HEIGHT = 1280;
export const FREE_MODEL_TIER = 'standard';   // Standard engine only
export const FREE_VOICE = 'female-aria';     // single default voice
export const FREE_ANIMATION = 'karaoke';     // default subtitle animation only

// Subtitle editor is limited to 3 fonts + 3 colors for free users.
export const FREE_FONTS = ['DM Sans', 'Bebas Neue', 'Anton'] as const;
export const FREE_COLORS = ['#FFFFFF', '#D4AF37', '#7B2FBE'] as const; // white / gold / purple

// Account & rate limits ------------------------------------------------------
// LIFETIME model: each account gets exactly ONE real-AI free reel, ever. A 5s
// watermarked reel is the “wow” demo, not a usable product — so there is no
// daily renewal. The lifetime gate (User.freeReelUsed) lives in the generate
// route; the per-IP limit below still guards against signup-spam abuse.
export const FREE_LIFETIME_REELS = 1;        // one real-AI free reel per account, ever
export const FREE_REELS_PER_IP_PER_HOUR = 1; // anti-abuse, rolling 60m

// Cost protection ------------------------------------------------------------
export const FREE_DAILY_BUDGET_CENTS = 2000; // $20.00/day ceiling for ALL free reels
// Real AI generation (Standard engine: LLM script + AI images + auto music +
// subtitle compositing) at 5s/720p ≈ $0.25/reel → ~80 new free reels/day before
// the $20 pool protects against signup waves.
export const FREE_REEL_EST_COST_CENTS = 25;  // ~$0.25 per 5s real-AI free reel

export type FreeViolation =
  | 'duration'
  | 'resolution'
  | 'model_tier'
  | 'motion'
  | 'voice'
  | 'music_picker'
  | 'stinger'
  | 'brand_preset'
  | 'font'
  | 'color'
  | 'animation';

export interface FreeValidation {
  ok: boolean;
  violations: FreeViolation[];
  message: string;
}

const norm = (s: any) => (typeof s === 'string' ? s.trim() : s);
const hex = (s: any) => (typeof s === 'string' ? s.trim().toUpperCase() : s);

/**
 * Strictly validate a generation request body against the free-tier policy.
 * Returns the list of violations; if non-empty the API must reject with 403.
 * This is what makes a raw curl bypass attempt fail.
 */
export function validateFreeTierRequest(body: any): FreeValidation {
  const v: FreeViolation[] = [];

  // Duration: only 5s.
  const reqLen = Number(body?.targetLength ?? body?.targetDuration);
  if (Number.isFinite(reqLen) && reqLen !== FREE_DURATION_SEC) v.push('duration');

  // Resolution: 720p only (reject explicit 1080p / >720 requests).
  const reqRes = body?.resolution ?? body?.quality ?? body?.height;
  if (reqRes != null) {
    const h = typeof reqRes === 'string' ? parseInt(reqRes, 10) : Number(reqRes);
    if (Number.isFinite(h) && h > FREE_HEIGHT) v.push('resolution');
    if (typeof reqRes === 'string' && /1080|1440|2160|4k/i.test(reqRes)) v.push('resolution');
  }

  // Motion + model tier: Standard, non-motion only.
  if (body?.motion === true) v.push('motion');
  const mt = norm(body?.modelTier);
  if (mt && mt !== FREE_MODEL_TIER) v.push('model_tier');

  // Voice: single default voice (allow optional @speed suffix on the default).
  const voice = norm(body?.voice);
  if (voice && String(voice).split('@')[0] !== FREE_VOICE) v.push('voice');
  if (norm(body?.voiceTier)) v.push('voice'); // no advanced voice tier selection

  // Music: auto-match only (no explicit track, no upload, no stinger).
  if (norm(body?.musicTrackId)) v.push('music_picker');
  if (norm(body?.customMusicId) || norm(body?.musicUrl)) v.push('music_picker');
  if (body?.stinger === true || norm(body?.stingerId)) v.push('stinger');

  // Brand presets: none for free.
  if (norm(body?.brandPresetId)) v.push('brand_preset');

  // Subtitle style: limited fonts / colors / animation.
  const ss = body?.subtitleStyle;
  if (ss && typeof ss === 'object') {
    if (ss.fontFamily && !(FREE_FONTS as readonly string[]).includes(norm(ss.fontFamily))) v.push('font');
    if (ss.textColor && !(FREE_COLORS as readonly string[]).includes(hex(ss.textColor))) v.push('color');
    if (ss.animation && norm(ss.animation) !== FREE_ANIMATION) v.push('animation');
  }

  const ok = v.length === 0;
  return {
    ok,
    violations: v,
    message: ok
      ? 'OK'
      : 'This option is part of a paid plan. Upgrade to Pro or Premium to unlock it.',
  };
}

/**
 * Defensively normalize the params that reach the pipeline for a free reel,
 * regardless of what the client sent. Validation rejects bad requests first;
 * this is belt-and-suspenders so the pipeline never runs a premium config.
 */
export function clampFreeTierParams(body: any) {
  const ss = (body?.subtitleStyle && typeof body.subtitleStyle === 'object') ? { ...body.subtitleStyle } : {};
  // Force allowed font/color/animation.
  if (!(FREE_FONTS as readonly string[]).includes(norm(ss.fontFamily))) ss.fontFamily = FREE_FONTS[0];
  if (!(FREE_COLORS as readonly string[]).includes(hex(ss.textColor))) ss.textColor = FREE_COLORS[0];
  ss.animation = FREE_ANIMATION;

  return {
    motion: false,
    modelTier: FREE_MODEL_TIER,
    voice: FREE_VOICE,
    voiceTier: undefined,
    targetDuration: FREE_DURATION_SEC,
    musicTrackId: undefined,   // pipeline auto-matches
    stinger: false,
    stingerId: undefined,
    brandPresetId: undefined,
    subtitleStyle: ss,
  };
}

/** UTC day key (YYYY-MM-DD) for budget bucketing. */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
