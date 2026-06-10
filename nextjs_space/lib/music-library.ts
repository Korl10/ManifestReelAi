// ── Curated music library + smart matcher ───────────────────────────
// Real library (Batch 1): 45 instrumental tracks across 7 musical moods
// (abundant, calm, empowered, grateful, hype, inspired, joyful) plus 5
// intro/outro "stinger" accents. Tracks live as static files under
// /public/music-library/{mood}/*.mp3 with a manifest.json sidecar, so future
// batches drop in by replacing the folder + manifest and redeploying — no code
// changes required.
//
// The matcher ranks tracks by a WEIGHTED score (never a hard filter chain) so
// it ALWAYS returns a result. The only hard rules are `has_vocals === false`
// and `is_stinger === false` for the main background match.
//
// Priority order (dominant → tiebreak):
//   1. mood match      (resolved through MOOD_ALIASES so dashboard moods like
//                       "manifestation" map onto library moods like "inspired")
//   2. style overlap   (+200 per overlapping style)
//   3. platform fit    (+60 if the track supports the reel's target platform)
//   4. energy fit       (track energy vs. the mood's expected intensity)

import rawManifest from '../public/music-library/manifest.json';

// Five intensity buckets, ordered low → high (matches the Suno export).
export type Energy = 'low' | 'mid' | 'mid-high' | 'high' | 'very-high';
const ENERGY_ORDER: Energy[] = ['low', 'mid', 'mid-high', 'high', 'very-high'];

// Canonical library moods (Batch 1).
export const LIBRARY_MOODS = ['abundant', 'calm', 'empowered', 'grateful', 'hype', 'inspired', 'joyful'] as const;
export type LibraryMood = (typeof LIBRARY_MOODS)[number];

export interface MusicTrack {
  id: string;
  title: string;
  /** Web path under /public, e.g. /music-library/abundant/track.mp3 */
  file: string;
  mood: string[];
  style: string[];
  /** Detected via ffprobe at build time. */
  duration: number;
  /** Lowercased platform slugs ('tiktok','reels','shorts') or ['all']. */
  platforms: string[];
  energy: Energy;
  has_vocals: boolean;
  is_stinger: boolean;
  bpm: number | null;
  /** Approximate file size in kilobytes (display / bandwidth hints). */
  size_kb?: number | null;
  /** Licensing posture. Determines whether public attribution is required.
   *  - royalty_free: free to use, no credit needed (owner-owned library)
   *  - attribution_required: must credit the artist on the reel landing page
   *  - paid_license: covered by a paid license, no public credit needed
   *  - unknown: needs admin review before shipping */
  license_status: 'royalty_free' | 'attribution_required' | 'paid_license' | 'unknown';
  /** Provenance of the track. The shipped library is the curated v1 batch.
   *  A future “default” fallback batch would be tagged 'default' so it can be
   *  ranked below curated picks and phased out later. */
  source: 'curated_v1' | 'default';
}

export interface MatchQuery {
  mood?: string | null;
  style?: string | null;
  platform?: string | null;
  /** Track ids to exclude (already-shown alternates / the current pick). */
  exclude?: string[];
}

export interface ScoredTrack {
  track: MusicTrack;
  score: number;
}

// Map any incoming mood term (dashboard label, reel-asset synonym, or a library
// mood itself) → an ordered list of library moods, best first. The first entry
// is the "primary" target (full weight); the rest are softer fallbacks.
const MOOD_ALIASES: Record<string, LibraryMood[]> = {
  // dashboard mood labels
  manifestation: ['inspired', 'abundant'],
  meditation: ['calm'],
  'wealth-frequency': ['abundant'],
  cinematic: ['empowered', 'inspired'],
  dreamy: ['calm', 'grateful'],
  uplifting: ['joyful', 'inspired'],
  powerful: ['empowered', 'hype'],
  serene: ['calm'],
  // common synonyms (reel-assets / scripts)
  abundance: ['abundant'],
  wealth: ['abundant'],
  money: ['abundant'],
  luxury: ['abundant', 'empowered'],
  calm: ['calm'],
  peace: ['calm'],
  peaceful: ['calm'],
  healing: ['calm', 'grateful'],
  gratitude: ['grateful'],
  grateful: ['grateful'],
  motivational: ['empowered', 'hype'],
  confidence: ['empowered'],
  energetic: ['hype'],
  hype: ['hype'],
  happy: ['joyful'],
  joy: ['joyful'],
  joyful: ['joyful'],
  inspired: ['inspired'],
  inspiring: ['inspired'],
  empowered: ['empowered'],
  abundant: ['abundant'],
};

// Expected intensity per library mood — drives the energy tiebreak.
const MOOD_ENERGY: Record<LibraryMood, Energy> = {
  abundant: 'mid-high',
  calm: 'low',
  empowered: 'high',
  grateful: 'low',
  hype: 'very-high',
  inspired: 'mid',
  joyful: 'high',
};

// Normalize a reel platform slug onto the library's platform vocabulary.
const PLATFORM_ALIASES: Record<string, string> = {
  tiktok: 'tiktok',
  'instagram-reels': 'reels',
  instagram: 'reels',
  reels: 'reels',
  'youtube-shorts': 'shorts',
  youtube: 'shorts',
  shorts: 'shorts',
};

function norm(s?: string | null): string {
  return (s ?? '').toString().trim().toLowerCase();
}

function resolveMoods(mood: string): LibraryMood[] {
  if (!mood) return [];
  if (MOOD_ALIASES[mood]) return MOOD_ALIASES[mood];
  if ((LIBRARY_MOODS as readonly string[]).includes(mood)) return [mood as LibraryMood];
  return [];
}

function resolvePlatform(p: string): string | null {
  if (!p) return null;
  return PLATFORM_ALIASES[p] ?? p;
}

// Normalize a raw manifest entry into a strongly-typed MusicTrack.
function normalizeTrack(t: any): MusicTrack {
  const energy = ENERGY_ORDER.includes(t.energy) ? (t.energy as Energy) : 'mid';
  return {
    id: String(t.id),
    title: String(t.title ?? t.id),
    file: String(t.file),
    mood: Array.isArray(t.mood) ? t.mood.map((m: string) => norm(m)) : [],
    style: Array.isArray(t.style) ? t.style.map((s: string) => norm(s)) : [],
    duration: Number(t.duration_sec ?? t.duration) || 30,
    platforms: Array.isArray(t.platforms) && t.platforms.length
      ? t.platforms.map((p: string) => norm(p))
      : ['all'],
    energy,
    has_vocals: t.has_vocals === true,
    is_stinger: t.is_stinger === true,
    bpm: t.bpm != null ? Number(t.bpm) : null,
    size_kb: t.size_kb != null ? Number(t.size_kb) : null,
    license_status: ['royalty_free', 'attribution_required', 'paid_license', 'unknown'].includes(t.license_status)
      ? t.license_status
      : 'royalty_free',
    source: (t.source === 'default' ? 'default' : 'curated_v1'),
  };
}

const MANIFEST_TRACKS: any[] = Array.isArray(rawManifest)
  ? (rawManifest as any[])
  : ((rawManifest as any).tracks ?? []);
const TRACKS: MusicTrack[] = MANIFEST_TRACKS.map(normalizeTrack);
const BACKGROUND_TRACKS = TRACKS.filter((t) => !t.is_stinger);
const STINGER_TRACKS = TRACKS.filter((t) => t.is_stinger);

export function getAllTracks(): MusicTrack[] {
  return TRACKS;
}

export function getTrackById(id?: string | null): MusicTrack | null {
  if (!id) return null;
  return TRACKS.find((t) => t.id === id) ?? null;
}

function energyScore(target: Energy, candidate: Energy): number {
  const d = Math.abs(ENERGY_ORDER.indexOf(target) - ENERGY_ORDER.indexOf(candidate));
  if (d === 0) return 25;
  if (d === 1) return 12;
  if (d === 2) return 4;
  return 0;
}

/** Score a single background track against the query. */
export function scoreTrack(track: MusicTrack, q: MatchQuery): number {
  const mood = norm(q.mood);
  const style = norm(q.style);
  const platform = resolvePlatform(norm(q.platform));
  let score = 0;

  // 1) Mood (dominant) — resolved through aliases. Primary target gets full
  //    weight; softer fallbacks get a partial bonus so we degrade gracefully.
  const targets = resolveMoods(mood);
  if (targets.length) {
    if (track.mood.includes(targets[0])) score += 1000;
    for (let i = 1; i < targets.length; i++) {
      if (track.mood.includes(targets[i])) { score += 450 - i * 100; break; }
    }
  }

  // 2) Style overlap.
  if (style) {
    for (const s of track.style) {
      if (s === style || s.includes(style) || style.includes(s)) { score += 200; break; }
    }
  }

  // 3) Platform fit.
  if (track.platforms.includes('all') || (platform && track.platforms.includes(platform))) {
    score += 60;
  }

  // 4) Energy fit — track energy vs. the primary mood's expected intensity.
  const targetEnergy: Energy = (targets.length && MOOD_ENERGY[targets[0]]) || 'mid';
  score += energyScore(targetEnergy, track.energy);

  // 5) Provenance — curated v1 is the priority pool; default is a soft fallback.
  if (track.source === 'curated_v1') score += 10;

  return +score.toFixed(2);
}

/**
 * Rank ALL eligible background tracks for a query, best first.
 * Hard rules: has_vocals === false AND not a stinger. Everything else is
 * weighted scoring so we always return *something*.
 */
export function rankTracks(q: MatchQuery): ScoredTrack[] {
  const exclude = new Set((q.exclude ?? []).filter(Boolean));
  return BACKGROUND_TRACKS
    .filter((t) => t.has_vocals === false && !exclude.has(t.id))
    .map((track) => ({ track, score: scoreTrack(track, q) }))
    .sort((a, b) => b.score - a.score || b.track.duration - a.track.duration);
}

/** Best single match for a query (or null if the library is empty). */
export function matchTrack(q: MatchQuery): MusicTrack | null {
  const ranked = rankTracks(q);
  return ranked.length ? ranked[0].track : null;
}

/**
 * Up to `count` ALTERNATE matches in the SAME mood family (excluding the
 * current pick and any ids in q.exclude). Powers the "Change track" button.
 */
export function getAlternates(q: MatchQuery, count = 3): MusicTrack[] {
  return rankTracks(q).slice(0, count).map((s) => s.track);
}

// ── Vol. 2 (DB) integration ──────────────────────────────────────────
// Fetches uploaded library tracks from the database and includes them
// in the ranking alongside the static manifest (Vol. 1) tracks.
// The async variants should be used in the generation pipeline.

import { prisma } from '@/lib/prisma';

/** Convert a DB LibraryTrack row into a MusicTrack. */
function dbTrackToMusicTrack(row: any): MusicTrack {
  return {
    id: `v2_${row.id}`,
    title: row.title,
    file: row.cloudUrl, // cloud URL, not local path
    mood: Array.isArray(row.mood) ? row.mood : [],
    style: Array.isArray(row.style) ? row.style : [],
    duration: Number(row.durationSec) || 30,
    platforms: ['all'],
    energy: (row.energy as Energy) || 'mid',
    has_vocals: row.hasVocals === true,
    is_stinger: false,
    bpm: row.bpm ?? null,
    size_kb: row.sizeKb ?? null,
    license_status: ['royalty_free', 'attribution_required', 'paid_license', 'unknown'].includes(row.licenseStatus)
      ? row.licenseStatus
      : 'unknown',
    source: 'curated_v1', // scored the same as v1 curated
  };
}

/** Fetch active V2 tracks from the database (cached per request). */
async function getDbTracks(): Promise<MusicTrack[]> {
  try {
    const rows = await prisma.libraryTrack.findMany({
      where: { isActive: true },
    });
    return rows.map(dbTrackToMusicTrack);
  } catch (e) {
    console.error('[music-library] Failed to fetch DB tracks:', e);
    return [];
  }
}

/** Rank all tracks (manifest + DB) for a query. Async. */
export async function rankTracksAsync(q: MatchQuery): Promise<ScoredTrack[]> {
  const dbTracks = await getDbTracks();
  const allBackground = [
    ...BACKGROUND_TRACKS,
    ...dbTracks.filter(t => !t.has_vocals),
  ];
  const exclude = new Set((q.exclude ?? []).filter(Boolean));
  return allBackground
    .filter(t => !exclude.has(t.id))
    .map(track => ({ track, score: scoreTrack(track, q) }))
    .sort((a, b) => b.score - a.score || b.track.duration - a.track.duration);
}

/** Best single match including V2 DB tracks. Async. */
export async function matchTrackAsync(q: MatchQuery): Promise<MusicTrack | null> {
  const ranked = await rankTracksAsync(q);
  return ranked.length ? ranked[0].track : null;
}

/** Check if a MusicTrack has a cloud URL (V2) vs local file (V1). */
export function isCloudTrack(track: MusicTrack): boolean {
  return track.file.startsWith('http://') || track.file.startsWith('https://');
}

// ── Stingers (optional intro/outro accents) ─────────────────────────

export function getStingers(): MusicTrack[] {
  return STINGER_TRACKS;
}

export function getStingerById(id?: string | null): MusicTrack | null {
  if (!id) return null;
  return STINGER_TRACKS.find((t) => t.id === id) ?? null;
}

/** Pick a sensible default stinger for a platform (prefers a matching open). */
export function defaultStinger(platform?: string | null): MusicTrack | null {
  if (!STINGER_TRACKS.length) return null;
  const p = resolvePlatform(norm(platform));
  if (p === 'tiktok') {
    const tk = STINGER_TRACKS.find((t) => /tiktok/i.test(t.id) || /tiktok/i.test(t.title));
    if (tk) return tk;
  }
  const open = STINGER_TRACKS.find((t) => /open|intro/i.test(t.id) || /open|intro/i.test(t.title));
  return open ?? STINGER_TRACKS[0];
}

// ── Coverage (admin) ────────────────────────────────────────────────

export interface MoodCoverage {
  mood: string;
  count: number;
  low: boolean; // flagged when fewer than 3 tracks
}

/** Per-mood background-track counts; flags any mood with < 3 tracks. */
export function moodCoverage(): { moods: MoodCoverage[]; stingers: number; total: number } {
  const counts: Record<string, number> = {};
  for (const m of LIBRARY_MOODS) counts[m] = 0;
  for (const t of BACKGROUND_TRACKS) {
    for (const m of t.mood) {
      counts[m] = (counts[m] ?? 0) + 1;
    }
  }
  const moods = Object.keys(counts)
    .sort()
    .map((mood) => ({ mood, count: counts[mood], low: counts[mood] < 3 }));
  return { moods, stingers: STINGER_TRACKS.length, total: TRACKS.length };
}
