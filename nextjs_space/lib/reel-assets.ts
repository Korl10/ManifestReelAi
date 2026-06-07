/**
 * Resolves real, bundled media assets for a reel based on its style / mood / voice.
 * All paths point to files that ship inside /public so they work in dev AND production.
 */

export type ResolvedAssets = {
  videoUrl: string;
  posterUrl: string;
  musicUrl: string;
  voiceSampleUrl: string | null;
};

// ---- Background videos (vertical 9:16, looping, clean / no burned-in text) ----
const VIDEO_MAP: Record<string, string> = {
  // Wealth & luxury -> golden luxury bokeh
  wealth: '/showcase/wealth.mp4',
  money: '/showcase/wealth.mp4',
  luxury: '/showcase/wealth.mp4',
  // Drive & power -> energetic purple/gold lightning
  motivational: '/showcase/selflove.mp4',
  motivation: '/showcase/selflove.mp4',
  power: '/showcase/selflove.mp4',
  confidence: '/showcase/selflove.mp4',
  // Spiritual / calm -> gentle golden particle rain
  spiritual: '/showcase/dream.mp4',
  abundance: '/showcase/dream.mp4',
  manifestation: '/showcase/dream.mp4',
  'law of attraction': '/showcase/dream.mp4',
  dream: '/showcase/dream.mp4',
  love: '/showcase/dream.mp4',
  selflove: '/showcase/dream.mp4',
  gratitude: '/showcase/dream.mp4',
  meditation: '/showcase/dream.mp4',
  peace: '/showcase/dream.mp4',
  calm: '/showcase/dream.mp4',
  healing: '/showcase/dream.mp4',
};

const POSTER_MAP: Record<string, string> = {
  '/showcase/wealth.mp4': '/showcase/wealth-poster.jpg',
  '/showcase/dream.mp4': '/showcase/dream-poster.jpg',
  '/showcase/selflove.mp4': '/showcase/selflove-poster.jpg',
};

const DEFAULT_VIDEO = '/showcase/dream.mp4';

// ---- Background music (solfeggio-frequency tracks, ~30s) ----
const MUSIC_MAP: Record<string, string> = {
  manifestation: '/reel-music/manifestation.mp3',
  abundance: '/reel-music/manifestation.mp3',
  meditation: '/reel-music/meditation.mp3',
  calm: '/reel-music/meditation.mp3',
  serene: '/reel-music/serene.mp3',
  peace: '/reel-music/serene.mp3',
  peaceful: '/reel-music/serene.mp3',
  wealth: '/reel-music/wealth-frequency.mp3',
  money: '/reel-music/wealth-frequency.mp3',
  luxury: '/reel-music/wealth-frequency.mp3',
  cinematic: '/reel-music/cinematic.mp3',
  epic: '/reel-music/cinematic.mp3',
  dramatic: '/reel-music/cinematic.mp3',
  dreamy: '/reel-music/dreamy.mp3',
  ethereal: '/reel-music/dreamy.mp3',
  ambient: '/reel-music/dreamy.mp3',
  uplifting: '/reel-music/uplifting.mp3',
  happy: '/reel-music/uplifting.mp3',
  inspiring: '/reel-music/uplifting.mp3',
  powerful: '/reel-music/powerful.mp3',
  intense: '/reel-music/powerful.mp3',
  energetic: '/reel-music/powerful.mp3',
};

const DEFAULT_MUSIC = '/reel-music/manifestation.mp3';

// Voice samples are now served via ElevenLabs previewUrl in the catalog,
// not local /public/voices/library/ files. Legacy set kept for backwards compat.
const VOICE_SAMPLES = new Set<string>();

function norm(v?: string | null): string {
  return (v ?? '').toString().trim().toLowerCase();
}

/** Strip any speed suffix like "female-aria@slow" -> "female-aria". */
export function baseVoiceId(voice?: string | null): string {
  return norm(voice).split('@')[0];
}

export function getBackgroundVideo(style?: string | null): string {
  const s = norm(style);
  if (VIDEO_MAP[s]) return VIDEO_MAP[s];
  for (const key of Object.keys(VIDEO_MAP)) {
    if (s.includes(key)) return VIDEO_MAP[key];
  }
  return DEFAULT_VIDEO;
}

export function getPoster(style?: string | null): string {
  const video = getBackgroundVideo(style);
  return POSTER_MAP[video] ?? '/showcase/dream-poster.jpg';
}

export function getMusicTrack(mood?: string | null): string {
  const m = norm(mood);
  if (MUSIC_MAP[m]) return MUSIC_MAP[m];
  for (const key of Object.keys(MUSIC_MAP)) {
    if (m.includes(key)) return MUSIC_MAP[key];
  }
  return DEFAULT_MUSIC;
}

export function getVoiceSample(voice?: string | null): string | null {
  const id = baseVoiceId(voice);
  if (id && VOICE_SAMPLES.has(id)) return `/voices/library/${id}.mp3`;
  return null;
}

/** Resolve all media for a reel. */
export function resolveReelAssets(reel: { style?: string | null; mood?: string | null; voice?: string | null }): ResolvedAssets {
  return {
    videoUrl: getBackgroundVideo(reel.style),
    posterUrl: getPoster(reel.style),
    musicUrl: getMusicTrack(reel.mood),
    voiceSampleUrl: getVoiceSample(reel.voice),
  };
}

/** True if a stored URL is missing or a leftover mock/placeholder path. */
export function isPlaceholderUrl(url?: string | null): boolean {
  if (!url) return true;
  return url.startsWith('/mock') || url.includes('placeholder');
}
