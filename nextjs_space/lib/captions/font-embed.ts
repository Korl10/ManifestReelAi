/**
 * ManifestReel AI — Subtitle font embedding for FFmpeg.
 *
 * THE PROBLEM (bug: "chosen subtitle font does not show up in the final reel")
 * --------------------------------------------------------------------------
 * The remote FFmpeg workers do NOT have our Google fonts installed, and the
 * `subtitles` filter's `fontsdir=` option is rejected by the FFmpeg API
 * (validated empirically — any command containing `fontsdir` returns
 * "Bad Request"). As a result libass silently fell back to a default
 * sans-serif: colour / stroke / shadow / animation applied (those are ASS
 * override tags) but the FONT FAMILY did not.
 *
 * THE FIX
 * -------
 * libass automatically loads fonts that are EMBEDDED as attachments inside the
 * subtitle's own Matroska (.mkv) container. So we:
 *   1. mux the generated .ass + the chosen .ttf into a tiny .mkv (stream copy,
 *      no re-encode) using the FFmpeg API, and
 *   2. burn subtitles from that .mkv (`subtitles={{in_subs}}`).
 * This makes the final burned-in subtitles use the EXACT chosen font, with no
 * dependency on server-installed fonts or the blocked `fontsdir` option.
 *
 * The whole approach was validated end-to-end against the real Abacus FFmpeg
 * workers before shipping.
 */
import { ensurePublicLocalAsset, uploadPublicBuffer } from '@/lib/media-storage';

const CREATE_URL = 'https://apps.abacus.ai/api/createRunFfmpegCommandRequest';
const STATUS_URL = 'https://apps.abacus.ai/api/getRunFfmpegCommandStatus';

/**
 * Subtitle font family (as used in the editor / ASS Fontname) -> bundled .ttf
 * file in /public/fonts/subtitles. Each file's INTERNAL family name matches the
 * key exactly, which is what libass matches on.
 */
const FONT_FILES: Record<string, string> = {
  Inter: 'Inter.ttf',
  Poppins: 'Poppins.ttf',
  'Bebas Neue': 'BebasNeue.ttf',
  Montserrat: 'Montserrat.ttf',
  Anton: 'Anton.ttf',
  Oswald: 'Oswald.ttf',
  'Playfair Display': 'PlayfairDisplay.ttf',
  'Roboto Condensed': 'RobotoCondensed.ttf',
  'Archivo Black': 'ArchivoBlack.ttf',
  Karla: 'Karla.ttf',
  Lato: 'Lato.ttf',
  Raleway: 'Raleway.ttf',
  'Open Sans': 'OpenSans.ttf',
  Bangers: 'Bangers.ttf',
  'DM Sans': 'DMSans.ttf',
};

/** Returns the bundled .ttf filename for a font family, or null if unknown. */
export function fontFileFor(family: string | undefined | null): string | null {
  if (!family) return null;
  return FONT_FILES[family] ?? null;
}

/**
 * Build a .mkv that contains the ASS subtitle track plus the chosen font
 * embedded as an attachment. Returns the public URL of the .mkv, or null if
 * anything fails — in which case the caller should fall back to burning the raw
 * .ass (renders a default font, but never breaks generation).
 */
export async function buildSubtitleMkv(
  assUrl: string,
  fontFamily: string | undefined | null,
  apiKey: string,
): Promise<string | null> {
  try {
    const file = fontFileFor(fontFamily);
    if (!file) return null;
    const fontUrl = await ensurePublicLocalAsset(`fonts/subtitles/${file}`, 'font/ttf');

    const command =
      `-i {{in_ass}} -attach {{in_font}}` +
      ` -metadata:s:t mimetype=application/x-truetype-font -c copy {{out_1}}`;

    const createRes = await fetch(CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: apiKey,
        input_files: { in_ass: assUrl, in_font: fontUrl },
        output_files: { out_1: 'subs.mkv' },
        ffmpeg_command: command,
        max_command_run_seconds: 120,
        vcpu_count: 4,
      }),
    });
    if (!createRes.ok) return null;
    const { request_id } = await createRes.json();
    if (!request_id) return null;

    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const sres = await fetch(STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: apiKey }),
      });
      const sjson = await sres.json().catch(() => ({}));
      const status = sjson?.status || 'FAILED';
      if (status === 'SUCCESS') {
        const cdnUrl: string | null = sjson?.result?.result?.out_1 || null;
        if (!cdnUrl) return null;
        // The FFmpeg output CDN (cdn.abacus.ai) is NOT reachable by a subsequent
        // FFmpeg worker ("UNREACHABLE_INPUT_FILE"), so re-host the .mkv to S3,
        // whose public URLs are proven-fetchable as composite inputs.
        const res = await fetch(cdnUrl);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return await uploadPublicBuffer(buf, 'subs.mkv', 'video/x-matroska');
      }
      if (status === 'FAILED') return null;
    }
    return null;
  } catch {
    return null;
  }
}
