import { Provider, VoiceInput, VoiceOutput, WordTimestamp, ScriptLine } from './types';
import { uploadPublicBuffer } from '@/lib/media-storage';
import { getVoiceById, modelIdForTier, resolveTier, speedValue, isVoiceActive, findFallbackVoice } from '@/lib/voice-catalog';
import type { VoiceTier } from '@/lib/voice-catalog';

const EL_BASE = 'https://api.elevenlabs.io/v1';

// Legacy fallback: resolve internal voice ID to ElevenLabs voice ID
// when the voice isn't in the catalog (e.g. old reels).
function legacyElevenVoiceId(internalVoice: string): string {
  const id = internalVoice.split('@')[0].toLowerCase();
  const female = process.env.EL_VOICE_FEMALE || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const male = process.env.EL_VOICE_MALE || 'pNInz6obpgDQGcFmaJgB'; // Adam
  const soft = process.env.EL_VOICE_SOFT || 'EXAVITQu4vr4xnSDxMaL'; // Bella (soft/meditative)
  if (id.startsWith('med') || id.includes('meditation') || id.includes('soft')) return soft;
  if (id.startsWith('male') || id.startsWith('bib') || id.includes('-guy') || id.includes('-andrew') || id.includes('-brian') || id.includes('-thomas') || id.includes('-eric') || id.includes('-william') || id.includes('-roger') || id.includes('-ryan')) return male;
  return female;
}

// Speed presets exposed to users (ElevenLabs NATIVE speed param — never FFmpeg):
//   Slow = 0.85, Normal = 1.0, Fast = 1.15. Preserves natural prosody.
function speedFromPreset(voicePreset: string): number {
  return speedValue(voicePreset);
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

/** Extended voice input with optional advanced settings. */
export interface ExtendedVoiceInput extends VoiceInput {
  voiceTier?: VoiceTier;
  stability?: number;       // 0-1, default 0.5
  similarity?: number;      // 0-1, default 0.75
}

export class ElevenLabsVoiceProvider implements Provider<VoiceInput, VoiceOutput> {
  getName(): string { return 'ElevenLabs'; }

  estimateCost(input: VoiceInput): number {
    const charCount = input?.scriptText?.length ?? 0;
    // ElevenLabs pricing: ~$0.30/1000 chars for multilingual, ~$0.08/1000 for flash
    const tier = (input as ExtendedVoiceInput)?.voiceTier ?? 'multilingual';
    const rate = tier === 'flash' ? 0.08 : tier === 'turbo' ? 0.15 : 0.30;
    return Math.max(0.02, (charCount / 1000) * rate);
  }

  async generate(input: VoiceInput): Promise<VoiceOutput> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      const est = estimateTimestamps(input.lines, input.scriptText);
      return { audioUrl: null, timestamps: est.timestamps, durationSec: est.durationSec, provider: 'none' };
    }

    const ext = input as ExtendedVoiceInput;
    const baseId = (input.voicePreset || '').split('@')[0].toLowerCase();

    // Resolve voice from catalog (new) or legacy fallback
    let catalogVoice = getVoiceById(baseId);
    // If voice was retired, auto-fallback to closest active match
    if (catalogVoice && !isVoiceActive(baseId)) {
      const fallback = findFallbackVoice(baseId);
      if (fallback) {
        console.log(`[voice] Voice ${baseId} is retired, falling back to ${fallback.id} (${fallback.name})`);
        catalogVoice = fallback;
      }
    }
    let elevenVoiceId: string;
    let modelId: string;
    let tier: VoiceTier;

    if (catalogVoice) {
      elevenVoiceId = catalogVoice.elevenLabsId;
      tier = resolveTier(catalogVoice, ext.voiceTier);
      modelId = modelIdForTier(tier);
    } else {
      elevenVoiceId = legacyElevenVoiceId(input.voicePreset);
      tier = ext.voiceTier ?? 'multilingual';
      modelId = modelIdForTier(tier);
    }

    const stability = typeof ext.stability === 'number' ? ext.stability : 0.5;
    const similarity = typeof ext.similarity === 'number' ? ext.similarity : 0.75;
    const speed = speedFromPreset(input.voicePreset);

    console.log(`[voice] ElevenLabs TTS: voice=${baseId} (${elevenVoiceId}), tier=${tier}, model=${modelId}, stability=${stability}, similarity=${similarity}, speed=${speed}, chars=${input.scriptText.length}`);

    const res = await fetch(`${EL_BASE}/text-to-speech/${elevenVoiceId}/with-timestamps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        // English-only launch: force English output regardless of voice origin.
        language_code: 'en',
        text: input.scriptText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarity,
          style: 0.35,
          use_speaker_boost: true,
          speed,
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

    console.log(`[voice] ElevenLabs OK: duration=${durationSec.toFixed(1)}s, words=${timestamps.length}, cost~$${this.estimateCost(input).toFixed(4)}`);
    return { audioUrl, timestamps, durationSec: +durationSec.toFixed(2), provider: `ElevenLabs/${tier}` };
  }
}
