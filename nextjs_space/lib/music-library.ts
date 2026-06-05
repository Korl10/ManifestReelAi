// ── Curated music library + smart matcher ───────────────────────────
// The matcher ranks tracks by a WEIGHTED score (never a hard filter chain)
// so it ALWAYS returns a result. The only hard rule is `has_vocals === false`
// (manifestation reels need clean instrumentals under the voiceover).
//
// Priority order (dominant → tiebreak):
//   1. mood match      (+1000 per overlapping mood)
//   2. style match     (+200 per overlapping style)
//   3. platform fit    (+60 if track supports the target platform / 'all')
//   4. energy fit       (+25 exact, +10 adjacent)
//   5. BPM fit          (up to +10, closeness to the mood's ideal tempo)
//
// Tracks ship as a static JSON manifest under /public/music-library so the
// real Suno library can be dropped in later WITHOUT code changes — just
// replace manifest.json and redeploy. Placeholder tracks (source:'placeholder')
// let us wire-test the whole flow before the real library lands.

import rawManifest from '../public/music-library/manifest.json';

export type Energy = 'low' | 'medium' | 'high';

export interface MusicTrack {
  id: string;
  title: string;
  /** Web path under /public (placeholder) OR /music-library/{mood}/track.mp3 (real). */
  file: string;
  mood: string[];
  style: string[];
  bpm: number;
  duration: number;
  /** Lowercased platform slugs (e.g. 'tiktok','instagram-reels','youtube-shorts') or ['all']. */
  platforms: string[];
  energy: Energy;
  has_vocals: boolean;
  source?: string;
}

export interface MatchQuery {
  mood?: string | null;
  style?: string | null;
  platform?: string | null;
  /** Track ids to exclude (e.g. already-shown alternates, or the current pick). */
  exclude?: string[];
}

export interface ScoredTrack {
  track: MusicTrack;
  score: number;
}

// Ideal tempo (BPM) per energy bucket — used for the BPM tiebreak.
const ENERGY_BPM: Record<Energy, number> = { low: 65, medium: 95, high: 122 };
const ENERGY_ORDER: Energy[] = ['low', 'medium', 'high'];

// Map a reel mood → the energy we *expect* (used when the query doesn't carry
// an explicit energy). Keeps fast moods on fast music and calm moods on calm.
const MOOD_ENERGY: Record<string, Energy> = {
  manifestation: 'medium', abundance: 'medium',
  meditation: 'low', calm: 'low', serene: 'low', peace: 'low', peaceful: 'low', healing: 'low',
  wealth: 'medium', money: 'medium', luxury: 'high',
  cinematic: 'high', epic: 'high', dramatic: 'high',
  dreamy: 'low', ethereal: 'low', ambient: 'low',
  uplifting: 'high', happy: 'high', inspiring: 'high',
  powerful: 'high', intense: 'high', energetic: 'high', confidence: 'high',
};

function norm(s?: string | null): string {
  return (s ?? '').toString().trim().toLowerCase();
}

// Normalize a raw manifest entry into a strongly-typed MusicTrack.
function normalizeTrack(t: any): MusicTrack {
  return {
    id: String(t.id),
    title: String(t.title ?? t.id),
    file: String(t.file),
    mood: Array.isArray(t.mood) ? t.mood.map((m: string) => norm(m)) : [],
    style: Array.isArray(t.style) ? t.style.map((s: string) => norm(s)) : [],
    bpm: Number(t.bpm) || 90,
    duration: Number(t.duration) || 30,
    platforms: Array.isArray(t.platforms) && t.platforms.length
      ? t.platforms.map((p: string) => norm(p))
      : ['all'],
    energy: (['low', 'medium', 'high'].includes(t.energy) ? t.energy : 'medium') as Energy,
    has_vocals: t.has_vocals === true,
    source: t.source ? String(t.source) : undefined,
  };
}

const TRACKS: MusicTrack[] = (rawManifest as any[]).map(normalizeTrack);

export function getAllTracks(): MusicTrack[] {
  return TRACKS;
}

export function getTrackById(id?: string | null): MusicTrack | null {
  if (!id) return null;
  return TRACKS.find((t) => t.id === id) ?? null;
}

function energyScore(target: Energy, candidate: Energy): number {
  if (target === candidate) return 25;
  const d = Math.abs(ENERGY_ORDER.indexOf(target) - ENERGY_ORDER.indexOf(candidate));
  return d === 1 ? 10 : 0;
}

function bpmScore(idealBpm: number, candidateBpm: number): number {
  const diff = Math.abs(idealBpm - candidateBpm);
  // 0 diff → 10, 50+ diff → 0. Linear falloff.
  return Math.max(0, +(10 - diff / 5).toFixed(2));
}

/** Score a single track against the query. */
export function scoreTrack(track: MusicTrack, q: MatchQuery): number {
  const mood = norm(q.mood);
  const style = norm(q.style);
  const platform = norm(q.platform);
  let score = 0;

  // 1) Mood (dominant). Count overlapping moods; primary mood is a direct hit.
  if (mood) {
    if (track.mood.includes(mood)) score += 1000;
    // Soft bonus for related moods sharing the same energy bucket.
    const targetEnergy = MOOD_ENERGY[mood];
    if (targetEnergy && track.mood.some((m) => MOOD_ENERGY[m] === targetEnergy)) score += 120;
  }

  // 2) Style.
  if (style) {
    for (const s of track.style) if (s === style || s.includes(style) || style.includes(s)) { score += 200; break; }
  }

  // 3) Platform fit.
  if (track.platforms.includes('all') || (platform && track.platforms.includes(platform))) {
    score += 60;
  }

  // 4) Energy fit (derived from mood when not explicit).
  const targetEnergy = (mood && MOOD_ENERGY[mood]) || 'medium';
  score += energyScore(targetEnergy, track.energy);

  // 5) BPM tiebreak.
  score += bpmScore(ENERGY_BPM[targetEnergy], track.bpm);

  return +score.toFixed(2);
}

/**
 * Rank ALL eligible (instrumental) tracks for a query, best first.
 * Hard rule: has_vocals === false. Everything else is weighted scoring so we
 * always return *something* even with a sparse library.
 */
export function rankTracks(q: MatchQuery): ScoredTrack[] {
  const exclude = new Set((q.exclude ?? []).filter(Boolean));
  return TRACKS
    .filter((t) => t.has_vocals === false && !exclude.has(t.id))
    .map((track) => ({ track, score: scoreTrack(track, q) }))
    .sort((a, b) => b.score - a.score || a.track.bpm - b.track.bpm);
}

/** Best single match for a query (or null if the library is empty). */
export function matchTrack(q: MatchQuery): MusicTrack | null {
  const ranked = rankTracks(q);
  return ranked.length ? ranked[0].track : null;
}

/**
 * Return up to `count` ALTERNATE matches (excluding the current pick and any
 * ids in q.exclude). Powers the "Change track" button.
 */
export function getAlternates(q: MatchQuery, count = 3): MusicTrack[] {
  return rankTracks(q).slice(0, count).map((s) => s.track);
}
