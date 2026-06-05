export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getVoiceById, modelIdForTier, resolveTier } from '@/lib/voice-catalog';
import type { VoiceTier } from '@/lib/voice-catalog';
import { uploadPublicBuffer } from '@/lib/media-storage';
import crypto from 'crypto';

const EL_BASE = 'https://api.elevenlabs.io/v1';

// In-memory cache: key = hash(voiceId + text + tier) -> { url, ts }
const previewCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(voiceId: string, text: string, tier: string): string {
  return crypto.createHash('md5').update(`${voiceId}:${tier}:${text}`).digest('hex');
}

/**
 * POST /api/voices/preview
 * Generate a short (~5s) voice preview using the user's first script line.
 * Caches results by (voiceId + text + tier) to save ElevenLabs credits.
 *
 * Body: { voiceId: string, text: string, tier?: VoiceTier, stability?: number, similarity?: number }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Voice preview unavailable' }, { status: 503 });

  try {
    const body = await request.json();
    const { voiceId, text, tier, stability, similarity } = body ?? {};
    if (!voiceId || !text) {
      return NextResponse.json({ error: 'voiceId and text required' }, { status: 400 });
    }

    // Truncate to ~5 seconds worth of text (~80 chars)
    const previewText = String(text).slice(0, 120).trim();
    if (!previewText) return NextResponse.json({ error: 'Empty text' }, { status: 400 });

    const voice = getVoiceById(voiceId);
    if (!voice) return NextResponse.json({ error: 'Voice not found' }, { status: 404 });

    const resolvedTier = resolveTier(voice, tier as VoiceTier | undefined);
    const modelId = modelIdForTier(resolvedTier);

    // Check cache (only for default stability/similarity)
    const isDefaultSettings = (stability === undefined || stability === null) && (similarity === undefined || similarity === null);
    const ck = cacheKey(voiceId, previewText, resolvedTier);
    if (isDefaultSettings) {
      const cached = previewCache.get(ck);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        console.log(`[voice-preview] CACHE HIT for ${voiceId}`);
        return NextResponse.json({ audioUrl: cached.url, cached: true, tier: resolvedTier });
      }
    }

    // Generate via ElevenLabs
    console.log(`[voice-preview] Generating preview: voice=${voiceId} (${voice.elevenLabsId}), tier=${resolvedTier}, model=${modelId}, text="${previewText.slice(0, 40)}..."`);
    const res = await fetch(`${EL_BASE}/text-to-speech/${voice.elevenLabsId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: previewText,
        model_id: modelId,
        voice_settings: {
          stability: typeof stability === 'number' ? stability : 0.5,
          similarity_boost: typeof similarity === 'number' ? similarity : 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error(`[voice-preview] ElevenLabs error ${res.status}: ${t.slice(0, 200)}`);
      return NextResponse.json({ error: `Voice generation failed (${res.status})` }, { status: 502 });
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const audioUrl = await uploadPublicBuffer(audioBuffer, `preview-${voiceId}.mp3`, 'audio/mpeg');

    // Cache for default settings
    if (isDefaultSettings) {
      previewCache.set(ck, { url: audioUrl, ts: Date.now() });
      // Prune old entries
      if (previewCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of previewCache) {
          if (now - v.ts > CACHE_TTL) previewCache.delete(k);
        }
      }
    }

    console.log(`[voice-preview] Generated: ${audioUrl}`);
    return NextResponse.json({ audioUrl, cached: false, tier: resolvedTier });
  } catch (err: any) {
    console.error('[voice-preview] Error:', err?.message);
    return NextResponse.json({ error: 'Preview generation failed' }, { status: 500 });
  }
}
