'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Music2, RefreshCw, Upload, Trash2, Check, Play, Pause, Lock, Loader2, Sparkles,
  Gem, Waves, Flame, Heart, Rocket, Sun, ChevronDown, ChevronUp, Download, Gauge, Star,
} from 'lucide-react';
import Link from 'next/link';
import type { MusicTrack } from '@/lib/music-library';

interface CustomTrack {
  id: string;
  name: string;
  source?: string | null;
  durationSec?: number | null;
  audio?: string | null;
}

interface Capabilities {
  canBrowse: boolean;
  canRegenerate: boolean;
  canFavorite: boolean;
  canBulkLicense: boolean;
  lockedReason: string | null;
}

interface Props {
  mood?: string | null;
  style?: string | null;
  platform?: string | null;
  /** Currently selected track id (library id OR custom-music db id). */
  value: string | null;
  onChange: (trackId: string | null) => void;
  tier?: string | null;
}

// Mood-based icon + accent colour (no per-track cover art).
const MOOD_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  abundant:  { icon: Gem,    color: '#D4AF37', bg: 'rgba(212,175,55,0.14)', label: 'Abundant' },
  calm:      { icon: Waves,  color: '#38BDF8', bg: 'rgba(56,189,248,0.14)', label: 'Calm' },
  empowered: { icon: Flame,  color: '#A855F7', bg: 'rgba(168,85,247,0.16)', label: 'Empowered' },
  grateful:  { icon: Heart,  color: '#FB7185', bg: 'rgba(251,113,133,0.14)', label: 'Grateful' },
  hype:      { icon: Rocket, color: '#FB923C', bg: 'rgba(251,146,60,0.16)', label: 'Hype' },
  inspired:  { icon: Sparkles, color: '#FBBF24', bg: 'rgba(251,191,36,0.14)', label: 'Inspired' },
  joyful:    { icon: Sun,    color: '#FACC15', bg: 'rgba(250,204,21,0.16)', label: 'Joyful' },
};
const FALLBACK_META = { icon: Music2, color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', label: 'Music' };

const ENERGY_META: Record<string, { label: string; color: string }> = {
  'very-high': { label: 'Very High', color: '#FB7185' },
  high:        { label: 'High',      color: '#FB923C' },
  'mid-high':  { label: 'Mid-High',  color: '#FBBF24' },
  mid:         { label: 'Mid',       color: '#38BDF8' },
  low:         { label: 'Low',       color: '#A78BFA' },
};

function metaFor(track: MusicTrack) {
  const m = (track.mood || []).find((x) => MOOD_META[x]);
  return (m && MOOD_META[m]) || FALLBACK_META;
}

function fmtDur(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function prettyMood(m?: string | null) {
  if (!m) return 'your mood';
  return MOOD_META[m]?.label || (m.charAt(0).toUpperCase() + m.slice(1));
}

export default function MusicPicker({ mood, style, platform, value, onChange, tier }: Props) {
  const [suggested, setSuggested] = useState<MusicTrack[]>([]);
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const regenExclude = useRef<Set<string>>(new Set());

  const [customTracks, setCustomTracks] = useState<CustomTrack[]>([]);
  const [slots, setSlots] = useState(0);
  const [used, setUsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Fetch the full library (suggested + browse + favorites + capabilities).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (mood) params.set('mood', mood);
        if (style) params.set('style', style);
        if (platform) params.set('platform', platform);
        const res = await fetch(`/api/music/library?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSuggested(data.suggested ?? []);
        setAllTracks(data.tracks ?? []);
        setCaps(data.capabilities ?? null);
        setFavorites(new Set<string>(data.favorites ?? []));
        regenExclude.current = new Set();
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [mood, style, platform]);

  const loadCustom = useCallback(async () => {
    try {
      const res = await fetch('/api/music');
      if (!res.ok) return;
      const data = await res.json();
      setCustomTracks(data.tracks ?? []);
      setSlots(data.slots ?? 0);
      setUsed(data.used ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { loadCustom(); }, [loadCustom]);

  function playPreview(id: string, src?: string | null) {
    if (!src) return;
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setPlayingId(id);
    }
  }

  // Pro+: regenerate — ask the matcher for a fresh track, excluding everything
  // shown so far so each click yields a genuinely different pick.
  async function regenerate() {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const exclude = regenExclude.current;
      // Seed the exclude set with the current suggestions on first click.
      if (exclude.size === 0) suggested.forEach((t) => exclude.add(t.id));
      if (value) exclude.add(value);
      const params = new URLSearchParams();
      if (mood) params.set('mood', mood);
      if (style) params.set('style', style);
      if (platform) params.set('platform', platform);
      params.set('exclude', Array.from(exclude).join(','));
      let res = await fetch(`/api/music/match?${params.toString()}`);
      let data = res.ok ? await res.json() : null;
      // Exhausted the mood? reset and pull a fresh primary.
      if (!data?.track) {
        exclude.clear();
        const p2 = new URLSearchParams();
        if (mood) p2.set('mood', mood);
        if (style) p2.set('style', style);
        if (platform) p2.set('platform', platform);
        res = await fetch(`/api/music/match?${p2.toString()}`);
        data = res.ok ? await res.json() : null;
      }
      if (data?.track) {
        exclude.add(data.track.id);
        // Surface the regenerated track at the top of the suggested list.
        setSuggested((prev) => {
          const without = prev.filter((t) => t.id !== data.track.id);
          return [data.track, ...without].slice(0, 5);
        });
        onChange(data.track.id);
      }
    } catch {
      /* ignore */
    } finally {
      setRegenerating(false);
    }
  }

  async function toggleFavorite(trackId: string) {
    const isFav = favorites.has(trackId);
    // optimistic
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(trackId) : next.add(trackId);
      return next;
    });
    try {
      if (isFav) {
        await fetch(`/api/music/favorites?trackId=${encodeURIComponent(trackId)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/music/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId }),
        });
      }
    } catch {
      // revert on failure
      setFavorites((prev) => {
        const next = new Set(prev);
        isFav ? next.add(trackId) : next.delete(trackId);
        return next;
      });
    }
  }

  // Agency: download a license/attribution sheet for the whole library.
  function downloadLicenseSheet() {
    const rows = [['Title', 'Mood', 'Energy', 'BPM', 'Duration (s)', 'License']];
    allTracks.forEach((t) => {
      rows.push([
        t.title,
        (t.mood || []).join('|'),
        t.energy,
        t.bpm != null ? String(t.bpm) : '',
        String(Math.round(t.duration)),
        t.license_status,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifestreel-music-licenses.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Audio files must be under 25MB.');
      return;
    }
    setUploading(true);
    try {
      const presign = await fetch('/api/music/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      const pdata = await presign.json();
      if (!presign.ok) throw new Error(pdata.error || 'Upload failed');
      const put = await fetch(pdata.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('Upload to storage failed');
      const save = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name.replace(/\.[^.]+$/, ''),
          cloud_storage_path: pdata.cloud_storage_path,
          source: 'upload',
        }),
      });
      const sdata = await save.json();
      if (!save.ok) throw new Error(sdata.error || 'Save failed');
      await loadCustom();
      onChange(sdata.id);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/music/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (value === id) onChange(null);
        await loadCustom();
      }
    } catch {
      /* ignore */
    }
  }

  const autoSelected = value === null;
  const canBrowse = caps?.canBrowse ?? false;
  const moodLabel = prettyMood(mood);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

      <div className="flex items-center gap-2">
        <Music2 className="w-4 h-4 text-[#D4AF37]" />
        <span className="text-sm font-semibold text-white">Background Music</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-emerald-400/90 bg-emerald-400/10 px-2 py-0.5 rounded-full">
          Included — $0
        </span>
      </div>

      {/* Auto / smart match */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`w-full text-left rounded-xl border p-3 transition-all ${
          autoSelected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span className="text-sm font-medium text-white">Smart match (recommended)</span>
          {autoSelected && <Check className="w-4 h-4 text-[#D4AF37] ml-auto" />}
        </div>
        <p className="text-xs text-white/50 mt-1">
          We pick the best instrumental for your mood, style &amp; platform automatically.
        </p>
      </button>

      {/* AI Suggested for [Mood] */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/50 px-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding the perfect track...
        </div>
      ) : suggested.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-semibold text-[#D4AF37] flex items-center gap-1.5">
              🎯 AI Suggested for {moodLabel}
            </span>
            {caps?.canRegenerate && (
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="ml-auto flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#E8C766] transition-colors disabled:opacity-50"
              >
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate match
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {suggested.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                selected={autoSelected ? i === 0 : value === t.id}
                playing={playingId === t.id}
                onPlay={() => playPreview(t.id, t.file)}
                onSelect={() => onChange(t.id)}
                badge={autoSelected && i === 0 ? 'Matched' : (i === 0 ? 'Top pick' : undefined)}
                canFavorite={caps?.canFavorite ?? false}
                isFavorite={favorites.has(t.id)}
                onToggleFavorite={() => toggleFavorite(t.id)}
              />
            ))}
          </div>

          {/* Browse the full library (Starter+) */}
          {canBrowse ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setBrowseOpen((s) => !s)}
                className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors px-1"
              >
                {browseOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {browseOpen ? 'Hide full library' : `Browse full library (${allTracks.length} tracks)`}
              </button>
              {browseOpen && (
                <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {caps?.canBulkLicense && (
                    <button
                      type="button"
                      onClick={downloadLicenseSheet}
                      className="flex items-center gap-1.5 text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors w-full justify-center mb-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Download license sheet (CSV)
                    </button>
                  )}
                  {allTracks.map((t) => (
                    <TrackRow
                      key={t.id}
                      track={t}
                      selected={value === t.id}
                      playing={playingId === t.id}
                      onPlay={() => playPreview(t.id, t.file)}
                      onSelect={() => onChange(t.id)}
                      canFavorite={caps?.canFavorite ?? false}
                      isFavorite={favorites.has(t.id)}
                      onToggleFavorite={() => toggleFavorite(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70 transition-colors px-1 pt-1"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {caps?.lockedReason || 'Upgrade to browse the full music library.'}
            </Link>
          )}
        </div>
      ) : null}

      {/* Custom uploads */}
      <div className="pt-2 border-t border-white/10">
        {slots > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/80">Your music ({used}/{slots})</span>
              <button
                type="button"
                disabled={uploading || used >= slots}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-white px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
            </div>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <div className="space-y-1.5">
              {customTracks.length === 0 && (
                <p className="text-xs text-white/40">Upload your own instrumental to use it across your reels.</p>
              )}
              {customTracks.map((t) => {
                const selected = value === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 rounded-xl border p-2 transition-all ${
                      selected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playPreview(t.id, t.audio)}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
                    >
                      {playingId === t.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <button type="button" onClick={() => onChange(t.id)} className="flex-1 text-left min-w-0">
                      <p className="text-sm text-white truncate">{t.name}</p>
                      <p className="text-[10px] text-white/40">Custom upload</p>
                    </button>
                    {selected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Upload your own music on Pro &amp; Premium plans
          </Link>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  selected,
  playing,
  onPlay,
  onSelect,
  badge,
  canFavorite,
  isFavorite,
  onToggleFavorite,
}: {
  track: MusicTrack;
  selected: boolean;
  playing: boolean;
  onPlay: () => void;
  onSelect: () => void;
  badge?: string;
  canFavorite?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const meta = metaFor(track);
  const Icon = meta.icon;
  const dur = fmtDur(track.duration);
  const energy = ENERGY_META[track.energy] || ENERGY_META.mid;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-all ${
        selected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon className="w-4 h-4" style={{ color: meta.color }} />
      </div>
      <button type="button" onClick={onSelect} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white truncate">{track.title}</p>
          {badge && (
            <span className="text-[9px] uppercase tracking-wide text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded-full shrink-0">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ color: meta.color, backgroundColor: meta.bg }}
          >
            {meta.label}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ color: energy.color, backgroundColor: `${energy.color}22` }}
          >
            {energy.label}
          </span>
          {track.bpm != null && (
            <span className="text-[9px] text-white/55 flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> {track.bpm} BPM
            </span>
          )}
          {dur && <span className="text-[9px] text-white/45">{dur}</span>}
        </div>
      </button>
      {canFavorite && onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 hover:bg-white/10"
          aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
          title={isFavorite ? 'Remove favorite' : 'Save to favorites'}
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/40'}`} />
        </button>
      )}
      <button
        type="button"
        onClick={onPlay}
        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
        aria-label={playing ? 'Pause preview' : 'Play preview'}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      {selected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
    </div>
  );
}
