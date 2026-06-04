import { WordTimestamp } from '@/lib/providers/types';
import { buildAss } from '@/lib/captions/ass';
import { uploadPublicText } from '@/lib/media-storage';

const CREATE_URL = 'https://apps.abacus.ai/api/createRunFfmpegCommandRequest';
const STATUS_URL = 'https://apps.abacus.ai/api/getRunFfmpegCommandStatus';

const W = 1080;
const H = 1920;
const FPS = 30;
const XFADE = 0.6; // crossfade duration between scenes

export interface CompositeInput {
  sceneImageUrls: string[];
  sceneDurations: number[]; // seconds per scene (same length as images)
  lineTexts: string[];
  words: WordTimestamp[];
  voiceUrl: string | null;
  musicUrl: string | null; // public URL
  watermark: boolean;
}

export interface CompositeResult {
  videoUrl: string;
  durationSec: number;
}

const TRANSITIONS = ['fade', 'fadeblack', 'dissolve', 'smoothleft', 'circleopen', 'fadewhite'];

function frames(sec: number): number {
  return Math.max(2, Math.round(sec * FPS));
}

/**
 * Builds and runs the full FFmpeg composite: Ken Burns motion on each cinematic
 * still, crossfade transitions, karaoke captions burned in, and a voice+music
 * mix. Returns a permanent CDN URL for the finished vertical MP4.
 */
export async function compositeReel(input: CompositeInput): Promise<CompositeResult> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('Compositing failed: ABACUSAI_API_KEY not configured.');

  const images = input.sceneImageUrls.filter(Boolean);
  const n = images.length;
  if (n === 0) throw new Error('Compositing failed: no scene images.');
  const durs = input.sceneDurations.slice(0, n).map((d) => Math.max(2.4, d || 4));

  // Total timeline length once crossfades overlap the scenes.
  const total = durs.reduce((a, b) => a + b, 0) - XFADE * (n - 1);
  const T = +Math.max(3, total).toFixed(2);

  // ---- Build & upload the karaoke subtitle file ----
  const ass = buildAss(input.lineTexts, input.words, { watermark: input.watermark, totalDuration: T });
  const assUrl = await uploadPublicText(ass, 'captions.ass', 'text/plain');

  // ---- Assemble input_files ----
  const input_files: Record<string, string> = {};
  images.forEach((url, i) => { input_files[`in_${i + 1}`] = url; });
  if (input.musicUrl) input_files['in_music'] = input.musicUrl;
  if (input.voiceUrl) input_files['in_voice'] = input.voiceUrl;
  input_files['in_ass'] = assUrl;

  // ---- Build the ffmpeg argument string ----
  const args: string[] = [];
  durs.forEach((d, i) => {
    args.push(`-loop 1 -t ${d.toFixed(2)} -i {{in_${i + 1}}}`);
  });
  let musicIdx = -1;
  if (input.musicUrl) { musicIdx = n; args.push(`-stream_loop 4 -i {{in_music}}`); }
  let voiceIdx = -1;
  if (input.voiceUrl) { voiceIdx = musicIdx >= 0 ? n + 1 : n; args.push(`-i {{in_voice}}`); }

  // Per-scene Ken Burns. Scale up first to reduce zoompan jitter.
  const fc: string[] = [];
  durs.forEach((d, i) => {
    const f = frames(d);
    const zoomIn = i % 2 === 0;
    const z = zoomIn
      ? `min(zoom+0.0010,1.20)`
      : `if(eq(on,1),1.20,max(zoom-0.0010,1.0))`;
    // gentle diagonal drift
    const x = `iw/2-(iw/zoom/2)+(${i % 2 === 0 ? '' : '-'}${(i % 3) * 12})`;
    fc.push(
      `[${i}:v]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,` +
      `zoompan=z='${z}':d=${f}:x='${x}':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},` +
      `setsar=1,format=yuv420p[v${i}]`,
    );
  });

  // Crossfade chain.
  let lastLabel: string;
  if (n === 1) {
    lastLabel = 'v0';
  } else {
    let prev = 'v0';
    let acc = durs[0];
    for (let i = 1; i < n; i++) {
      const out = i === n - 1 ? 'vbg' : `xc${i}`;
      const offset = +(acc - XFADE).toFixed(2);
      const trans = TRANSITIONS[(i - 1) % TRANSITIONS.length];
      fc.push(`[${prev}][v${i}]xfade=transition=${trans}:duration=${XFADE}:offset=${offset}[${out}]`);
      acc = acc + durs[i] - XFADE;
      prev = out;
    }
    lastLabel = 'vbg';
  }

  // Burn captions.
  fc.push(`[${lastLabel}]subtitles={{in_ass}}[vsub]`);

  // Audio graph.
  let hasAudio = true;
  if (voiceIdx >= 0 && musicIdx >= 0) {
    fc.push(
      `[${musicIdx}:a]volume=0.28[mus];` +
      `[${voiceIdx}:a]volume=1.0[vo];` +
      `[vo][mus]amix=inputs=2:duration=longest:dropout_transition=0[amx];` +
      `[amx]afade=t=out:st=${(T - 1.5).toFixed(2)}:d=1.5[aout]`,
    );
  } else if (voiceIdx >= 0) {
    fc.push(`[${voiceIdx}:a]volume=1.0,afade=t=out:st=${(T - 1).toFixed(2)}:d=1[aout]`);
  } else if (musicIdx >= 0) {
    fc.push(
      `[${musicIdx}:a]volume=0.6,afade=t=in:st=0:d=1.5,afade=t=out:st=${(T - 2).toFixed(2)}:d=2[aout]`,
    );
  } else {
    hasAudio = false;
  }

  const filter = fc.join(';');
  const command =
    args.join(' ') +
    ` -filter_complex "${filter}"` +
    ` -map "[vsub]"` +
    (hasAudio ? ` -map "[aout]" -c:a aac -b:a 192k` : ` -an`) +
    ` -r ${FPS} -c:v libx264 -pix_fmt yuv420p -profile:v high -preset medium -crf 19` +
    ` -movflags +faststart -t ${T} {{out_1}}`;

  const createRes = await fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      input_files,
      output_files: { out_1: 'reel.mp4' },
      ffmpeg_command: command,
      max_command_run_seconds: 600,
      vcpu_count: 16,
    }),
  });
  if (!createRes.ok) {
    const e = await createRes.text().catch(() => '');
    throw new Error(`Compositing failed to start (${createRes.status}): ${e.slice(0, 300)}`);
  }
  const { request_id } = await createRes.json();
  if (!request_id) throw new Error('Compositing failed: no request_id returned.');

  const maxAttempts = 360;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const sres = await fetch(STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    });
    const sjson = await sres.json().catch(() => ({}));
    const status = sjson?.status || 'FAILED';
    if (status === 'SUCCESS') {
      const url = sjson?.result?.result?.out_1;
      if (!url) throw new Error('Compositing completed but no output URL.');
      return { videoUrl: url, durationSec: T };
    }
    if (status === 'FAILED') {
      const msg = sjson?.result?.error || 'FFmpeg processing failed';
      throw new Error(`Compositing failed: ${msg}`);
    }
  }
  throw new Error('Compositing timed out.');
}
