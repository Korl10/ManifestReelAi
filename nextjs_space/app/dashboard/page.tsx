'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Sparkles, Wand2, Loader2, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts'];
const STYLES = ['Spiritual', 'Motivational', 'Wealth', 'Luxury', 'Meditation', 'Abundance', 'Law of Attraction'];
const VOICES = ['Female', 'Male', 'Meditation', 'Motivational'];
const MOODS = ['Manifestation', 'Meditation', 'Wealth-Frequency', 'Cinematic'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  rendering: 'bg-[#7B2FBE]/20 text-[#A855F7]',
  ready: 'bg-emerald-500/20 text-emerald-400',
  published: 'bg-blue-500/20 text-blue-400',
  scheduled: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [style, setStyle] = useState('Spiritual');
  const [voice, setVoice] = useState('Female');
  const [mood, setMood] = useState('Manifestation');
  const [generating, setGenerating] = useState(false);
  const [reels, setReels] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/reels').then(r => r.json()).then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/payments/subscription').then(r => r.json()).then(d => setQuota(d?.quota ?? null)).catch(() => {});
  }, [session]);

  const handleGenerate = async () => {
    if (!prompt?.trim()) { toast.error('Enter a prompt to start'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/reels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), platform: platform.toLowerCase().replace(' ', '-'), style: style.toLowerCase(), voice: voice.toLowerCase(), mood: mood.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Generation failed');
        return;
      }
      router.push(`/dashboard/generate/${data?.jobId ?? ''}`);
    } catch {
      toast.error('Failed to start generation');
    } finally {
      setGenerating(false);
    }
  };

  const ChipSelect = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="text-xs text-white/40 mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              value === opt ? 'gold-gradient text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Create a <span className="text-[#D4AF37]">Reel</span></h1>
        <p className="text-sm text-white/40 mt-1">Type your intention and let AI do the rest.</p>
      </div>

      {/* Usage */}
      {quota && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <Zap className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm text-white/60">
            <span className="text-white font-semibold">{quota?.reelsUsed ?? 0}</span> / {quota?.reelsCap ?? 0} reels used
            <span className="text-white/30 ml-2">({(quota?.tier ?? 'free').charAt(0).toUpperCase() + (quota?.tier ?? 'free').slice(1)} plan)</span>
          </span>
        </div>
      )}

      {/* Creation form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-6 space-y-5">
        <div>
          <label className="text-xs text-white/40 mb-2 block">Your Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='e.g. "Create a viral manifestation reel about attracting wealth and abundance"'
            rows={3}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm resize-none"
          />
        </div>
        <ChipSelect label="Platform" options={PLATFORMS} value={platform} onChange={setPlatform} />
        <ChipSelect label="Style" options={STYLES} value={style} onChange={setStyle} />
        <ChipSelect label="Voice" options={VOICES} value={voice} onChange={setVoice} />
        <ChipSelect label="Mood" options={MOODS} value={mood} onChange={setMood} />

        <button
          onClick={handleGenerate}
          disabled={generating || !prompt?.trim()}
          className="w-full py-3.5 rounded-xl gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 gold-glow"
        >
          {generating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Generate Reel ✨</>
          )}
        </button>
      </motion.div>

      {/* Recent reels */}
      {(reels?.length ?? 0) > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold mb-4">Recent Reels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reels.slice(0, 6).map((reel: any) => (
              <Link key={reel?.id ?? ''} href={`/dashboard/reel/${reel?.id ?? ''}`}>
                <motion.div whileHover={{ scale: 1.02 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:border-white/10 transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reel?.title ?? reel?.prompt?.slice(0, 40) ?? 'Untitled'}</p>
                      <p className="text-xs text-white/30 mt-0.5">{reel?.style ?? ''} • {reel?.platform ?? ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[reel?.status ?? ''] ?? STATUS_COLORS['draft']}`}>
                      {(reel?.status ?? 'draft').charAt(0).toUpperCase() + (reel?.status ?? '').slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <Clock className="w-3 h-3" />
                    {new Date(reel?.createdAt ?? Date.now()).toLocaleDateString()}
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
          {(reels?.length ?? 0) > 6 && (
            <div className="mt-4 text-center">
              <Link href="/dashboard/library" className="text-sm text-[#D4AF37] hover:underline">View all reels →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
