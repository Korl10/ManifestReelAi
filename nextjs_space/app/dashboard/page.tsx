'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Sparkles, Loader2, Clock, Zap, Film, AlertCircle, Check, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { HydrationDate } from '@/components/hydration-date';
import { PaywallModal } from '@/components/paywall-modal';

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts'];

const STYLES = [
  { name: 'Spiritual', img: '/styles/spiritual.jpg', desc: 'Sacred & ethereal' },
  { name: 'Motivational', img: '/styles/motivational.jpg', desc: 'Bold & inspiring' },
  { name: 'Wealth', img: '/styles/wealth.jpg', desc: 'Money magnetism' },
  { name: 'Luxury', img: '/styles/luxury.jpg', desc: 'Opulent vibes' },
  { name: 'Meditation', img: '/styles/meditation.jpg', desc: 'Calm & zen' },
  { name: 'Abundance', img: '/styles/abundance.jpg', desc: 'Overflowing growth' },
  { name: 'Law of Attraction', img: '/styles/law-of-attraction.jpg', desc: 'Cosmic energy' },
];

const VOICES = [
  { name: 'Female', img: '/voices/female.jpg', desc: 'Warm & soothing' },
  { name: 'Male', img: '/voices/male.jpg', desc: 'Deep & confident' },
  { name: 'Meditation', img: '/voices/meditation.jpg', desc: 'Soft whisper' },
  { name: 'Motivational', img: '/voices/motivational.jpg', desc: 'High energy' },
];

const MOODS = ['Manifestation', 'Meditation', 'Wealth-Frequency', 'Cinematic', 'Dreamy', 'Uplifting', 'Powerful', 'Serene'];

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
  const [loadingReels, setLoadingReels] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);

  // Show upgrade toast if redirected from checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const upgraded = urlParams.get('upgraded');
    if (upgraded) {
      toast.success(`Successfully upgraded to ${upgraded.charAt(0).toUpperCase() + upgraded.slice(1)}! 🎉`);
      router.replace('/dashboard', { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    setError('');
    Promise.all([
      fetch('/api/reels').then(r => { if (!r.ok) throw new Error('Failed to load reels'); return r.json(); }),
      fetch('/api/payments/subscription').then(r => { if (!r.ok) throw new Error('Failed to load subscription'); return r.json(); }),
    ])
      .then(([reelsData, subData]) => {
        setReels(Array.isArray(reelsData) ? reelsData : []);
        setQuota(subData?.quota ?? null);
      })
      .catch((err) => { setError(err?.message ?? 'Failed to load data'); })
      .finally(() => setLoadingReels(false));
  }, [session]);

  const handleGenerate = async () => {
    if (!prompt?.trim()) { toast.error('Enter a prompt to start'); return; }
    // Check quota — show paywall if out
    if (quota && !quota.allowed) {
      setShowPaywall(true);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/reels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), platform: platform.toLowerCase().replace(/\s+/g, '-'), style: style.toLowerCase(), voice: voice.toLowerCase(), mood: mood.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Generation failed');
        return;
      }
      router.push(`/dashboard/generate/${data?.jobId ?? ''}`);
    } catch {
      toast.error('Failed to start generation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const remaining = quota ? Math.max(0, (quota?.reelsCap ?? 0) - (quota?.reelsUsed ?? 0)) : null;

  return (
    <div className="space-y-8 pb-24 lg:pb-8">
      {/* Header with credits pill */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Create a <span className="text-[#D4AF37]">Reel</span></h1>
          <p className="text-sm text-white/40 mt-1">Design your manifestation. Pick a vibe, set the voice, hit create.</p>
        </div>
        {quota && (
          <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#D4AF37]/15 to-[#7B2FBE]/15 border border-[#D4AF37]/30">
            <Zap className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-sm font-bold text-[#D4AF37]">{remaining ?? 0}</span>
            <span className="text-xs text-white/50 hidden sm:inline">credits left</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => window.location.reload()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {/* Prompt */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-[#D4AF37]" />
          <label className="text-sm font-semibold text-white">Your Intention</label>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder='e.g. "A viral manifestation reel about attracting wealth, success and abundance into my life"'
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm resize-none"
        />
      </motion.div>

      {/* Pick Style — image cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Pick a Style</h2>
          <span className="text-xs text-[#D4AF37]">{style}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 snap-x">
          {STYLES.map((item) => {
            const selected = style === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setStyle(item.name)}
                className={`group relative shrink-0 w-32 sm:w-36 snap-start rounded-2xl overflow-hidden border-2 transition-all ${
                  selected ? 'border-[#D4AF37] gold-glow' : 'border-white/8 hover:border-white/20'
                }`}
              >
                <div className="relative aspect-[3/4] bg-white/5">
                  <Image src={item.img} alt={`${item.name} manifestation reel style`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="144px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  {selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full gold-gradient flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                    <p className={`text-sm font-bold leading-tight ${selected ? 'text-[#D4AF37]' : 'text-white'}`}>{item.name}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pick Voice — image cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Pick a Voice</h2>
          <span className="text-xs text-[#D4AF37]">{voice}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 snap-x">
          {VOICES.map((item) => {
            const selected = voice === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setVoice(item.name)}
                className={`group relative shrink-0 w-32 sm:w-36 snap-start rounded-2xl overflow-hidden border-2 transition-all ${
                  selected ? 'border-[#D4AF37] gold-glow' : 'border-white/8 hover:border-white/20'
                }`}
              >
                <div className="relative aspect-square bg-white/5">
                  <Image src={item.img} alt={`${item.name} narration voice`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="144px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  {selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full gold-gradient flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                    <p className={`text-sm font-bold leading-tight ${selected ? 'text-[#D4AF37]' : 'text-white'}`}>{item.name}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pick Mood — chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Pick a Mood</h2>
          <span className="text-xs text-[#D4AF37]">{mood}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((opt) => {
            const selected = mood === opt;
            return (
              <button
                key={opt}
                onClick={() => setMood(opt)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  selected ? 'purple-gradient text-white purple-glow' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/8'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </section>

      {/* Platform — chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Platform</h2>
          <span className="text-xs text-[#D4AF37]">{platform}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((opt) => {
            const selected = platform === opt;
            return (
              <button
                key={opt}
                onClick={() => setPlatform(opt)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  selected ? 'gold-gradient text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/8'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </section>

      {/* Usage bar */}
      {quota && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <Zap className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm text-white/60">
            <span className="text-white font-semibold">{quota?.reelsUsed ?? 0}</span> / {quota?.reelsCap ?? 0} reels used
            <span className="text-white/30 ml-2">({(quota?.tier ?? 'free').charAt(0).toUpperCase() + (quota?.tier ?? 'free').slice(1)} plan)</span>
          </span>
          {!quota?.allowed && (
            <Link href="/dashboard/settings" className="ml-auto text-xs text-[#D4AF37] hover:underline">Upgrade →</Link>
          )}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt?.trim()}
        className="w-full py-4 rounded-2xl gold-gradient text-black font-bold text-base hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 gold-glow"
      >
        {generating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="w-5 h-5" /> Generate Reel ✨</>
        )}
      </button>

      {/* Recent reels */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Recent Reels</h2>
        {loadingReels ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          </div>
        ) : (reels?.length ?? 0) === 0 ? (
          <div className="text-center py-12 rounded-xl bg-white/[0.01] border border-white/5">
            <Film className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No reels yet. Create your first one above! ✨</p>
          </div>
        ) : (
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
                    <HydrationDate date={reel?.createdAt} fallback="—" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
        {(reels?.length ?? 0) > 6 && (
          <div className="mt-4 text-center">
            <Link href="/dashboard/library" className="text-sm text-[#D4AF37] hover:underline">View all reels →</Link>
          </div>
        )}
      </div>
      {/* Paywall Modal */}
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        tier={quota?.tier ?? 'free'}
        reelsUsed={quota?.reelsUsed ?? 0}
        reelsCap={quota?.reelsCap ?? 0}
      />
    </div>
  );
}
