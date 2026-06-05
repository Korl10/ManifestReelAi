import { WordTimestamp } from '@/lib/providers/types';
import type { SubtitleStyle, SubtitleAnimation, PlatformSafeZone } from './subtitle-types';
import { DEFAULT_SUBTITLE_STYLE, PLATFORM_SAFE_MARGINS } from './subtitle-types';

// ── ASS colour helpers ──
// ASS colours are &HAABBGGRR (alpha, blue, green, red).
function hexToAss(hex: string, alpha = 0): string {
  const h = hex.replace('#', '');
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  const a = alpha.toString(16).padStart(2, '0').toUpperCase();
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

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

// ── Auto line-break: max N chars, max M lines ──
function autoLineBreak(text: string, maxChars: number, maxLines: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.join('\\N');
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

// ── Position helpers ──
function resolveMarginV(style: SubtitleStyle): number {
  const basePlatform = PLATFORM_SAFE_MARGINS[style.platform] ?? PLATFORM_SAFE_MARGINS.none;
  const posOffset = style.position === 'top' ? 1400 : style.position === 'center' ? 700 : 0;
  return basePlatform + posOffset + (style.customYOffset ?? 0);
}

function resolveAlignment(style: SubtitleStyle): number {
  // ASS alignment: 2=bottom-center, 5=mid-center, 8=top-center
  if (style.position === 'top') return 8;
  if (style.position === 'center') return 5;
  return 2;
}

// ── Animation-specific ASS override tags ──
function animationEntryTags(anim: SubtitleAnimation, phraseIdx: number): string {
  switch (anim) {
    case 'pop':
      return '{\\fscx0\\fscy0\\t(0,120,\\fscx100\\fscy100)}';
    case 'fade-in':
      return '{\\fad(250,0)}';
    case 'typewriter':
      // Typewriter uses \\kf (progressive fill) built into karaoke tags below
      return '';
    case 'slide-up':
      return `{\\move(540,${960 + 80},540,960,0,200)\\fad(150,0)}`;
    case 'bounce':
      return '{\\fscx120\\fscy120\\t(0,100,\\fscx100\\fscy100)\\t(100,180,\\fscx108\\fscy108)\\t(180,250,\\fscx100\\fscy100)}';
    case 'karaoke':
    default:
      return phraseIdx === 0 ? '{\\fad(120,0)}' : '';
  }
}

// ── Build the highlighted word for karaoke/pop animations ──
function renderPhrase(
  phrase: WordTimestamp[],
  activeIdx: number,
  style: SubtitleStyle,
  anim: SubtitleAnimation,
): string {
  const primaryColor = hexToAss(style.textColor);
  const activeColor = hexToAss(style.activeWordColor);
  const dimColor = hexToAss(style.textColor, 0x40); // 25% transparent

  return phrase
    .map((w, idx) => {
      const word = esc(w.word);
      if (anim === 'karaoke' || anim === 'pop') {
        if (idx === activeIdx) return `{\\c${activeColor}\\fscx116\\fscy116\\b1}${word}{\\r}`;
        if (idx < activeIdx) return `{\\c${primaryColor}}${word}{\\r}`;
        return `{\\c${dimColor}}${word}{\\r}`;
      }
      if (anim === 'typewriter') {
        // All words shown, active word bold
        if (idx === activeIdx) return `{\\c${activeColor}\\b1}${word}{\\r}`;
        return `{\\c${primaryColor}}${word}{\\r}`;
      }
      // fade-in, slide-up, bounce: all same color, active bold
      if (idx === activeIdx) return `{\\c${activeColor}\\b1}${word}{\\r}`;
      return `{\\c${primaryColor}}${word}{\\r}`;
    })
    .join(' ');
}

export interface BuildAssOptions {
  style?: Partial<SubtitleStyle>;
  watermark?: boolean;
  totalDuration?: number;
  // Legacy compat
  fontSize?: number;
  marginV?: number;
  fontName?: string;
}

export function buildAss(
  lineTexts: string[],
  words: WordTimestamp[],
  opts?: BuildAssOptions,
): string {
  // Merge defaults with any provided style overrides
  const s: SubtitleStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...(opts?.style ?? {}),
  };

  // Legacy overrides
  if (opts?.fontSize) s.fontSize = opts.fontSize;
  if (opts?.fontName) s.fontFamily = opts.fontName;
  if (opts?.marginV !== undefined) s.customYOffset = opts.marginV - PLATFORM_SAFE_MARGINS.none;

  const fontSize = s.fontSize;
  const fontName = s.fontFamily;
  const marginV = resolveMarginV(s);
  const alignment = resolveAlignment(s);
  const primaryColor = hexToAss(s.textColor);
  const outlineColor = hexToAss(s.strokeColor);
  const shadowColor = hexToAss(s.shadowColor);
  const backColor = s.highlightEnabled
    ? hexToAss(s.highlightColor, Math.round((1 - s.highlightOpacity / 100) * 255))
    : hexToAss('#000000', 0x96);
  const borderStyle = s.highlightEnabled ? 3 : 1; // 3 = opaque box, 1 = outline+shadow
  const outline = s.strokeWidth;
  const shadow = s.shadowEnabled ? s.shadowDepth : 0;
  const phraseSize = s.wordsPerPhrase;

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
    `Style: Base,${fontName},${fontSize},${primaryColor},${primaryColor},${outlineColor},${backColor},-1,0,0,0,100,100,1,0,${borderStyle},${outline},${shadow},${alignment},90,90,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events: string[] = [];
  const cursor = { i: 0 };
  const anim = s.animation;

  for (const line of lineTexts) {
    const lineWords = wordsForLine(line, words, cursor);
    if (!lineWords.length) continue;

    for (let p = 0; p < lineWords.length; p += phraseSize) {
      const phrase = lineWords.slice(p, p + phraseSize);

      if (anim === 'fade-in' || anim === 'slide-up' || anim === 'bounce') {
        // One event for the whole phrase
        const start = phrase[0].start;
        const end = phrase[phrase.length - 1].end + 0.15;
        const entry = animationEntryTags(anim, p);
        const text = phrase.map(w => esc(w.word)).join(' ');
        const broken = autoLineBreak(text, s.maxCharsPerLine, s.maxLines);
        events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Base,,0,0,0,,${entry}${broken}`);
      } else {
        // Per-word events (karaoke, pop, typewriter)
        for (let a = 0; a < phrase.length; a++) {
          const start = phrase[a].start;
          const end = a + 1 < phrase.length ? phrase[a + 1].start : phrase[a].end + 0.05;
          const entry = a === 0 ? animationEntryTags(anim, p) : '';
          const rendered = renderPhrase(phrase, a, s, anim);
          events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Base,,0,0,0,,${entry}${rendered}`);
        }
      }
    }
  }

  // Optional free-tier watermark
  if (opts?.watermark) {
    const end = assTime(opts.totalDuration ?? 60);
    events.unshift(`Dialogue: 0,0:00:00.00,${end},Base,,0,0,0,,{\\an9\\fs44\\b1\\1c&H00D4AF37&\\alpha&H30&\\pos(1040,70)}ManifestReel`);
  }

  return [...header, ...events].join('\n') + '\n';
}
