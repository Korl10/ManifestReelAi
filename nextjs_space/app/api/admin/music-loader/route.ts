export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generatePresignedUploadUrl, getPublicUrl } from '@/lib/s3';
import { parseTrackFilename, CATEGORY_MAP, type MusicCategory } from '@/lib/music-categories';

const CREATE_URL = 'https://apps.abacus.ai/api/createRunFfmpegCommandRequest';
const STATUS_URL = 'https://apps.abacus.ai/api/getRunFfmpegCommandStatus';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') return null;
  return session;
}

// ── GET: list all uploaded V2 tracks ─────────────────────────────────
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const tracks = await prisma.libraryTrack.findMany({
      orderBy: [{ category: 'asc' }, { sequence: 'asc' }],
    });
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error('[music-loader] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}

// ── POST: upload + process a batch of tracks ─────────────────────────
// Body: { files: [{ filename, durationSec, cloudStoragePath }], dryRun?: boolean }
// Each file was already uploaded to S3 via presigned URL by the client.
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { files, dryRun } = body ?? {};
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'files array is required' }, { status: 400 });
    }

    const results: any[] = [];

    for (const f of files) {
      const { filename, durationSec, cloudStoragePath, bpmOverride } = f;
      // Parse filename
      const parsed = parseTrackFilename(filename);
      if (!parsed) {
        results.push({
          filename,
          status: 'error',
          error: `Invalid filename pattern. Expected: {category}_{nn}_{descriptor}.mp3`,
        });
        continue;
      }

      const { category, sequence, slug, title } = parsed;
      const meta = CATEGORY_MAP[category as MusicCategory];
      if (!meta) {
        results.push({ filename, status: 'error', error: `Unknown category: ${category}` });
        continue;
      }

      // Check for duplicate
      const existing = await prisma.libraryTrack.findUnique({
        where: { category_sequence: { category, sequence } },
      });

      const bpm = bpmOverride ?? Math.round((meta.bpmRange[0] + meta.bpmRange[1]) / 2);

      const rawDur = durationSec ?? 0;
      // Every track is normalized to EXACTLY 60s on processing.
      const outputDurPreview = 60;
      const fillMode = rawDur <= 0 ? 'normalize' : rawDur > 60 ? 'trim' : rawDur < 60 ? 'loop' : 'exact';

      const preview = {
        filename,
        category,
        sequence,
        slug,
        title,
        mood: meta.mood,
        style: meta.style,
        energy: meta.energy,
        bpm,
        durationSec: rawDur,
        outputDurationSec: outputDurPreview,
        willTrim: rawDur > 60,
        fillMode,
        duplicate: !!existing,
        duplicateId: existing?.id ?? null,
      };

      if (dryRun) {
        results.push({ ...preview, status: 'dry-run' });
        continue;
      }

      // Get public URL of the uploaded raw file
      const originalUrl = getPublicUrl(cloudStoragePath);

      // Process via FFmpeg API: normalize to EXACTLY 60s (loop-fill short / trim long)
      // + 0.5s fade-in + 0.8s fade-out at 59.2s + LUFS -14
      const outputDur = 60;
      let processedUrl = originalUrl;
      try {
        processedUrl = await processTrackAudio(originalUrl);
      } catch (err) {
        console.error(`[music-loader] FFmpeg processing failed for ${filename}, using original:`, err);
        // Fall back to original URL if processing fails
      }

      // Upsert into DB (stored duration = trimmed output)
      const track = await prisma.libraryTrack.upsert({
        where: { category_sequence: { category, sequence } },
        create: {
          title,
          slug,
          category,
          sequence,
          cloudUrl: processedUrl,
          originalUrl,
          durationSec: outputDur,
          bpm,
          mood: meta.mood,
          style: meta.style,
          energy: meta.energy,
          source: 'curated_v2',
        },
        update: {
          title,
          slug,
          cloudUrl: processedUrl,
          originalUrl,
          durationSec: outputDur,
          bpm,
          mood: meta.mood,
          style: meta.style,
          energy: meta.energy,
        },
      });

      results.push({
        ...preview,
        status: existing ? 'replaced' : 'created',
        trackId: track.id,
        cloudUrl: processedUrl,
      });
    }

    return NextResponse.json({
      total: files.length,
      created: results.filter(r => r.status === 'created').length,
      replaced: results.filter(r => r.status === 'replaced').length,
      errors: results.filter(r => r.status === 'error').length,
      dryRun: !!dryRun,
      results,
    });
  } catch (err) {
    console.error('[music-loader] POST error:', err);
    return NextResponse.json({ error: 'Failed to process tracks' }, { status: 500 });
  }
}

// ── POST presign endpoint ────────────────────────────────────────────
// Generates a presigned upload URL for the admin to upload a track to S3.
// Called per-file from the client before the main POST.

// ── FFmpeg processing: normalize every track to EXACTLY 60s ─────────
// Pipeline: input → -stream_loop -1 (repeat the source indefinitely) →
//   -t 60 (hard-cut at exactly 60s) → 0.5s fade-in at 0:00 →
//   0.8s fade-out at 0:59.2 → LUFS -14 normalization → 192k MP3.
//
// Why stream_loop instead of silence-padding: short Suno tracks (e.g. 44.8s)
// are looped to fill the full 60s with continuous music — never silence.
// Long tracks (>60s) are simply cut at 60s on the first pass. The result
// is a uniform 60s master for every track, so the matcher can never pick a
// track shorter than the reel (max reel = 30s) and the compositor never
// has to loop or run dry.
async function processTrackAudio(inputUrl: string): Promise<string> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('ABACUSAI_API_KEY not configured');

  const MAX_DUR = 60;
  const FADE_IN = 0.5;
  const FADE_OUT = 0.8;
  const fadeOutStart = MAX_DUR - FADE_OUT; // 59.2 — always, since output is always 60s

  // -stream_loop -1 repeats the input forever; -t 60 cuts the output at 60s.
  // This both loop-fills short tracks AND trims long tracks in one pass.
  const command = `-stream_loop -1 -i {{in_1}} -t ${MAX_DUR} -af "afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT},loudnorm=I=-14:TP=-1:LRA=11" -c:a libmp3lame -b:a 192k {{out_1}}`;

  const createRes = await fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      input_files: { in_1: inputUrl },
      output_files: { out_1: 'processed.mp3' },
      ffmpeg_command: command,
      max_command_run_seconds: 120,
    }),
  });

  if (!createRes.ok) {
    const e = await createRes.text().catch(() => '');
    throw new Error(`FFmpeg create failed (${createRes.status}): ${e.slice(0, 200)}`);
  }

  const { request_id } = await createRes.json();
  if (!request_id) throw new Error('FFmpeg: no request_id');

  // Poll for completion (max 2 min)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const sres = await fetch(STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    });
    const sjson = await sres.json().catch(() => ({}));
    const status = sjson?.status || 'FAILED';
    if (status === 'SUCCESS') {
      const url = sjson?.result?.result?.out_1;
      if (!url) throw new Error('FFmpeg completed but no output URL.');
      return url;
    }
    if (status === 'FAILED') {
      throw new Error(`FFmpeg processing failed: ${JSON.stringify(sjson?.result).slice(0, 200)}`);
    }
  }
  throw new Error('FFmpeg processing timed out after 2 minutes.');
}
