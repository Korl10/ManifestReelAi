'use client';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Type, Palette, Move, Sparkles, ChevronDown, ChevronRight,
  Smartphone, RotateCcw, Play, Lock,
} from 'lucide-react';
import type { SubtitleStyle, SubtitleAnimation, SubtitlePosition, PlatformSafeZone } from '@/lib/captions/subtitle-types';
import {
  SUBTITLE_FONTS, ANIMATION_PRESETS, PLATFORM_SAFE_MARGINS,
} from '@/lib/captions/subtitle-types';
import { FREE_FONTS, FREE_COLORS, FREE_ANIMATION } from '@/lib/free-tier';
import Link from 'next/link';

interface SubtitleEditorProps {
  value: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  previewText?: string; // sample text for live preview
  /** Free tier: restrict to 3 fonts, 3 colors, default animation only. */
  lockedFree?: boolean;
}

const POSITIONS: { value: SubtitlePosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];

const PLATFORMS: { value: PlatformSafeZone; label: string; desc: string }[] = [
  { value: 'reels', label: 'IG Reels', desc: 'Bottom 18% safe' },
  { value: 'tiktok', label: 'TikTok', desc: 'Bottom 18% safe' },
  { value: 'shorts', label: 'YT Shorts', desc: 'Bottom 22% safe' },
  { value: 'none', label: 'Custom', desc: 'No safe zone' },
];

/** CapCut-style one-click presets. Each overwrites all relevant style fields atomically. */
const PRESETS: { id: string; label: string; swatchBg: string; swatchColor: string; style: Partial<SubtitleStyle> }[] = [
  {
    id: 'clean-white', label: 'Clean White', swatchBg: '#111', swatchColor: '#FFFFFF',
    style: { fontFamily: 'Inter', textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, shadowEnabled: false, highlightEnabled: false, activeWordColor: '#FFD700', animation: 'karaoke' },
  },
  {
    id: 'bold-yellow', label: 'Bold Yellow', swatchBg: '#111', swatchColor: '#FFD700',
    style: { fontFamily: 'Anton', textColor: '#FFD700', strokeColor: '#000000', strokeWidth: 4, shadowEnabled: false, highlightEnabled: false, activeWordColor: '#FFFFFF', animation: 'pop' },
  },
  {
    id: 'pill-bg', label: 'Pill BG', swatchBg: '#000', swatchColor: '#FFFFFF',
    style: { fontFamily: 'DM Sans', textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 0, shadowEnabled: false, highlightEnabled: true, highlightColor: '#000000', highlightOpacity: 70, activeWordColor: '#FFD700', animation: 'fade-in' },
  },
  {
    id: 'karaoke-pop', label: 'Karaoke Pop', swatchBg: '#111', swatchColor: '#FF3B30',
    style: { fontFamily: 'Bebas Neue', textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, shadowEnabled: false, highlightEnabled: false, activeWordColor: '#FF3B30', animation: 'karaoke' },
  },
  {
    id: 'minimal', label: 'Minimal', swatchBg: '#111', swatchColor: '#FFFFFF',
    style: { fontFamily: 'Inter', textColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, shadowEnabled: false, highlightEnabled: false, activeWordColor: '#FFFFFF', animation: 'fade-in' },
  },
];

/** Convert #RRGGBB + 0-100 opacity to an rgba() string. */
function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

/**
 * Build a CSS text-shadow string that simulates an outline/stroke.
 * Uses 8-directional offsets so the "stroke" renders BEHIND the text fill,
 * avoiding the -webkit-text-stroke problem where the stroke paints on TOP
 * and destroys narrow-glyph fonts like Bebas Neue.
 */
function buildStrokeShadow(color: string, widthPx: number): string {
  if (widthPx <= 0) return '';
  const w = widthPx;
  // 8 cardinal + diagonal offsets
  return [
    `${-w}px ${-w}px 0 ${color}`,
    `${w}px ${-w}px 0 ${color}`,
    `${-w}px ${w}px 0 ${color}`,
    `${w}px ${w}px 0 ${color}`,
    `0 ${-w}px 0 ${color}`,
    `0 ${w}px 0 ${color}`,
    `${-w}px 0 0 ${color}`,
    `${w}px 0 0 ${color}`,
  ].join(', ');
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <div className="relative w-9 h-9 sm:w-7 sm:h-7 rounded-md border border-white/10 overflow-hidden cursor-pointer">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full h-full" style={{ backgroundColor: value }} />
      </div>
      <span className="text-[11px] text-white/50">{label}</span>
    </label>
  );
}

function RangeInput({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const clampedPct = Math.max(0, Math.min(100, pct));
  return (
    <label className="flex flex-col gap-1 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] text-white/70 font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${clampedPct}%, rgba(255,255,255,0.12) ${clampedPct}%, rgba(255,255,255,0.12) 100%)` }}
        className="w-full h-3 rounded-full appearance-none cursor-pointer touch-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#D4AF37] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-grab"
      />
    </label>
  );
}

const PER_WORD_MS = 350;
const LOOP_HOLD_MS = 850;
const DEMO_PHRASE = 'Your abundance flows toward you now';

export default function SubtitleEditor({ value, onChange, previewText, lockedFree }: SubtitleEditorProps) {
  const fontOptions = lockedFree ? SUBTITLE_FONTS.filter(f => (FREE_FONTS as readonly string[]).includes(f)) : SUBTITLE_FONTS;
  const animationOptions = lockedFree ? ANIMATION_PRESETS.filter(a => a.value === FREE_ANIMATION) : ANIMATION_PRESETS;
  const [expandedSection, setExpandedSection] = useState<string | null>('animation');

  const update = useCallback(<K extends keyof SubtitleStyle>(key: K, val: SubtitleStyle[K]) => {
    onChange({ ...value, [key]: val });
  }, [value, onChange]);

  const applyPreset = useCallback((style: Partial<SubtitleStyle>) => {
    onChange({ ...value, ...style });
  }, [value, onChange]);

  // ── Demo words for animated preview ──
  const words = useMemo(() => (previewText || DEMO_PHRASE).trim().split(/\s+/), [previewText]);

  // ── Section 3: wait for the selected font to load before rendering preview ──
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFontReady(false);
    const fam = value.fontFamily;
    const docFonts: any = typeof document !== 'undefined' ? (document as any).fonts : null;
    if (docFonts && typeof docFonts.load === 'function') {
      Promise.all([
        docFonts.load(`400 40px "${fam}"`),
        docFonts.load(`700 40px "${fam}"`),
      ])
        .then(() => docFonts.ready)
        .then(() => { if (!cancelled) setFontReady(true); })
        .catch(() => { if (!cancelled) setFontReady(true); });
    } else {
      setFontReady(true);
    }
    return () => { cancelled = true; };
  }, [value.fontFamily]);

  // ── Section 4: animated word-by-word playback ──
  const [activeIdx, setActiveIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (!playing) return;
    let idx = 0;
    setActiveIdx(0);
    const step = () => {
      setActiveIdx(idx);
      if (idx < words.length - 1) {
        idx++;
        timersRef.current.push(setTimeout(step, PER_WORD_MS));
      } else {
        timersRef.current.push(setTimeout(() => setCycle(c => c + 1), LOOP_HOLD_MS));
      }
    };
    timersRef.current.push(setTimeout(step, 250));
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [words, playing, cycle]);

  const replay = useCallback(() => {
    setPlaying(true);
    setActiveIdx(0);
    setCycle(c => c + 1);
  }, []);

  // Compute safe zone indicator
  const safeBottomPx = PLATFORM_SAFE_MARGINS[value.platform] ?? 430;
  const safeBottomPct = ((safeBottomPx / 1920) * 100).toFixed(0);

  const anim = value.animation;
  const isKaraoke = anim === 'karaoke';

  // Per-word style for the animated preview.
  const renderWord = (w: string, i: number) => {
    const revealed = i <= activeIdx;
    const isActive = i === activeIdx;

    // Karaoke shows the whole phrase; other animations reveal words progressively.
    const visible = isKaraoke ? true : revealed;

    let color = value.textColor;
    if (isKaraoke) {
      color = isActive ? value.activeWordColor : (i < activeIdx ? value.textColor : `${value.textColor}59`);
    } else {
      color = isActive ? value.activeWordColor : value.textColor;
    }

    const base: React.CSSProperties = {
      color,
      fontWeight: isActive ? 700 : 600,
      display: 'inline-block',
      whiteSpace: 'pre',
      transition: 'color 0.15s ease',
    };

    if (!visible) {
      base.opacity = 0;
    } else if (anim === 'karaoke') {
      base.transform = isActive ? 'scale(1.12)' : 'scale(1)';
      base.transition = 'transform 0.18s ease, color 0.15s ease';
    } else if (revealed) {
      // entrance animation applied when the word is revealed
      const animName =
        anim === 'pop' ? 'subPop'
        : anim === 'slide-up' ? 'subSlideUp'
        : anim === 'bounce' ? 'subBounce'
        : anim === 'typewriter' ? 'subType'
        : 'subFade';
      base.animation = `${animName} 0.32s ease both`;
      if (anim === 'typewriter') {
        base.overflow = 'hidden';
        base.verticalAlign = 'bottom';
      }
    }

    return (
      <span key={`${cycle}-${i}`} style={base}>{w}{i < words.length - 1 ? ' ' : ''}</span>
    );
  };

  const Section = ({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-white/60 hover:text-white/80 transition"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {expandedSection === id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {expandedSection === id && (
        <div className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Keyframes for preview animations (match the 6 rendered styles). */}
      <style jsx global>{`
        @keyframes subFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes subPop { 0% { opacity: 0; transform: scale(0.3); } 60% { opacity: 1; transform: scale(1.18); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes subSlideUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes subBounce { 0% { opacity: 0; transform: translateY(26px); } 55% { opacity: 1; transform: translateY(-8px); } 75% { transform: translateY(3px); } 100% { transform: translateY(0); } }
        @keyframes subType { from { opacity: 0; max-width: 0; } to { opacity: 1; max-width: 100%; } }
      `}</style>

      {/* ── Section 2: CapCut-style preset row (hidden on free tier to respect limits) ── */}
      {!lockedFree && (
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Quick Presets</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.style)}
                className="shrink-0 flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-[#D4AF37]/40 hover:bg-white/[0.05] transition min-w-[88px]"
              >
                <div
                  className="w-full h-9 rounded-md flex items-center justify-center text-sm font-bold"
                  style={{ background: p.swatchBg, color: p.swatchColor, fontFamily: p.style.fontFamily }}
                >
                  Aa
                </div>
                <span className="text-[10px] text-white/60 whitespace-nowrap">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Section 4: Live Preview (animated playback) ── */}
        <div className="order-1 lg:order-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Live Preview</p>
            <button
              type="button"
              onClick={replay}
              className="flex items-center gap-1 text-[10px] text-white/50 hover:text-[#D4AF37] transition"
            >
              {playing ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />} Replay
            </button>
          </div>
          <div
            className="relative rounded-xl overflow-hidden border border-white/10 mx-auto"
            style={{ aspectRatio: '9/16', maxHeight: 480, width: '100%', background: 'linear-gradient(135deg, #1a0a2e 0%, #0a0a0a 50%, #1a0a2e 100%)' }}
          >
            {/* Safe zone indicator */}
            {value.platform !== 'none' && (
              <div
                className="absolute left-0 right-0 bottom-0 border-t border-red-500/30 bg-red-500/5"
                style={{ height: `${safeBottomPct}%` }}
              >
                <span className="absolute top-1 left-2 text-[8px] text-red-400/50 uppercase">Safe zone ({safeBottomPct}%)</span>
              </div>
            )}

            {/* Subtitle preview */}
            <div
              className="absolute left-4 right-4 flex items-center justify-center transition-transform duration-150"
              style={{
                ...(value.position === 'top' ? { top: '8%' } : value.position === 'center' ? { top: '42%' } : { bottom: `${Math.max(5, parseInt(safeBottomPct) + 2)}%` }),
                // Reflect Y Offset: +value moves text DOWN from top anchor, UP from bottom/center anchor.
                transform: `translateY(${(value.position === 'top' ? 1 : -1) * (value.customYOffset ?? 0) * 0.25}px)`,
              }}
            >
              <div
                className="text-center px-2.5 py-1.5 rounded-lg"
                style={{
                  fontFamily: `"${value.fontFamily}", sans-serif`,
                  fontSize: `${Math.round(value.fontSize / 4.5)}px`,
                  lineHeight: 1.3,
                  visibility: fontReady ? 'visible' : 'hidden',
                  textShadow: [
                    // Stroke outline via text-shadow (renders BEHIND text, not on top)
                    buildStrokeShadow(value.strokeColor, Math.max(0, value.strokeWidth / 4)),
                    // Drop shadow (if enabled)
                    value.shadowEnabled
                      ? `${value.shadowDepth}px ${value.shadowDepth}px ${value.shadowDepth * 2}px ${hexToRgba(value.shadowColor, value.shadowOpacity ?? 60)}`
                      : '',
                  ].filter(Boolean).join(', ') || 'none',
                  backgroundColor: value.highlightEnabled
                    ? hexToRgba(value.highlightColor, value.highlightOpacity)
                    : 'transparent',
                }}
              >
                {words.map(renderWord)}
              </div>
            </div>

            {/* Phone frame overlay */}
            <div className="absolute inset-0 pointer-events-none border-2 border-white/5 rounded-xl" />
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="order-2 lg:order-1 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <Section id="font" icon={<Type className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Font">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {fontOptions.map(f => (
                <button
                  key={f}
                  onClick={() => update('fontFamily', f)}
                  className={`px-2 py-2.5 sm:py-1.5 rounded-md text-xs sm:text-[10px] truncate transition min-h-[44px] sm:min-h-0 ${
                    value.fontFamily === f
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                  }`}
                  style={{ fontFamily: `"${f}", sans-serif` }}
                >
                  {f}
                </button>
              ))}
            </div>
            {lockedFree && (
              <Link href="/dashboard/settings" className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 mt-1"><Lock className="w-3 h-3" /> More fonts on Pro</Link>
            )}
            <RangeInput label="Size" value={value.fontSize} min={40} max={120} onChange={v => update('fontSize', v)} />
          </Section>

          <Section id="colors" icon={<Palette className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Colors">
            {lockedFree ? (
              <div>
                <span className="text-[11px] text-white/50 block mb-1.5">Text color</span>
                <div className="flex items-center gap-2">
                  {FREE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update('textColor', c)}
                      aria-label={`Text color ${c}`}
                      className={`w-8 h-8 rounded-md border-2 transition ${value.textColor?.toUpperCase() === c ? 'border-[#D4AF37] scale-110' : 'border-white/15'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <Link href="/dashboard/settings" className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 ml-1"><Lock className="w-3 h-3" /> Full palette on Pro</Link>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Text" value={value.textColor} onChange={v => update('textColor', v)} />
              <ColorInput label="Active Word" value={value.activeWordColor} onChange={v => update('activeWordColor', v)} />
              <ColorInput label="Stroke" value={value.strokeColor} onChange={v => update('strokeColor', v)} />
            </div>
            )}
            {!lockedFree && (<>
            <RangeInput label="Stroke Width" value={value.strokeWidth} min={0} max={8} onChange={v => update('strokeWidth', v)} suffix="px" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => update('highlightEnabled', !value.highlightEnabled)}
                className={`px-2 py-1 rounded text-[10px] transition ${
                  value.highlightEnabled ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40'
                }`}
              >
                Highlight Box
              </button>
              {value.highlightEnabled && (
                <>
                  <ColorInput label="" value={value.highlightColor} onChange={v => update('highlightColor', v)} />
                  <RangeInput label="Opacity" value={value.highlightOpacity} min={0} max={100} onChange={v => update('highlightOpacity', v)} suffix="%" />
                </>
              )}
            </div>

            {/* ── Section 1: Shadow control (Off|On toggle, default Off) ── */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">Shadow</span>
                <div className="flex rounded-md overflow-hidden border border-white/10">
                  <button
                    type="button"
                    onClick={() => update('shadowEnabled', false)}
                    className={`px-3 py-1 text-[10px] transition ${!value.shadowEnabled ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    onClick={() => update('shadowEnabled', true)}
                    className={`px-3 py-1 text-[10px] transition ${value.shadowEnabled ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
                  >
                    On
                  </button>
                </div>
              </div>
              {value.shadowEnabled && (
                <div className="space-y-2.5 pl-1 border-l-2 border-[#D4AF37]/20">
                  <div className="pl-2">
                    <RangeInput label="Opacity" value={value.shadowOpacity ?? 60} min={0} max={100} onChange={v => update('shadowOpacity', v)} suffix="%" />
                  </div>
                  <div className="pl-2">
                    <RangeInput label="Depth" value={value.shadowDepth} min={0} max={8} onChange={v => update('shadowDepth', v)} suffix="px" />
                  </div>
                  <div className="pl-2">
                    <ColorInput label="Shadow color" value={value.shadowColor} onChange={v => update('shadowColor', v)} />
                  </div>
                </div>
              )}
            </div>
            </>)}
          </Section>

          <Section id="animation" icon={<Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Animation">
            <div className="grid grid-cols-2 gap-1.5">
              {animationOptions.map(a => (
                <button
                  key={a.value}
                  onClick={() => update('animation', a.value)}
                  className={`px-2 py-2.5 rounded-md text-left transition min-h-[44px] ${
                    value.animation === a.value
                      ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className={`text-[11px] font-medium ${value.animation === a.value ? 'text-[#D4AF37]' : 'text-white/70'}`}>{a.label}</p>
                  <p className="text-[9px] text-white/35 mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
            {lockedFree && (
              <Link href="/dashboard/settings" className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 mt-1"><Lock className="w-3 h-3" /> More animation styles on Pro</Link>
            )}
            <RangeInput label="Words Per Phrase" value={value.wordsPerPhrase} min={1} max={6} onChange={v => update('wordsPerPhrase', v)} />
          </Section>

          <Section id="position" icon={<Move className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Position">
            <div className="flex gap-1.5">
              {POSITIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => update('position', p.value)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[10px] text-center transition ${
                    value.position === p.value
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <RangeInput label="Y Offset" value={value.customYOffset} min={-200} max={200} onChange={v => update('customYOffset', v)} suffix="px" />
          </Section>

          <Section id="platform" icon={<Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Platform Safe Zone">
            <div className="grid grid-cols-2 gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => update('platform', p.value)}
                  className={`px-2 py-2.5 rounded-md text-left transition min-h-[44px] ${
                    value.platform === p.value
                      ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className={`text-[11px] font-medium ${value.platform === p.value ? 'text-[#D4AF37]' : 'text-white/70'}`}>{p.label}</p>
                  <p className="text-[9px] text-white/35">{p.desc}</p>
                </button>
              ))}
            </div>
            <RangeInput label="Max Chars/Line" value={value.maxCharsPerLine} min={16} max={48} onChange={v => update('maxCharsPerLine', v)} />
            <RangeInput label="Max Lines" value={value.maxLines} min={1} max={3} onChange={v => update('maxLines', v)} />
          </Section>
        </div>
      </div>
    </div>
  );
}
