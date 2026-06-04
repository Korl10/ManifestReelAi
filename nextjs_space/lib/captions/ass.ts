import { WordTimestamp } from '@/lib/providers/types';

// ASS colours are &HAABBGGRR.
const WHITE = '&H00FFFFFF';
const PURPLE = '&H00BE2F7B'; // #7B2FBE
const DIM = '&H40FFFFFF'; // upcoming words: slightly transparent white

const PHRASE_SIZE = 3; // words shown together on screen at once

function assTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  const cc = cs >= 100 ? 99 : cs;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

function esc(t: string): string {
  return (t || '').replace(/[{}]/g, '').replace(/\\/g, '').replace(/\r?\n/g, ' ').trim();
}

/** Greedily map a flat word-timestamp list onto the ordered affirmation lines. */
function wordsForLine(lineText: string, pool: WordTimestamp[], cursor: { i: number }): WordTimestamp[] {
  const count = esc(lineText).split(/\s+/).filter(Boolean).length;
  const out: WordTimestamp[] = [];
  for (let k = 0; k < count && cursor.i < pool.length; k++) {
    out.push(pool[cursor.i++]);
  }
  return out;
}

export function buildAss(lineTexts: string[], words: WordTimestamp[], opts?: { fontSize?: number; marginV?: number; fontName?: string; watermark?: boolean; totalDuration?: number }): string {
  const fontSize = opts?.fontSize ?? 92;
  const marginV = opts?.marginV ?? 430;
  const fontName = opts?.fontName ?? 'DejaVu Sans';

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Base,${fontName},${fontSize},${WHITE},${WHITE},&H00000000,&H96000000,-1,0,0,0,100,100,1,0,1,5,3,2,90,90,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events: string[] = [];
  const cursor = { i: 0 };

  for (const line of lineTexts) {
    const lineWords = wordsForLine(line, words, cursor);
    if (!lineWords.length) continue;
    // Chunk this line into phrases.
    for (let p = 0; p < lineWords.length; p += PHRASE_SIZE) {
      const phrase = lineWords.slice(p, p + PHRASE_SIZE);
      // One event per word in the phrase: phrase stays on screen, active word highlights.
      for (let a = 0; a < phrase.length; a++) {
        const start = phrase[a].start;
        const end = a + 1 < phrase.length ? phrase[a + 1].start : phrase[a].end + 0.05;
        const rendered = phrase
          .map((w, idx) => {
            const word = esc(w.word);
            if (idx === a) return `{\\c${PURPLE}\\fscx116\\fscy116\\b1}${word}{\\r}`;
            if (idx < a) return `{\\c${WHITE}}${word}{\\r}`;
            return `{\\c${DIM}}${word}{\\r}`;
          })
          .join(' ');
        const fade = a === 0 ? '{\\fad(120,0)}' : '';
        events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Base,,0,0,0,,${fade}${rendered}`);
      }
    }
  }

  // Optional free-tier watermark, rendered with libass (reliable fonts).
  if (opts?.watermark) {
    const end = assTime(opts.totalDuration ?? 60);
    events.unshift(`Dialogue: 0,0:00:00.00,${end},Base,,0,0,0,,{\\an9\\fs44\\b1\\1c&H00D4AF37&\\alpha&H30&\\pos(1040,70)}ManifestReel`);
  }

  return [...header, ...events].join('\n') + '\n';
}
