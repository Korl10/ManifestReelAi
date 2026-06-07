'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic2, Loader2, Play, Pause, Check, X, Copy, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

interface VoiceData {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  accent: string;
  language: string;
  category: string;
  description: string;
  defaultTier: string;
  multilingual?: boolean;
  previewUrl?: string;
}

type Speed = 'slow' | 'normal' | 'fast';
const SPEEDS: { key: Speed; label: string; value: number }[] = [
  { key: 'slow', label: 'Slow', value: 0.85 },
  { key: 'normal', label: 'Normal', value: 1.0 },
  { key: 'fast', label: 'Fast', value: 1.15 },
];

// Order categories for the audit
const CATEGORY_ORDER = ['Mysterious', 'Historical', 'Biblical', 'Motivational', 'Educated', 'Meditation', 'Male', 'Female'];

export default function VoiceLabPage() {
  const [voices, setVoices] = useState<VoiceData[]>([]);
  const [testPhrases, setTestPhrases] = useState<Record<string, string>>({});
  const [catDescriptions, setCatDescriptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // playback
  const [playingKey, setPlayingKey] = useState<string | null>(null); // `${voiceId}:${speed}`
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({}); // key -> audioUrl

  // decisions: voiceId -> 'keep' | 'swap'  (undefined = undecided)
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'swap'>>({});
  const [copied, setCopied] = useState(false);
  const [activeCat, setActiveCat] = useState<string>('Mysterious');

  useEffect(() => {
    fetch('/api/voices/catalog')
      .then(r => { if (!r.ok) throw new Error('Failed to load catalog'); return r.json(); })
      .then(d => {
        setVoices(d.voices ?? []);
        setTestPhrases(d.testPhrases ?? {});
        setCatDescriptions(d.categoryDescriptions ?? {});
      })
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
    // restore saved decisions
    try {
      const saved = localStorage.getItem('voiceLabDecisions');
      if (saved) setDecisions(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('voiceLabDecisions', JSON.stringify(decisions)); } catch {}
  }, [decisions]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlayingKey(null);
  }, []);

  const playKey = useCallback((url: string, key: string) => {
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingKey(null);
    audio.play().catch(() => {});
    setPlayingKey(key);
  }, [stopAudio]);

  const playSpeed = useCallback(async (voice: VoiceData, speed: Speed) => {
    const key = `${voice.id}:${speed}`;
    if (playingKey === key) { stopAudio(); return; }
    if (cacheRef.current[key]) { playKey(cacheRef.current[key], key); return; }
    const phrase = testPhrases[voice.category] || 'Welcome to a new era of possibility.';
    const speedVal = SPEEDS.find(s => s.key === speed)!.value;
    setLoadingKey(key);
    try {
      const res = await fetch('/api/voices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, text: phrase, tier: voice.defaultTier, speed: speedVal }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        cacheRef.current[key] = data.audioUrl;
        playKey(data.audioUrl, key);
      } else {
        setError(data.error || 'Preview failed');
      }
    } catch {
      setError('Preview request failed');
    } finally {
      setLoadingKey(null);
    }
  }, [playingKey, testPhrases, stopAudio, playKey]);

  const grouped = useMemo(() => {
    const g: Record<string, VoiceData[]> = {};
    for (const v of voices) (g[v.category] = g[v.category] || []).push(v);
    return g;
  }, [voices]);

  const cats = useMemo(() => CATEGORY_ORDER.filter(c => grouped[c]?.length), [grouped]);

  const swapList = useMemo(() => Object.entries(decisions).filter(([, d]) => d === 'swap').map(([id]) => id), [decisions]);
  const decidedCount = Object.keys(decisions).length;

  const decisionsJson = useMemo(() => {
    const byCat: Record<string, { swap: string[]; keep: string[] }> = {};
    for (const v of voices) {
      const d = decisions[v.id];
      if (!d) continue;
      byCat[v.category] = byCat[v.category] || { swap: [], keep: [] };
      const entry = `${v.name} (${v.id} / ${v.accent} / ${v.gender})`;
      if (d === 'swap') byCat[v.category].swap.push(entry);
      else byCat[v.category].keep.push(entry);
    }
    return JSON.stringify({ swapVoiceIds: swapList, byCategory: byCat }, null, 2);
  }, [voices, decisions, swapList]);

  const copyDecisions = useCallback(() => {
    navigator.clipboard.writeText(decisionsJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [decisionsJson]);

  const setDecision = (id: string, d: 'keep' | 'swap') => {
    setDecisions(prev => {
      const next = { ...prev };
      if (next[id] === d) delete next[id]; // toggle off
      else next[id] = d;
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const catVoices = grouped[activeCat] || [];
  const keepCount = catVoices.filter(v => decisions[v.id] === 'keep').length;
  const catSwapCount = catVoices.filter(v => decisions[v.id] === 'swap').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-[#D4AF37]" /> Voice Lab — Sample Sheet
          </h1>
          <p className="text-sm text-white/40 mt-1 max-w-2xl">
            Audition every voice with its category test phrase at three speeds. Mark each one
            <span className="text-emerald-400"> Keep</span> or <span className="text-red-400">Swap</span>, then copy your decisions.
            Audio is generated on demand the first time you press play (then cached).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{decidedCount}/{voices.length} reviewed · {swapList.length} to swap</span>
          <button onClick={copyDecisions} className="px-3 py-2 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/25 transition flex items-center gap-1.5">
            {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Save my decisions</>}
          </button>
          <button onClick={() => { if (confirm('Clear all Keep/Swap decisions?')) setDecisions({}); }} className="px-2.5 py-2 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 transition flex items-center gap-1" title="Reset decisions">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-xs text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {cats.map(c => {
          const total = grouped[c].length;
          const reviewed = grouped[c].filter(v => decisions[v.id]).length;
          return (
            <button key={c} onClick={() => { stopAudio(); setActiveCat(c); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
                activeCat === c ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
              }`}>
              {c}
              <span className={`text-[9px] px-1 rounded ${reviewed === total ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>{reviewed}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* Active category */}
      <div>
        <div className="mb-3">
          <p className="text-sm text-white/70">{catDescriptions[activeCat]}</p>
          <p className="text-xs text-white/40 mt-1 italic">Test phrase: “{testPhrases[activeCat]}”</p>
          <p className="text-[11px] text-white/30 mt-1">{catVoices.length} voices · {keepCount} keep · {catSwapCount} swap</p>
        </div>

        <div className="space-y-1.5">
          {catVoices.map((v, i) => {
            const decision = decisions[v.id];
            return (
              <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition ${
                decision === 'swap' ? 'bg-red-500/[0.06] border-red-500/20'
                : decision === 'keep' ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                : 'bg-white/[0.02] border-white/5'
              }`}>
                <span className="text-[10px] text-white/25 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-white/85">{v.name}</span>
                    <span className="text-[10px] text-white/30">{v.accent}</span>
                    <span className="text-[10px] text-white/25">· {v.gender === 'male' ? '♂ male' : '♀ female'}</span>
                    <span className="text-[10px] text-white/25">· {v.ageRange}</span>
                    {v.multilingual && <span className="text-[8px] px-1 rounded bg-emerald-500/15 text-emerald-400/80">ML</span>}
                  </div>
                  <p className="text-[11px] text-white/35 truncate">{v.description}</p>
                </div>

                {/* 3 speed play buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {SPEEDS.map(s => {
                    const key = `${v.id}:${s.key}`;
                    const isPlaying = playingKey === key;
                    const isLoading = loadingKey === key;
                    return (
                      <button key={s.key} onClick={() => playSpeed(v, s.key)}
                        className={`px-2 py-1.5 rounded-md text-[10px] flex items-center gap-1 transition ${
                          isPlaying ? 'bg-[#D4AF37]/25 text-[#D4AF37]' : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`} title={`${s.label} (${s.value}x)`}>
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Keep / Swap */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button onClick={() => setDecision(v.id, 'keep')}
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                      decision === 'keep' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-white/5 text-white/30 hover:bg-emerald-500/15 hover:text-emerald-400'
                    }`} title="Keep">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDecision(v.id, 'swap')}
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                      decision === 'swap' ? 'bg-red-500/25 text-red-400' : 'bg-white/5 text-white/30 hover:bg-red-500/15 hover:text-red-400'
                    }`} title="Swap out">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
