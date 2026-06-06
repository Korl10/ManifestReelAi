'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Music2, RefreshCw, Upload, Trash2, Check, Play, Pause, Lock, Loader2, Sparkles,
  Gem, Waves, Flame, Heart, Rocket, Sun,
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

export default function MusicPicker({ mood, style, platform, value, onChange, tier }: Props) {
  const [primary, setPrimary] = useState<MusicTrack | null>(null);
  const [alternates, setAlternates] = useState<MusicTrack[]>([]);
  const [showAlternates, setShowAlternates] = useState(false);
  const [loading, setLoading] = useState(false);

  const [customTracks, setCustomTracks] = useState<CustomTrack[]>([]);
  const [slots, setSlots] = useState(0);
  const [used, setUsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Fetch the smart-matched track whenever the reel context changes.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (mood) params.set('mood', mood);
        if (style) params.set('style', style);
        if (platform) params.set('platform', platform);
        const res = await fetch(`/api/music/match?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPrimary(data.track ?? null);
        setAlternates(data.alternates ?? []);
        setShowAlternates(false);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    loadCustom();
  }, [loadCustom]);

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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      {/* hidden shared audio element */}
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

      {/* Matched track preview */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/50 px-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding the perfect track…
        </div>
      ) : primary ? (
        <div className="space-y-2">
          <TrackRow
            track={primary}
            selected={value === primary.id}
            playing={playingId === primary.id}
            onPlay={() => playPreview(primary.id, primary.file)}
            onSelect={() => onChange(primary.id)}
            badge={autoSelected ? 'Matched' : undefined}
          />

          <button
            type="button"
            onClick={() => setShowAlternates((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:text-[#E8C766] transition-colors px-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {showAlternates ? 'Hide alternates' : 'Change track'}
          </button>

          {showAlternates && (
            <div className="space-y-1.5 pl-1">
              {alternates.length === 0 && <p className="text-xs text-white/40">No other matches in this mood.</p>}
              {alternates.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  selected={value === t.id}
                  playing={playingId === t.id}
                  onPlay={() => playPreview(t.id, t.file)}
                  onSelect={() => onChange(t.id)}
                />
              ))}
            </div>
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
                {uploading ? 'Uploading…' : 'Upload'}
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
}: {
  track: MusicTrack;
  selected: boolean;
  playing: boolean;
  onPlay: () => void;
  onSelect: () => void;
  badge?: string;
}) {
  const meta = metaFor(track);
  const Icon = meta.icon;
  const dur = fmtDur(track.duration);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-all ${
        selected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      {/* mood-accent icon tile */}
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
        <p className="text-[10px] text-white/45 mt-0.5">
          {dur && <>{dur} · </>}
          <span style={{ color: meta.color }}>{meta.label}</span>
        </p>
      </button>
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
