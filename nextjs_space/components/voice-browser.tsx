'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Play, Pause, Loader2, Filter, ChevronDown, ChevronRight,
  Settings2, Sliders, Mic, Globe, User, Tag,
} from 'lucide-react';
import type { VoiceTier } from '@/lib/voice-catalog';

interface VoiceData {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  accent: string;
  language: string;
  category: string;
  useCases: string[];
  description: string;
  defaultTier: VoiceTier;
  supportedTiers: VoiceTier[];
  multilingual?: boolean;
  previewUrl?: string;
  samplePath: string;
}

interface VoiceBrowserProps {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  /** First line of the user's script for live preview. */
  previewText?: string;
  /** Current voice tier selection. */
  voiceTier: VoiceTier;
  onTierChange: (tier: VoiceTier) => void;
  /** Stability slider (0-1). */
  stability: number;
  onStabilityChange: (v: number) => void;
  /** Similarity slider (0-1). */
  similarity: number;
  onSimilarityChange: (v: number) => void;
  /** Show advanced toggle open by default? */
  advancedOpen?: boolean;
}

const TIER_INFO: Record<VoiceTier, { label: string; desc: string; color: string }> = {
  flash: { label: 'Flash v2.5', desc: 'Fast & efficient', color: 'text-blue-400' },
  multilingual: { label: 'Multilingual v2', desc: 'Highest quality', color: 'text-emerald-400' },
  turbo: { label: 'Turbo v2.5', desc: 'Low latency', color: 'text-amber-400' },
};

export default function VoiceBrowser({
  selectedVoiceId, onSelect, previewText,
  voiceTier, onTierChange, stability, onStabilityChange,
  similarity, onSimilarityChange, advancedOpen,
}: VoiceBrowserProps) {
  const [voices, setVoices] = useState<VoiceData[]>([]);
  const [filters, setFilters] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [accentFilter, setAccentFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [useCaseFilter, setUseCaseFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(advancedOpen ?? false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch catalog
  useEffect(() => {
    const params = new URLSearchParams();
    if (genderFilter) params.set('gender', genderFilter);
    if (accentFilter) params.set('accent', accentFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (useCaseFilter) params.set('useCase', useCaseFilter);
    if (search) params.set('search', search);

    fetch(`/api/voices/catalog?${params}`)
      .then(r => r.json())
      .then(d => {
        setVoices(d.voices ?? []);
        if (!filters) setFilters(d.filters);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, genderFilter, accentFilter, categoryFilter, useCaseFilter]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingId(null);
  }, []);

  const playSample = useCallback((voice: VoiceData) => {
    if (playingId === voice.id) {
      stopAudio();
      return;
    }
    stopAudio();
    const src = voice.previewUrl || voice.samplePath;
    if (!src) return;
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => {});
    setPlayingId(voice.id);
  }, [playingId, stopAudio]);

  const generatePreview = useCallback(async (voice: VoiceData) => {
    if (!previewText?.trim()) {
      playSample(voice);
      return;
    }
    // Check if we already have a cached preview
    if (previewUrls[voice.id]) {
      stopAudio();
      const audio = new Audio(previewUrls[voice.id]);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => {});
      setPlayingId(voice.id);
      return;
    }

    setPreviewLoading(voice.id);
    try {
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          text: previewText.slice(0, 120),
          tier: voiceTier,
          ...(showAdvanced ? { stability, similarity } : {}),
        }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setPreviewUrls(prev => ({ ...prev, [voice.id]: data.audioUrl }));
        stopAudio();
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setPlayingId(null);
        audio.play().catch(() => {});
        setPlayingId(voice.id);
      }
    } catch {
      playSample(voice);
    } finally {
      setPreviewLoading(null);
    }
  }, [previewText, previewUrls, voiceTier, stability, similarity, showAdvanced, playSample, stopAudio]);

  // Group voices by category
  const grouped = voices.reduce<Record<string, VoiceData[]>>((acc, v) => {
    (acc[v.category] = acc[v.category] || []).push(v);
    return acc;
  }, {});

  const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-[10px] transition whitespace-nowrap ${
        active ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-white/5 text-white/40 hover:bg-white/10 border border-transparent'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voices..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/40"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg text-xs transition flex items-center gap-1.5 ${
            showFilters ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:bg-white/10'
          }`}
        >
          <Filter className="w-3 h-3" />
          Filters
        </button>
      </div>

      {/* Filter chips */}
      {showFilters && filters && (
        <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase w-12"><User className="w-3 h-3 inline" /> Gender</span>
            <FilterChip label="All" active={!genderFilter} onClick={() => setGenderFilter('')} />
            {(filters.genders ?? []).map((g: string) => (
              <FilterChip key={g} label={g} active={genderFilter === g} onClick={() => setGenderFilter(genderFilter === g ? '' : g)} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase w-12"><Globe className="w-3 h-3 inline" /> Accent</span>
            <FilterChip label="All" active={!accentFilter} onClick={() => setAccentFilter('')} />
            {(filters.accents ?? []).map((a: string) => (
              <FilterChip key={a} label={a} active={accentFilter === a} onClick={() => setAccentFilter(accentFilter === a ? '' : a)} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-white/30 uppercase w-12"><Tag className="w-3 h-3 inline" /> Use</span>
            <FilterChip label="All" active={!useCaseFilter} onClick={() => setUseCaseFilter('')} />
            {(filters.useCases ?? []).slice(0, 10).map((u: string) => (
              <FilterChip key={u} label={u} active={useCaseFilter === u} onClick={() => setUseCaseFilter(useCaseFilter === u ? '' : u)} />
            ))}
          </div>
        </div>
      )}

      {/* Voice Tier selector */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Voice Quality Tier</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(TIER_INFO) as [VoiceTier, typeof TIER_INFO['flash']][]).map(([tier, info]) => (
            <button
              key={tier}
              onClick={() => onTierChange(tier)}
              className={`px-2 py-2 rounded-md text-left transition ${
                voiceTier === tier
                  ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/30'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              <p className={`text-[11px] font-medium ${voiceTier === tier ? 'text-[#D4AF37]' : info.color}`}>{info.label}</p>
              <p className="text-[9px] text-white/35 mt-0.5">{info.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition"
      >
        <Settings2 className="w-3 h-3" />
        Advanced Settings
        {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {showAdvanced && (
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50">Stability</span>
              <span className="text-[11px] text-white/70 font-mono">{stability.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={stability}
              onChange={e => onStabilityChange(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-white/25">
              <span>Variable / Expressive</span>
              <span>Stable / Consistent</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/50">Similarity</span>
              <span className="text-[11px] text-white/70 font-mono">{similarity.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={similarity}
              onChange={e => onSimilarityChange(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-white/25">
              <span>More variation</span>
              <span>More similar</span>
            </div>
          </div>
        </div>
      )}

      {/* Voice list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
          {Object.entries(grouped).map(([category, catVoices]) => (
            <div key={category}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 sticky top-0 bg-[#0a0a0a] py-1 z-10">{category}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {catVoices.map(v => (
                  <button
                    key={v.id}
                    onClick={() => onSelect(v.id)}
                    className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ${
                      selectedVoiceId === v.id
                        ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/30'
                        : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium truncate ${
                          selectedVoiceId === v.id ? 'text-[#D4AF37]' : 'text-white/80'
                        }`}>{v.name}</span>
                        <span className="text-[9px] text-white/25">{v.accent}</span>
                        <span className="text-[9px] text-white/20">· {v.gender === 'male' ? '♂' : '♀'}</span>
                        {v.multilingual && (
                          <span title="Multilingual" className="text-[8px] px-1 rounded bg-emerald-500/15 text-emerald-400/80 leading-tight">ML</span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/35 truncate">{v.description}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); generatePreview(v); }}
                      className="shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition"
                    >
                      {previewLoading === v.id ? (
                        <Loader2 className="w-3 h-3 text-[#D4AF37] animate-spin" />
                      ) : playingId === v.id ? (
                        <Pause className="w-3 h-3 text-[#D4AF37]" />
                      ) : (
                        <Play className="w-3 h-3 text-white/50" />
                      )}
                    </button>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {voices.length === 0 && (
            <p className="text-center text-white/25 text-xs py-8">No voices match your filters</p>
          )}
        </div>
      )}
    </div>
  );
}
