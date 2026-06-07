'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Sparkles, Loader2, Clock, Zap, Film, AlertCircle, Check, Wand2, Play, Pause, Mic, Plus, Trash2, Gauge, ToggleRight, ToggleLeft, Crown, Lock, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { HydrationDate } from '@/components/hydration-date';
import { PaywallModal } from '@/components/paywall-modal';
import { AddVoiceModal } from '@/components/add-voice-modal';
import dynamic from 'next/dynamic';
import { DEFAULT_SUBTITLE_STYLE } from '@/lib/captions/subtitle-types';
import type { SubtitleStyle } from '@/lib/captions/subtitle-types';
import { VOICE_CATALOG, VOICE_CATEGORIES as CATALOG_CATEGORIES, CATEGORY_DESCRIPTIONS } from '@/lib/voice-catalog';
import type { VoiceTier } from '@/lib/voice-catalog';

import { modelTierAccess, getModelTier, type ModelTierId } from '@/lib/model-tiers';
import { FREE_FONTS, FREE_COLORS } from '@/lib/free-tier';

const SubtitleEditor = dynamic(() => import('@/components/subtitle-editor'), { ssr: false });
const VoiceBrowser = dynamic(() => import('@/components/voice-browser'), { ssr: false });
const ModelTierPicker = dynamic(() => import('@/components/model-tier-picker'), { ssr: false });
const MusicPicker = dynamic(() => import('@/components/music-picker'), { ssr: false });

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

// Build VOICE_LIBRARY dynamically from the canonical voice catalog (160 unique professional voices).
const CATEGORY_IMGS: Record<string, string> = {
  Female: '/voices/female.jpg', Male: '/voices/male.jpg', Mysterious: '/voices/mysterious.jpg',
  Historical: '/voices/historical.jpg', Biblical: '/voices/biblical.jpg', Motivational: '/voices/motivational.jpg',
  Educated: '/voices/educated.jpg', Meditation: '/voices/meditation.jpg',
};
const VOICE_LIBRARY = CATALOG_CATEGORIES.map((cat) => ({
  category: cat,
  img: CATEGORY_IMGS[cat] || '/voices/female.jpg',
  variations: VOICE_CATALOG.filter((v) => v.category === cat).map((v) => ({
    id: v.id,
    name: v.name,
    desc: v.description,
    audio: v.previewUrl || '',
  })),
}));

const ALL_PRESET_VOICES = VOICE_LIBRARY.flatMap((c) => c.variations.map((v) => ({ ...v, category: c.category })));
const VOICE_CATEGORIES = VOICE_LIBRARY.map((c) => c.category);

const MOODS = [
  { name: 'Manifestation', img: '/moods/manifestation.jpg' },
  { name: 'Meditation', img: '/moods/meditation.jpg' },
  { name: 'Wealth-Frequency', img: '/moods/wealth-frequency.jpg' },
  { name: 'Cinematic', img: '/moods/cinematic.jpg' },
  { name: 'Dreamy', img: '/moods/dreamy.jpg' },
  { name: 'Uplifting', img: '/moods/uplifting.jpg' },
  { name: 'Powerful', img: '/moods/powerful.jpg' },
  { name: 'Serene', img: '/moods/serene.jpg' },
];

const EXAMPLE_REELS = [
  { src: '/examples/abundance.mp4', poster: '/examples/abundance-poster.jpg', title: 'Abundance Flow', tag: 'Spiritual • Female voice' },
  { src: '/examples/wealth.mp4', poster: '/examples/wealth-poster.jpg', title: 'Wealth Magnet', tag: 'Wealth • Male voice' },
  { src: '/examples/peace.mp4', poster: '/examples/peace-poster.jpg', title: 'Inner Peace', tag: 'Meditation • Soft voice' },
  { src: '/examples/power.mp4', poster: '/examples/power-poster.jpg', title: 'Unstoppable', tag: 'Motivational • Bold voice' },
];

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
  const [voice, setVoice] = useState('female-f-01');
  const [voiceCategory, setVoiceCategory] = useState('Female');
  const [speed, setSpeed] = useState('normal');
  const [targetLength, setTargetLength] = useState(15);
  const [customVoices, setCustomVoices] = useState<any[]>([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [mood, setMood] = useState('Manifestation');
  const [generating, setGenerating] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [reels, setReels] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loadingReels, setLoadingReels] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [freeReelUsed, setFreeReelUsed] = useState(false);
  const [resending, setResending] = useState(false);
  const [limitModal, setLimitModal] = useState<{ title: string; message: string } | null>(null);
  const [enableMotion, setEnableMotion] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [playingReel, setPlayingReel] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Phase 2: Voice advanced settings
  const [voiceTier, setVoiceTier] = useState<VoiceTier>('multilingual');
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [showVoiceBrowser, setShowVoiceBrowser] = useState(false);

  // Phase 2: Subtitle settings
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({ ...DEFAULT_SUBTITLE_STYLE });
  const [showSubtitleEditor, setShowSubtitleEditor] = useState(false);
  const [modelTier, setModelTier] = useState<ModelTierId>('standard');
  const [musicTrackId, setMusicTrackId] = useState<string | null>(null);
  const [enableStinger, setEnableStinger] = useState(false);

  // Phase 4: applied brand preset (Craft)
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  const [appliedPresetName, setAppliedPresetName] = useState<string | null>(null);

  // Phase 4: prefill the entire form from a brand preset via ?preset=ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pid = new URLSearchParams(window.location.search).get('preset');
    if (!pid) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/presets/${pid}`);
        if (!r.ok) return;
        const { preset } = await r.json();
        if (cancelled || !preset) return;
        applyPreset(preset);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset: any) => {
    const platformMap: Record<string, string> = {
      reels: 'Instagram Reels',
      tiktok: 'TikTok',
      shorts: 'YouTube Shorts',
      youtube: 'YouTube Shorts',
    };
    if (preset.defaultPlatform && platformMap[preset.defaultPlatform]) setPlatform(platformMap[preset.defaultPlatform]);
    if (preset.voiceId) { setVoice(preset.voiceId); setSpeed('normal'); }
    if (preset.voiceTier) setVoiceTier(preset.voiceTier as VoiceTier);
    if (typeof preset.voiceStability === 'number') setStability(preset.voiceStability);
    if (typeof preset.voiceSimilarity === 'number') setSimilarity(preset.voiceSimilarity);
    if (preset.subtitleStyle) setSubtitleStyle({ ...DEFAULT_SUBTITLE_STYLE, ...preset.subtitleStyle });
    if (preset.modelTier) setModelTier(preset.modelTier as ModelTierId);
    if (typeof preset.defaultLength === 'number') setTargetLength(preset.defaultLength);
    setEnableMotion(!!preset.motionDefault);
    setEnableStinger(!!preset.stingerEnabled);
    if (preset.lockedTrackId) setMusicTrackId(preset.lockedTrackId);
    setAppliedPresetId(preset.id);
    setAppliedPresetName(preset.name ?? 'Brand preset');
    toast.success(`Loaded preset “${preset.name ?? 'Brand preset'}”`);
  };

  const clearPreset = () => {
    setAppliedPresetId(null);
    setAppliedPresetName(null);
    // Strip ?preset= from the URL without a navigation
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('preset');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const toggleVoicePreview = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Stop any currently playing audio
    Object.entries(audioRefs.current).forEach(([key, el]) => {
      if (el) { el.pause(); el.currentTime = 0; }
    });
    if (playingVoice === id) {
      setPlayingVoice(null);
      return;
    }
    // Find audio src
    const preset = ALL_PRESET_VOICES.find((v) => v.id === id);
    const custom = customVoices.find((v: any) => v.id === id);
    const src = preset?.audio || custom?.audio;
    if (!src) return;
    // Create/reuse audio element lazily
    if (!audioRefs.current[id]) {
      const el = new Audio(src);
      el.onended = () => setPlayingVoice((p) => (p === id ? null : p));
      audioRefs.current[id] = el;
    }
    const audio = audioRefs.current[id]!;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setPlayingVoice(id);
  };

  const deleteCustomVoice = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const current = audioRefs.current[id];
    if (current) { current.pause(); }
    try {
      const res = await fetch(`/api/voices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      if (voice === id) setVoice('female-f-01');
      if (playingVoice === id) setPlayingVoice(null);
      toast.success('Voice removed');
    } catch { toast.error('Failed to remove voice'); }
  };

  const selectedVoiceName = (() => {
    const preset = ALL_PRESET_VOICES.find((v) => v.id === voice);
    if (preset) return preset.name;
    const custom = customVoices.find((v) => v.id === voice);
    if (custom) return `${custom.name} (yours)`;
    return voice;
  })();

  const toggleReel = (title: string) => {
    const current = videoRefs.current[title];
    if (!current) return;
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (key !== title && el) { el.pause(); }
    });
    if (playingReel === title) {
      current.pause();
      setPlayingReel(null);
    } else {
      current.play().catch(() => {});
      setPlayingReel(title);
    }
  };

  // After returning from Stripe Checkout, verify the session server-side as a
  // fallback (in case the webhook is delayed/misconfigured), then refresh quota.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const upgraded = urlParams.get('upgraded');
    const coins = urlParams.get('coins');
    const sessionId = urlParams.get('session_id');
    if (!upgraded && !coins) return;

    let cancelled = false;
    (async () => {
      try {
        if (sessionId) {
          await fetch('/api/payments/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        }
        // Refresh subscription/quota so the UI reflects the new plan immediately.
        const subRes = await fetch('/api/payments/subscription');
        if (subRes.ok) {
          const subData = await subRes.json();
          if (!cancelled) setQuota(subData?.quota ?? null);
        }
      } catch {
        /* non-fatal — webhook will reconcile shortly */
      } finally {
        if (!cancelled) {
          if (upgraded) {
            toast.success(`Successfully upgraded to ${upgraded.charAt(0).toUpperCase() + upgraded.slice(1)}! 🎉`);
          } else if (coins) {
            toast.success('Coins added to your account! 🪙');
          }
          router.replace('/dashboard', { scroll: false });
        }
      }
    })();
    return () => { cancelled = true; };
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

  useEffect(() => {
    if (!session) return;
    fetch('/api/voices')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCustomVoices(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [session]);

  const handleAutoPrompt = async () => {
    setGeneratingPrompt(true);
    try {
      const res = await fetch('/api/reels/auto-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, mood, platform, currentPrompt: prompt.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data?.prompt) {
        setPrompt(data.prompt);
        toast.success('AI prompt generated! Feel free to edit it.');
      } else {
        toast.error(data?.error || 'Failed to generate prompt');
      }
    } catch {
      toast.error('Failed to generate prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt?.trim()) { toast.error('Enter a prompt to start'); return; }
    // Check quota — show paywall if out
    if (quota && !quota.allowed) {
      setShowPaywall(true);
      return;
    }
    setGenerating(true);
    try {
      // Free tier = one real-AI demo reel: 7s / Standard / default voice /
      // auto-matched music / allowed subtitle style. Send the clamped body so
      // the UI never trips the server's free-tier validator.
      const reqBody = isFreeTier
        ? {
            prompt: prompt.trim(),
            platform: platform.toLowerCase().replace(/\s+/g, '-'),
            style: style.toLowerCase(),
            voice: 'female-f-01',
            mood: mood.toLowerCase(),
            targetLength: 7,
            motion: false,
            subtitleStyle: {
              ...subtitleStyle,
              fontFamily: FREE_FONTS.includes(subtitleStyle?.fontFamily as any) ? subtitleStyle.fontFamily : FREE_FONTS[0],
              textColor: FREE_COLORS.includes((subtitleStyle?.textColor || '').toUpperCase() as any) ? subtitleStyle.textColor : FREE_COLORS[0],
              animation: 'karaoke',
            },
          }
        : {
            prompt: prompt.trim(),
            platform: platform.toLowerCase().replace(/\s+/g, '-'),
            style: style.toLowerCase(),
            voice: speed === 'normal' ? voice : `${voice}@${speed}`,
            mood: mood.toLowerCase(),
            targetLength,
            motion: enableMotion,
            modelTier: enableMotion ? modelTier : undefined,
            musicTrackId: musicTrackId || undefined,
            stinger: enableStinger,
            voiceTier,
            stability,
            similarity,
            subtitleStyle,
            brandPresetId: appliedPresetId || undefined,
          };
      const res = await fetch('/api/reels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok) {
        // Email verification gate
        if (res.status === 403 && data?.reason === 'email_unverified') {
          setEmailUnverified(true);
          toast.error('Please verify your email to start generating');
          return;
        }
        // Free-tier locked premium option / lifetime free reel already used
        if (res.status === 403 && (data?.reason === 'free_tier' || data?.reason === 'free_locked' || data?.reason === 'free_lifetime_exhausted' || data?.reason === 'insufficient_coins' || data?.reason === 'motion_locked' || data?.reason === 'inactive')) {
          if (data?.reason === 'free_lifetime_exhausted') setFreeReelUsed(true);
          setShowPaywall(true);
          return;
        }
        // Rate / budget limits → friendly modal
        if (res.status === 429) {
          const hrs = data?.retryAfterHours;
          setLimitModal({
            title: data?.reason === 'budget_exhausted' ? 'Free reels are taking a breather' : "You've used your free reels",
            message: (data?.message ?? 'Please try again later.') + (hrs ? ` You can create more in about ${hrs} hour${hrs === 1 ? '' : 's'}.` : ''),
          });
          return;
        }
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

  const isFreeTier = (quota?.tier ?? 'free') === 'free';
  // Lifetime free-reel state: server is source of truth (quota.freeReelUsed),
  // but a 403 during this session can flip it locally too.
  const freeReelExhausted = isFreeTier && (freeReelUsed || quota?.freeReelUsed === true);
  const remaining = quota
    ? (isFreeTier
        ? (freeReelExhausted ? 0 : 1)
        : (quota?.coinsAvailable ?? Math.max(0, (quota?.reelsCap ?? 0) - (quota?.reelsUsed ?? 0))))
    : null;

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
            <span className="text-xs text-white/50 hidden sm:inline">{isFreeTier ? 'preview left' : 'coins left'}</span>
          </div>
        )}
      </div>

      {/* Free reel used — persistent upgrade banner */}
      {freeReelExhausted && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#D4AF37]/12 to-[#7B2FBE]/12 border border-[#D4AF37]/30 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shrink-0"><Crown className="w-5 h-5 text-black" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">You’ve used your free AI reel</p>
            <p className="text-[12px] text-white/55">Upgrade to Pro for longer reels, no watermark, custom voices, music & brand presets.</p>
          </div>
          <button onClick={() => setShowPaywall(true)} className="shrink-0 text-xs px-4 py-2 rounded-lg gold-gradient text-black font-semibold">Upgrade to Pro →</button>
        </div>
      )}

      {/* Email verification banner */}
      {emailUnverified && (
        <div className="p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#D4AF37] shrink-0" />
          <p className="text-sm text-white/80 flex-1">Please verify your email before creating reels. Check your inbox for the verification link.</p>
          <button
            disabled={resending}
            onClick={async () => {
              setResending(true);
              try {
                const r = await fetch('/api/auth/resend-verification', { method: 'POST' });
                if (r.ok) toast.success('Verification email sent — check your inbox'); else toast.error('Could not resend. Try again shortly.');
              } catch { toast.error('Could not resend. Try again shortly.'); }
              finally { setResending(false); }
            }}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg gold-gradient text-black font-semibold disabled:opacity-60"
          >{resending ? 'Sending…' : 'Resend email'}</button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => window.location.reload()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {/* Applied brand preset banner (Phase 4 — Craft) */}
      {appliedPresetId && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37]/12 to-[#7B2FBE]/12 border border-[#D4AF37]/25"
        >
          <span className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0">
            <Wand2 className="w-4 h-4 text-black" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">Using preset: {appliedPresetName}</p>
            <p className="text-[11px] text-white/50">Voice, music, subtitle &amp; visual settings are pre-filled. Just add your intention.</p>
          </div>
          <button onClick={clearPreset} className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/65 hover:text-white hover:bg-white/8 transition">
            Clear
          </button>
        </motion.div>
      )}

      {/* Prompt */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#D4AF37]" />
            <label className="text-sm font-semibold text-white">Your Intention</label>
          </div>
          <button
            onClick={handleAutoPrompt}
            disabled={generatingPrompt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37]/20 to-[#7B2FBE]/20 hover:from-[#D4AF37]/30 hover:to-[#7B2FBE]/30 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium transition-all disabled:opacity-50"
          >
            {generatingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generatingPrompt ? 'Generating...' : 'AI Auto-Prompt'}
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder='e.g. "A viral manifestation reel about attracting wealth, success and abundance into my life" — or hit AI Auto-Prompt to get an enriched suggestion based on your style & mood'
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-[#D4AF37]/50 transition-colors text-sm resize-none"
        />
        <p className="text-[10px] text-white/30 mt-1.5">Your intention drives the script, visuals, voice, and music. Be specific for best results.</p>
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

      {/* Pick Voice — category tabs + variation library + your own voice */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Pick a Voice</h2>
          <span className="text-xs text-[#D4AF37] font-semibold">{selectedVoiceName}</span>
        </div>
        <p className="text-xs text-white/40 mb-3 -mt-1">{ALL_PRESET_VOICES.length} natural AI voices across styles — mysterious, historical, biblical, motivational, educated & more. Or add your own. Tap play to preview. 🔊</p>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 mb-3">
          {VOICE_CATEGORIES.map((cat) => {
            const active = voiceCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setVoiceCategory(cat)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? 'gold-gradient text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/8'
                }`}
              >
                {cat}
              </button>
            );
          })}
          <button
            onClick={() => setVoiceCategory('My Voices')}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              voiceCategory === 'My Voices' ? 'purple-gradient text-white purple-glow' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/8'
            }`}
          >
            <Mic className="w-3.5 h-3.5" /> My Voices{customVoices.length > 0 ? ` (${customVoices.length})` : ''}
          </button>
        </div>

        {/* Variation cards for preset categories */}
        {voiceCategory !== 'My Voices' && (() => {
          const activeCat = VOICE_LIBRARY.find((c) => c.category === voiceCategory);
          if (!activeCat) return null;
          return (
            <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 snap-x">
              {activeCat.variations.map((item) => {
                const selected = voice === item.id;
                const isPlaying = playingVoice === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setVoice(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVoice(item.id); }}
                    className={`group relative shrink-0 w-32 sm:w-36 snap-start rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                      selected ? 'border-[#D4AF37] gold-glow' : 'border-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className="relative aspect-square bg-white/5">
                      <Image src={activeCat.img} alt={`${item.name} narration voice`} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="144px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      {selected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full gold-gradient flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => toggleVoicePreview(e, item.id)}
                        aria-label={isPlaying ? `Pause ${item.name} voice sample` : `Play ${item.name} voice sample`}
                        className={`absolute top-2 left-2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                          isPlaying ? 'gold-gradient text-black' : 'bg-black/55 text-[#D4AF37] hover:bg-black/75 border border-[#D4AF37]/40'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" strokeWidth={2.5} /> : <Play className="w-4 h-4 ml-0.5" strokeWidth={2.5} />}
                      </button>
                      {isPlaying && (
                        <div className="absolute bottom-12 left-2 flex items-end gap-0.5 h-4">
                          {[0,1,2,3].map((b) => (
                            <span key={b} className="w-1 rounded-full bg-[#D4AF37] animate-soundbar" style={{ animationDelay: `${b * 0.15}s` }} />
                          ))}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                        <p className={`text-sm font-bold leading-tight ${selected ? 'text-[#D4AF37]' : 'text-white'}`}>{item.name}</p>
                        <p className="text-[10px] text-white/60 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* My Voices tab */}
        {voiceCategory === 'My Voices' && (
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 snap-x">
            {/* Add your own voice card */}
            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              className="group shrink-0 w-32 sm:w-36 snap-start rounded-2xl overflow-hidden border-2 border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] bg-white/[0.02] hover:bg-[#D4AF37]/5 transition-all"
            >
              <div className="aspect-square flex flex-col items-center justify-center gap-2 p-3 text-center">
                <span className="w-11 h-11 rounded-full gold-gradient flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-black" strokeWidth={3} />
                </span>
                <p className="text-xs font-bold text-[#D4AF37] leading-tight">Add Your Own Voice</p>
                <p className="text-[10px] text-white/50 leading-tight">Record or upload</p>
              </div>
            </button>

            {customVoices.map((item) => {
              const selected = voice === item.id;
              const isPlaying = playingVoice === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setVoice(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setVoice(item.id); }}
                  className={`group relative shrink-0 w-32 sm:w-36 snap-start rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                    selected ? 'border-[#D4AF37] gold-glow' : 'border-white/8 hover:border-white/20'
                  }`}
                >
                  <div className="relative aspect-square bg-gradient-to-br from-[#7B2FBE]/40 to-[#0A0A0A] flex items-center justify-center">
                    <Mic className="w-10 h-10 text-white/15" />
                    {selected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full gold-gradient flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => toggleVoicePreview(e, item.id)}
                      aria-label={isPlaying ? `Pause ${item.name}` : `Play ${item.name}`}
                      className={`absolute top-2 left-2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                        isPlaying ? 'gold-gradient text-black' : 'bg-black/55 text-[#D4AF37] hover:bg-black/75 border border-[#D4AF37]/40'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" strokeWidth={2.5} /> : <Play className="w-4 h-4 ml-0.5" strokeWidth={2.5} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteCustomVoice(e, item.id)}
                      aria-label={`Delete ${item.name}`}
                      className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/55 text-red-400 hover:bg-red-500/30 hover:text-red-300 backdrop-blur-md border border-white/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                    {isPlaying && (
                      <div className="absolute bottom-12 left-2 flex items-end gap-0.5 h-4">
                        {[0,1,2,3].map((b) => (
                          <span key={b} className="w-1 rounded-full bg-[#D4AF37] animate-soundbar" style={{ animationDelay: `${b * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 pr-10 text-left bg-gradient-to-t from-black/85 to-transparent">
                      <p className={`text-sm font-bold leading-tight truncate ${selected ? 'text-[#D4AF37]' : 'text-white'}`}>{item.name}</p>
                      <p className="text-[10px] text-white/60 mt-0.5 capitalize">{item.source === 'record' ? 'Recorded' : 'Uploaded'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Speed control */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-sm font-medium text-white">Speaking Speed</span>
          </div>
          <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
            {[
              { key: 'slow', label: 'Slower' },
              { key: 'normal', label: 'Normal' },
              { key: 'fast', label: 'Faster' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSpeed(opt.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  speed === opt.key ? 'gold-gradient text-black' : 'text-white/55 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-white/40">Controls how fast the narration is spoken in your reel.</span>
        </div>

        {/* Reel length — guaranteed output duration */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-sm font-medium text-white">Reel Length</span>
          </div>
          {isFreeTier ? (
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
                <span className="px-4 py-1.5 rounded-lg text-xs font-semibold gold-gradient text-black">7s</span>
              </div>
              <button type="button" onClick={() => setShowPaywall(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[11px] font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition">
                <Lock className="w-3 h-3" /> 15–30s with Pro
              </button>
            </div>
          ) : (
            <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
              {[5, 10, 15, 25, 30].map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => setTargetLength(len)}
                  className={`px-4 sm:px-4 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-w-[44px] min-h-[44px] sm:min-h-0 ${
                    targetLength === len ? 'gold-gradient text-black' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {len}s
                </button>
              ))}
            </div>
          )}
          <span className="text-[11px] text-white/40">{isFreeTier ? 'Free reels are a 7-second demo. Upgrade for full-length reels.' : 'Your reel is guaranteed to be this length (±1s) or your credits are refunded.'}</span>
        </div>

        {/* Audio playback is now lazy — elements created on first play */}
      </section>

      {/* Pick Mood — chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Pick a Mood</h2>
          <span className="text-xs text-[#D4AF37]">{mood}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {MOODS.map((opt) => {
            const selected = mood === opt.name;
            return (
              <button
                key={opt.name}
                onClick={() => setMood(opt.name)}
                className={`group flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selected ? 'purple-gradient text-white purple-glow' : 'bg-white/5 text-white/65 hover:bg-white/10 border border-white/8'
                }`}
              >
                <span className={`relative w-7 h-7 rounded-full overflow-hidden shrink-0 ring-2 transition-all ${selected ? 'ring-white/70' : 'ring-white/10 group-hover:ring-white/25'}`}>
                  <Image src={opt.img} alt={`${opt.name} mood`} fill className="object-cover" sizes="28px" />
                </span>
                {opt.name}
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

      {/* Voice Browser (Phase 2) — advanced voice selection with filters + preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Voice Settings</h2>
          {isFreeTier ? (
            <button
              onClick={() => setShowPaywall(true)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition"
            >
              <Lock className="w-3 h-3" /> 57 voices with Pro
            </button>
          ) : (
            <button
              onClick={() => setShowVoiceBrowser(!showVoiceBrowser)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                showVoiceBrowser ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              {showVoiceBrowser ? 'Hide Advanced' : 'Advanced Voice Controls'}
            </button>
          )}
        </div>
        {isFreeTier && (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Aria — Warm &amp; confident</p>
              <p className="text-[11px] text-white/40">Free reels use our signature voice. Unlock all 57 voices with Pro.</p>
            </div>
          </div>
        )}
        {!isFreeTier && showVoiceBrowser && (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
            <VoiceBrowser
              selectedVoiceId={voice}
              onSelect={(id) => setVoice(id)}
              previewText={prompt || undefined}
              voiceTier={voiceTier}
              onTierChange={setVoiceTier}
              stability={stability}
              onStabilityChange={setStability}
              similarity={similarity}
              onSimilarityChange={setSimilarity}
            />
          </div>
        )}
      </section>

      {/* Subtitle Editor (Phase 2) — WYSIWYG subtitle customization */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Subtitle Style</h2>
          <button
            onClick={() => setShowSubtitleEditor(!showSubtitleEditor)}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${
              showSubtitleEditor ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {showSubtitleEditor ? 'Hide Editor' : 'Customize Subtitles'}
          </button>
        </div>
        {!showSubtitleEditor && (
          <div className="flex flex-wrap gap-2 text-[11px] text-white/40">
            <span className="px-2 py-1 rounded bg-white/5">{subtitleStyle.fontFamily}</span>
            <span className="px-2 py-1 rounded bg-white/5">{subtitleStyle.animation}</span>
            <span className="px-2 py-1 rounded bg-white/5">{subtitleStyle.position}</span>
            {subtitleStyle.platform !== 'none' && (
              <span className="px-2 py-1 rounded bg-white/5">{subtitleStyle.platform} safe zone</span>
            )}
          </div>
        )}
        {showSubtitleEditor && (
          <SubtitleEditor
            value={subtitleStyle}
            onChange={setSubtitleStyle}
            previewText={prompt || 'Your abundance is flowing toward you now'}
            lockedFree={isFreeTier}
          />
        )}
      </section>

      {/* Background Music — smart matcher + custom uploads */}
      <MusicPicker
        mood={mood.toLowerCase()}
        style={style.toLowerCase()}
        platform={platform.toLowerCase().replace(/\s+/g, '-')}
        value={musicTrackId}
        onChange={setMusicTrackId}
        tier={quota?.tier}
      />

      {/* Stinger accent toggle — optional intro/outro sound */}
      <button
        type="button"
        onClick={() => setEnableStinger(v => !v)}
        className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all text-left ${
          enableStinger
            ? 'bg-[#A855F7]/10 border-[#A855F7]/40'
            : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enableStinger ? 'bg-[#A855F7]/20 text-[#A855F7]' : 'bg-white/5 text-white/40'}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Intro/Outro Accent</p>
            <p className="text-xs text-white/40">Adds a short branded sound sting to open &amp; close your reel</p>
          </div>
        </div>
        <div className={`relative w-10 h-6 rounded-full transition-colors ${enableStinger ? 'bg-[#A855F7]' : 'bg-white/15'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enableStinger ? 'translate-x-4' : ''}`} />
        </div>
      </button>

      {/* Cinematic Motion + Model Tier picker — LIVE */}
      {(() => {
        const allowedTiers = modelTierAccess(quota?.tier);
        const motionUnlocked = allowedTiers.length > 0;
        return (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              enableMotion
                ? 'bg-gradient-to-r from-[#7B2FBE]/20 to-[#D4AF37]/10 border-[#7B2FBE]/40 shadow-lg shadow-[#7B2FBE]/10'
                : 'bg-gradient-to-r from-[#7B2FBE]/10 to-[#D4AF37]/5 border-[#7B2FBE]/20'
            }`}>
              <div className="w-9 h-9 rounded-xl bg-[#7B2FBE]/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#A855F7]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  Cinematic Motion
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-bold uppercase tracking-wide">Live</span>
                </p>
                <p className="text-[11px] text-white/45 mt-0.5">
                  {motionUnlocked
                    ? (enableMotion ? 'AI-animated hero scenes enabled. Pick a render quality below.' : 'Toggle on to add AI-animated hero scenes to your reel.')
                    : 'AI-animated hero scenes for next-level reels. Available on Pro & Premium plans.'}
                </p>
              </div>
              {motionUnlocked ? (
                <button
                  type="button"
                  onClick={() => setEnableMotion(!enableMotion)}
                  className="ml-auto shrink-0 flex items-center gap-1.5 transition-colors"
                  aria-label={enableMotion ? 'Disable motion' : 'Enable motion'}
                >
                  {enableMotion ? (
                    <ToggleRight className="w-8 h-8 text-[#A855F7]" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-white/30" />
                  )}
                </button>
              ) : (
                <Link href="/dashboard/settings" className="ml-auto shrink-0 text-xs text-[#A855F7] hover:underline whitespace-nowrap">Upgrade →</Link>
              )}
            </div>

            {enableMotion && motionUnlocked && (
              <ModelTierPicker value={modelTier} onChange={setModelTier} allowed={allowedTiers} durationSec={targetLength} />
            )}
          </div>
        );
      })()}

      {/* Usage bar */}
      {quota && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <Zap className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm text-white/60">
            {isFreeTier ? (
              freeReelExhausted
                ? <><span className="text-white font-semibold">0</span> free reels left — upgrade to keep creating</>
                : <><span className="text-white font-semibold">1</span> free AI reel — your one-time demo</>
            ) : (
              <><span className="text-white font-semibold">{quota?.coinsAvailable ?? 0}</span> coins available{(quota?.bundleCoins ?? 0) > 0 ? ` (incl. ${quota.bundleCoins} bundle)` : ''}</>
            )}
            <span className="text-white/30 ml-2">({(quota?.tier ?? 'free').charAt(0).toUpperCase() + (quota?.tier ?? 'free').slice(1)} plan)</span>
          </span>
          {!quota?.allowed && (
            <Link href="/dashboard/settings" className="ml-auto text-xs text-[#D4AF37] hover:underline">Upgrade →</Link>
          )}
        </div>
      )}

      {/* Create button — once the free reel is used it becomes a locked upgrade CTA */}
      <button
        onClick={() => { if (freeReelExhausted) { setShowPaywall(true); } else { handleGenerate(); } }}
        disabled={generating || (!freeReelExhausted && !prompt?.trim())}
        className="w-full py-4 rounded-2xl gold-gradient text-black font-bold text-base hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 gold-glow"
      >
        {generating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
        ) : freeReelExhausted ? (
          <><Lock className="w-5 h-5" /> Upgrade to Create More ✨</>
        ) : isFreeTier ? (
          <><Sparkles className="w-5 h-5" /> Generate My Free AI Reel ✨</>
        ) : (
          <><Sparkles className="w-5 h-5" /> {enableMotion ? `Generate ${getModelTier(modelTier).name} Reel (${getModelTier(modelTier).coinCost} coins) ✨` : 'Generate Reel (1 coin) ✨'}</>
        )}
      </button>

      {/* Example reels showcase */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-semibold">See It In <span className="text-[#D4AF37]">Action</span></h2>
          <span className="text-xs text-white/40">Real examples</span>
        </div>
        <p className="text-sm text-white/40 mb-4">A few reels made with ManifestReel AI. Tap any to play with sound. 🔊</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1 snap-x">
          {EXAMPLE_REELS.map((reel) => {
            const isPlaying = playingReel === reel.title;
            return (
              <div
                key={reel.title}
                onClick={() => toggleReel(reel.title)}
                className="group relative shrink-0 w-44 sm:w-48 snap-start rounded-2xl overflow-hidden border-2 border-white/8 hover:border-[#D4AF37]/40 transition-all cursor-pointer"
              >
                <div className="relative aspect-[9/16] bg-white/5">
                  <video
                    ref={(el) => { videoRefs.current[reel.title] = el; }}
                    src={reel.src}
                    poster={reel.poster}
                    playsInline
                    loop
                    preload="none"
                    className="absolute inset-0 w-full h-full object-cover"
                    onEnded={() => setPlayingReel((p) => (p === reel.title ? null : p))}
                  />
                  {!isPlaying && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full gold-gradient flex items-center justify-center gold-glow group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 text-black ml-1" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                        <p className="text-sm font-bold text-white leading-tight">{reel.title}</p>
                        <p className="text-[10px] text-white/60 mt-0.5">{reel.tag}</p>
                      </div>
                    </>
                  )}
                  {isPlaying && (
                    <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20">
                      <Pause className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
                <motion.div whileHover={{ scale: 1.02 }} className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all cursor-pointer">
                  <div className="relative aspect-[9/16] bg-gradient-to-br from-[#7B2FBE]/10 to-[#4A1A8A]/10">
                    {reel?.thumbnailUrl ? (
                      <img
                        src={reel.thumbnailUrl}
                        alt={reel?.title ?? 'Reel thumbnail'}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center"><Film className="w-8 h-8 text-white/10" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[reel?.status ?? ''] ?? STATUS_COLORS['draft']}`}>
                      {(reel?.status ?? 'draft').charAt(0).toUpperCase() + (reel?.status ?? '').slice(1)}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-medium truncate text-white drop-shadow">{reel?.title ?? reel?.prompt?.slice(0, 40) ?? 'Untitled'}</p>
                      <p className="text-[11px] text-white/60 mt-0.5 truncate">{reel?.style ?? ''} • {reel?.platform ?? ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/30 p-3">
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
      {/* Free-tier rate / budget limit modal */}
      {limitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setLimitModal(null)}>
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0F0F12] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">{limitModal.title}</h3>
            <p className="text-sm text-white/60 mb-5">{limitModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => { setLimitModal(null); setShowPaywall(true); }} className="flex-1 gold-gradient text-black font-semibold rounded-xl py-2.5 text-sm">Upgrade for unlimited reels</button>
              <button onClick={() => setLimitModal(null)} className="px-4 rounded-xl border border-white/10 text-white/60 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Add Your Own Voice Modal */}
      <AddVoiceModal
        open={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onAdded={(v) => { setCustomVoices((prev) => [v, ...prev]); setVoice(v.id); setVoiceCategory('My Voices'); }}
      />
    </div>
  );
}
