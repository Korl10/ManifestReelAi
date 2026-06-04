import { Provider, VoiceInput, VoiceOutput, WordTimestamp, ScriptLine } from './types';
import { uploadPublicBuffer } from '@/lib/media-storage';
import { baseVoiceId } from '@/lib/reel-assets';

const EL_BASE = 'https://api.elevenlabs.io/v1';

// Map our internal voice IDs -> ElevenLabs voice IDs. Falls back by gender/category.
// Users can override any of these via env (e.g. EL_VOICE_FEMALE).
function resolveElevenVoiceId(internalVoice: string): string {
  const id = baseVoiceId(internalVoice);
  const female = process.env.EL_VOICE_FEMALE || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const male = process.env.EL_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB'; // Adam
  const soft = process.env.EL_VOICE_SOFT || 'EXAVITQu4vr4xnSDxMaL'; // Bella (soft/meditative)
  if (id.startsWith('med') || id.includes('meditation') || id.includes('soft')) return soft;
  if (id.startsWith('male') || id.startsWith('bib') || id.includes('-guy') || id.includes('-andrew') || id.includes('-brian') || id.includes('-thomas') || id.includes('-eric') || id.includes('-william') || id.includes('-roger') || id.includes('-ryan')) return male;
  return female;
}

function speedFromPreset(voicePreset: string): number {
  const v = (voicePreset || '').toLowerCase();
  if (v.includes('@slower') || v.includes('@slow')) return 0.8;
  if (v.includes('@faster') || v.includes('@fast')) return 1.12;
  return 0.92; // slightly slower = more cinematic / meditative by default
}

function wordsFromCharAlignment(text: string, alignment: any): WordTimestamp[] {
  const chars: string[] = alignment?.characters ?? [];
  const starts: number[] = alignment?.character_start_times_seconds ?? [];
  const ends: number[] = alignment?.character_end_times_seconds ?? [];
  if (!chars.length) return [];
  const words: WordTimestamp[] = [];
  let cur = '';
  let curStart = starts[0] ?? 0;
  let curEnd = ends[0] ?? 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur.trim()) words.push({ word: cur.trim(), start: +curStart.toFixed(3), end: +curEnd.toFixed(3) });
      cur = '';
      curStart = starts[i + 1] ?? curEnd;
    } else {
      if (!cur) curStart = starts[i] ?? curEnd;
      cur += c;
      curEnd = ends[i] ?? curEnd;
    }
  }
  if (cur.trim()) words.push({ word: cur.trim(), start: +curStart.toFixed(3), end: +curEnd.toFixed(3) });
  return words;
}

/** Deterministic fallback timing when no real TTS audio is available. */
export function estimateTimestamps(lines: ScriptLine[] | undefined, scriptText: string): { timestamps: WordTimestamp[]; durationSec: number } {
  if (lines && lines.length) {
    const timestamps: WordTimestamp[] = [];
    for (const ln of lines) {
      const words = (ln.text || '').trim().split(/\s+/).filter(Boolean);
      const span = Math.max(0.4, (ln.endTime - ln.startTime));
      const per = span / Math.max(1, words.length);
      words.forEach((w, i) => {
        timestamps.push({ word: w, start: +(ln.startTime + i * per).toFixed(3), end: +(ln.startTime + (i + 1) * per).toFixed(3) });
      });
    }
    const durationSec = lines[lines.length - 1]?.endTime ?? 28;
    return { timestamps, durationSec };
  }
  const words = (scriptText || '').trim().split(/\s+/).filter(Boolean);
  const per = 0.46;
  const timestamps = words.map((w, i) => ({ word: w, start: +(i * per).toFixed(3), end: +((i + 1) * per).toFixed(3) }));
  return { timestamps, durationSec: words.length * per + 1 };
}

export class ElevenLabsVoiceProvider implements Provider<VoiceInput, VoiceOutput> {
  getName(): string { return 'ElevenLabs'; }
  estimateCost(input: VoiceInput): number { return Math.max(0.05, ((input?.scriptText?.length ?? 0) / 1000) * 0.3); }

  async generate(input: VoiceInput): Promise<VoiceOutput> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Graceful fallback (Phase 1): no premium voice yet -> music-only reel.
      const est = estimateTimestamps(input.lines, input.scriptText);
      return { audioUrl: null, timestamps: est.timestamps, durationSec: est.durationSec, provider: 'none' };
    }

    const voiceId = resolveElevenVoiceId(input.voicePreset);
    const modelId = process.env.EL_MODEL || 'eleven_multilingual_v2';
    const res = await fetch(`${EL_BASE}/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: input.scriptText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
          speed: speedFromPreset(input.voicePreset),
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`ElevenLabs voice generation failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const audioB64: string = data?.audio_base64;
    if (!audioB64) throw new Error('ElevenLabs returned no audio.');
    const buffer = Buffer.from(audioB64, 'base64');
    const audioUrl = await uploadPublicBuffer(buffer, 'voice.mp3', 'audio/mpeg');
    const timestamps = wordsFromCharAlignment(input.scriptText, data?.alignment ?? data?.normalized_alignment);
    const durationSec = timestamps.length ? timestamps[timestamps.length - 1].end : estimateTimestamps(input.lines, input.scriptText).durationSec;
    return { audioUrl, timestamps, durationSec: +durationSec.toFixed(2), provider: 'ElevenLabs' };
  }
}
