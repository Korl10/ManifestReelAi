'use client';
import React, { useState, useCallback, useMemo } from 'react';
import {
  Type, Palette, Move, Sparkles, ChevronDown, ChevronRight,
  Smartphone, Monitor, AlignCenter,
} from 'lucide-react';
import type { SubtitleStyle, SubtitleAnimation, SubtitlePosition, PlatformSafeZone } from '@/lib/captions/subtitle-types';
import {
  DEFAULT_SUBTITLE_STYLE, SUBTITLE_FONTS, ANIMATION_PRESETS, PLATFORM_SAFE_MARGINS,
} from '@/lib/captions/subtitle-types';

interface SubtitleEditorProps {
  value: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  previewText?: string; // sample text for live preview
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

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <div className="relative w-7 h-7 rounded-md border border-white/10 overflow-hidden cursor-pointer">
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
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/50">{label}</span>
        <span className="text-[11px] text-white/70 font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </label>
  );
}

export default function SubtitleEditor({ value, onChange, previewText }: SubtitleEditorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('animation');

  const update = useCallback(<K extends keyof SubtitleStyle>(key: K, val: SubtitleStyle[K]) => {
    onChange({ ...value, [key]: val });
  }, [value, onChange]);

  const sampleText = previewText || 'Your abundance is flowing toward you now';
  const words = sampleText.split(/\s+/);
  const activeWordIdx = 2; // highlight 3rd word for demo

  // Compute safe zone indicator
  const safeBottomPx = PLATFORM_SAFE_MARGINS[value.platform] ?? 430;
  const safeBottomPct = ((safeBottomPx / 1920) * 100).toFixed(0);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Live Preview ── */}
      <div className="order-1 lg:order-2">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Live Preview</p>
        <div
          className="relative rounded-xl overflow-hidden border border-white/10"
          style={{ aspectRatio: '9/16', maxHeight: 480, background: 'linear-gradient(135deg, #1a0a2e 0%, #0a0a0a 50%, #1a0a2e 100%)' }}
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
            className="absolute left-4 right-4 flex items-center justify-center"
            style={{
              ...(value.position === 'top' ? { top: '8%' } : value.position === 'center' ? { top: '42%' } : { bottom: `${Math.max(5, parseInt(safeBottomPct) + 2)}%` }),
            }}
          >
            <div
              className="text-center px-2 py-1 rounded"
              style={{
                fontFamily: value.fontFamily,
                fontSize: `${Math.round(value.fontSize / 5)}px`,
                color: value.textColor,
                textShadow: value.shadowEnabled
                  ? `${value.shadowDepth}px ${value.shadowDepth}px ${value.shadowDepth * 2}px ${value.shadowColor}`
                  : 'none',
                WebkitTextStroke: value.strokeWidth > 0 ? `${Math.max(0.5, value.strokeWidth / 4)}px ${value.strokeColor}` : undefined,
                backgroundColor: value.highlightEnabled
                  ? `${value.highlightColor}${Math.round(value.highlightOpacity * 2.55).toString(16).padStart(2, '0')}`
                  : 'transparent',
                lineHeight: 1.3,
              }}
            >
              {words.map((w, i) => (
                <span
                  key={i}
                  style={{
                    color: i === activeWordIdx
                      ? value.activeWordColor
                      : i < activeWordIdx
                        ? value.textColor
                        : `${value.textColor}66`,
                    fontWeight: i === activeWordIdx ? 700 : 400,
                    display: 'inline',
                    transition: 'all 0.15s',
                    ...(i === activeWordIdx && (value.animation === 'karaoke' || value.animation === 'pop')
                      ? { transform: 'scale(1.1)', display: 'inline-block' }
                      : {}),
                  }}
                >
                  {w}{' '}
                </span>
              ))}
            </div>
          </div>

          {/* Phone frame overlay */}
          <div className="absolute inset-0 pointer-events-none border-2 border-white/5 rounded-xl" />
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="order-2 lg:order-1 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <Section id="font" icon={<Type className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Font">
          <div className="grid grid-cols-3 gap-1.5">
            {SUBTITLE_FONTS.map(f => (
              <button
                key={f}
                onClick={() => update('fontFamily', f)}
                className={`px-2 py-1.5 rounded-md text-[10px] truncate transition ${
                  value.fontFamily === f
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                }`}
                style={{ fontFamily: f }}
              >
                {f}
              </button>
            ))}
          </div>
          <RangeInput label="Size" value={value.fontSize} min={40} max={120} onChange={v => update('fontSize', v)} />
        </Section>

        <Section id="colors" icon={<Palette className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Colors">
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Text" value={value.textColor} onChange={v => update('textColor', v)} />
            <ColorInput label="Active Word" value={value.activeWordColor} onChange={v => update('activeWordColor', v)} />
            <ColorInput label="Stroke" value={value.strokeColor} onChange={v => update('strokeColor', v)} />
            <ColorInput label="Shadow" value={value.shadowColor} onChange={v => update('shadowColor', v)} />
          </div>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => update('shadowEnabled', !value.shadowEnabled)}
              className={`px-2 py-1 rounded text-[10px] transition ${
                value.shadowEnabled ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40'
              }`}
            >
              Drop Shadow
            </button>
            {value.shadowEnabled && (
              <RangeInput label="Depth" value={value.shadowDepth} min={0} max={6} onChange={v => update('shadowDepth', v)} />
            )}
          </div>
        </Section>

        <Section id="animation" icon={<Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />} title="Animation">
          <div className="grid grid-cols-2 gap-1.5">
            {ANIMATION_PRESETS.map(a => (
              <button
                key={a.value}
                onClick={() => update('animation', a.value)}
                className={`px-2 py-2 rounded-md text-left transition ${
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
                className={`px-2 py-2 rounded-md text-left transition ${
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
  );
}
