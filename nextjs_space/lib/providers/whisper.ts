/**
 * Whisper Large v3 via fal.ai — word-level timestamps for frame-accurate
 * subtitle sync. Uses the fal.ai queue API.
 *
 * Model: fal-ai/whisper (Whisper Large v3)
 * Returns word-level timestamps that override ElevenLabs character alignment
 * for more accurate subtitle timing.
 */
import type { WordTimestamp } from './types';

const FAL_SUBMIT = 'https://queue.fal.run/fal-ai/whisper';
const POLL_INTERVAL = 2000; // ms
const MAX_WAIT = 120_000; // 2 minutes

// Cost: fal.ai Whisper ~ $0.005/minute of audio
const WHISPER_COST_PER_MINUTE = 0.005;

export interface WhisperResult {
  words: WordTimestamp[];
  text: string;
  language: string;
  durationSec: number;
  cost: number;
}

/**
 * Transcribe audio via Whisper Large v3, returning word-level timestamps.
 * @param audioUrl Public URL of the audio file to transcribe.
 * @param durationSec Estimated duration (for cost calculation).
 */
export async function transcribeWithWhisper(audioUrl: string, durationSec: number): Promise<WhisperResult> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY not configured for Whisper');

  console.log(`[whisper] Submitting transcription: audio=${audioUrl.slice(0, 80)}..., est_duration=${durationSec}s`);

  // Submit to queue
  const submitRes = await fetch(FAL_SUBMIT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      task: 'transcribe',
      language: 'en',
      chunk_level: 'word',   // word-level timestamps
      version: '3',          // Whisper Large v3
    }),
  });

  if (!submitRes.ok) {
    const t = await submitRes.text().catch(() => '');
    throw new Error(`Whisper submit failed (${submitRes.status}): ${t.slice(0, 200)}`);
  }

  const submitData = await submitRes.json();
  const statusUrl = submitData.status_url;
  const responseUrl = submitData.response_url;
  if (!statusUrl) throw new Error('Whisper: no status_url in response');

  console.log(`[whisper] Queued, polling status...`);

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const pollRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === 'COMPLETED') {
      // Fetch the response
      const resultRes = await fetch(responseUrl || pollData.response_url, {
        headers: { Authorization: `Key ${falKey}` },
      });
      if (!resultRes.ok) throw new Error(`Whisper result fetch failed (${resultRes.status})`);
      const result = await resultRes.json();

      // Extract word-level timestamps from chunks
      const words: WordTimestamp[] = [];
      const chunks = result?.chunks ?? [];
      for (const chunk of chunks) {
        const timestamps = chunk?.timestamp ?? [];
        const text = (chunk?.text ?? '').trim();
        if (!text || timestamps.length < 2) continue;

        // Each chunk may be a word or segment with [start, end]
        const start = timestamps[0] ?? 0;
        const end = timestamps[1] ?? start + 0.3;

        // Split multi-word chunks into individual words
        const chunkWords = text.split(/\s+/).filter(Boolean);
        if (chunkWords.length === 1) {
          words.push({ word: chunkWords[0], start: +start.toFixed(3), end: +end.toFixed(3) });
        } else {
          // Distribute time across words
          const span = end - start;
          const per = span / chunkWords.length;
          chunkWords.forEach((w: string, i: number) => {
            words.push({
              word: w,
              start: +(start + i * per).toFixed(3),
              end: +(start + (i + 1) * per).toFixed(3),
            });
          });
        }
      }

      const finalDuration = words.length > 0 ? words[words.length - 1].end : durationSec;
      const cost = Math.max(0.001, (finalDuration / 60) * WHISPER_COST_PER_MINUTE);

      console.log(`[whisper] Complete: ${words.length} words, duration=${finalDuration.toFixed(1)}s, language=${result?.language ?? 'en'}, cost=$${cost.toFixed(4)}`);

      return {
        words,
        text: result?.text ?? chunks.map((c: any) => c?.text ?? '').join(' ').trim(),
        language: result?.language ?? 'en',
        durationSec: +finalDuration.toFixed(2),
        cost,
      };
    }

    if (pollData.status === 'FAILED') {
      throw new Error(`Whisper failed: ${pollData.error ?? 'unknown error'}`);
    }
    // IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new Error(`Whisper timeout after ${MAX_WAIT / 1000}s`);
}
