'use client';
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand2, Music, Video, Type, Zap, Crown, Star, ArrowRight, Check, Menu, X, Heart, MessageCircle, Share2, Bookmark, ThumbsUp, ThumbsDown, Plus, MoreHorizontal, Music2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const SHOWCASE = [
  {
    platform: 'tiktok',
    label: 'TikTok',
    accent: '#69C9D0',
    affirmation: 'Money flows to me easily & abundantly',
    keyword: 'abundantly',
    theme: 'Wealth Manifestation',
    user: '@abundance.flow',
    likes: '128.4K', comments: '2,847', saves: '14.2K', shares: '9,312',
    music: 'Manifest 528Hz · Abundance Frequency',
    caption: 'Say it with me ✨ money comes from expected & unexpected sources 💰 #manifestation #lawofattraction',
    gradient: 'from-[#7B2FBE] via-[#4A1A8A] to-[#0A0A0A]',
    video: '/showcase/wealth.mp4',
  },
  {
    platform: 'instagram',
    label: 'Instagram Reels',
    accent: '#E1306C',
    affirmation: 'I am worthy of love & infinite abundance',
    keyword: 'love',
    theme: 'Self-Love Manifestation',
    user: 'soul.alignment',
    likes: '94,210', comments: '1,932', saves: '22.6K', shares: '7,104',
    music: 'soul.alignment · Original audio',
    caption: 'Drop a 🤍 if you receive this ✨ you are SO deserving #selflove #manifest #spiritualtok',
    gradient: 'from-[#D4AF37]/40 via-[#7B2FBE]/40 to-[#0A0A0A]',
    video: '/showcase/selflove.mp4',
  },
  {
    platform: 'shorts',
    label: 'YouTube Shorts',
    accent: '#FF0033',
    affirmation: 'My dream life is manifesting right now',
    keyword: 'manifesting',
    theme: 'Dream Manifestation',
    user: '@ManifestDaily',
    likes: '256K', comments: '4.1K', shares: 'Share',
    music: 'Manifest Daily · 528Hz Healing',
    caption: 'Watch this every morning ☀️ your dream life is closer than you think',
    gradient: 'from-[#4A1A8A] via-[#7B2FBE]/60 to-[#0A0A0A]',
    video: '/showcase/dream.mp4',
  },
];

function RailButton({ icon: Icon, count, filled, accent }: any) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="w-5 h-5 drop-shadow-md" style={filled ? { color: accent, fill: accent } : { color: '#fff' }} />
      {count && <span className="text-[9px] font-semibold text-white drop-shadow-md">{count}</span>}
    </div>
  );
}

function ShowcaseReel({ reel, index }: { reel: any; index: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);

  const handleEnter = () => {
    const v = videoRef.current;
    if (!v) return;
    setActive(true);
    v.play().catch(() => {});
  };
  const handleLeave = () => {
    const v = videoRef.current;
    setActive(false);
    if (v) { v.pause(); v.currentTime = 0; }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3 + index * 0.15 }}
      className="w-full flex flex-col items-center"
    >
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onTouchStart={handleEnter}
        className="group relative w-full aspect-[9/16] max-w-[230px] rounded-[1.5rem] overflow-hidden border border-white/10 shadow-2xl cursor-pointer"
      >
        {/* Video — always visible as a poster frame; plays on hover */}
        <video
          ref={videoRef}
          src={reel.video}
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Light tint overlay — stronger when paused, lighter when playing */}
        <div className={`absolute inset-0 bg-gradient-to-br ${reel.gradient} transition-opacity duration-500 ${active ? 'opacity-20' : 'opacity-50'}`} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(212,175,55,0.25), transparent 50%)' }} />
        {/* Play hint badge — disappears on hover */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-[#D4AF37]/40 transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}>
          <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-[#D4AF37]" />
          <span className="text-[9px] font-semibold text-[#D4AF37] uppercase tracking-wide">Hover to play</span>
        </div>
        {/* Affirmation text — fades out a bit when video plays */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-4 pb-28 text-center transition-opacity duration-500 ${active ? 'opacity-0' : 'opacity-100'}`}>
          <Sparkles className="w-6 h-6 mb-2.5 animate-float" style={{ color: '#D4AF37' }} />
          <p className="font-display text-[12.5px] font-bold leading-tight drop-shadow-lg">
            {reel.affirmation.split(reel.keyword)[0]}
            <span style={{ color: '#D4AF37' }}>{reel.keyword}</span>
            {reel.affirmation.split(reel.keyword)[1]}
          </p>
          <p className="text-[8px] uppercase tracking-wider text-white/55 mt-2">{reel.theme} · 30s</p>
        </div>
        {/* Legibility gradients — soften when playing */}
        <div className={`absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-500 ${active ? 'opacity-30' : 'opacity-100'}`} />
        <div className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-500 ${active ? 'opacity-20' : 'opacity-100'}`} />

        {/* ===== TikTok chrome ===== */}
        {reel.platform === 'tiktok' && (
          <>
            <div className="absolute top-2.5 left-0 right-0 flex items-center justify-center gap-3 text-[10px] font-semibold">
              <span className="text-white/50">Following</span>
              <span className="text-white border-b-2 border-white pb-0.5">For You</span>
            </div>
            <div className="absolute right-1.5 bottom-14 flex flex-col items-center gap-3.5">
              <div className="relative mb-1">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#7B2FBE] border-2 border-white" />
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#FE2C55] flex items-center justify-center"><Plus className="w-2.5 h-2.5 text-white" /></div>
              </div>
              <RailButton icon={Heart} count={reel.likes} filled accent="#FE2C55" />
              <RailButton icon={MessageCircle} count={reel.comments} />
              <RailButton icon={Bookmark} count={reel.saves} filled accent="#D4AF37" />
              <RailButton icon={Share2} count={reel.shares} />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7B2FBE] to-[#4A1A8A] border border-white/20 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}><Music2 className="w-3.5 h-3.5 text-white" /></div>
            </div>
            <div className="absolute left-3 right-11 bottom-2.5">
              <p className="text-[11px] font-bold mb-0.5">{reel.user}</p>
              <p className="text-[9px] text-white/85 leading-snug line-clamp-1 mb-1">{reel.caption}</p>
              <div className="flex items-center gap-1"><Music className="w-2.5 h-2.5 text-white shrink-0" /><span className="text-[8px] text-white/80 truncate">{reel.music}</span></div>
            </div>
          </>
        )}

        {/* ===== Instagram Reels chrome ===== */}
        {reel.platform === 'instagram' && (
          <>
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <ArrowRight className="w-4 h-4 text-white rotate-180" />
              <span className="font-display text-sm font-bold">Reels</span>
              <Heart className="w-4 h-4 text-white" />
            </div>
            <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3.5">
              <RailButton icon={Heart} count={reel.likes} filled accent="#FE2C55" />
              <RailButton icon={MessageCircle} count={reel.comments} />
              <RailButton icon={Share2} count={reel.shares} />
              <RailButton icon={Bookmark} count={reel.saves} filled accent="#D4AF37" />
              <MoreHorizontal className="w-5 h-5 text-white" />
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#E1306C] to-[#7B2FBE] border border-white/30" />
            </div>
            <div className="absolute left-3 right-12 bottom-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-[1.5px]"><div className="w-full h-full rounded-full bg-[#0A0A0A]" /></div>
                <p className="text-[10px] font-semibold">{reel.user}</p>
                <span className="text-[8px] border border-white/50 rounded px-1.5 py-0.5 font-semibold">Follow</span>
              </div>
              <p className="text-[9px] text-white/85 leading-snug line-clamp-1 mb-1">{reel.caption}</p>
              <div className="flex items-center gap-1"><Music className="w-2.5 h-2.5 text-white shrink-0" /><span className="text-[8px] text-white/80 truncate">{reel.music}</span></div>
            </div>
          </>
        )}

        {/* ===== YouTube Shorts chrome ===== */}
        {reel.platform === 'shorts' && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <div className="flex items-center gap-1"><div className="w-5 h-5 rounded-md bg-[#FF0033] flex items-center justify-center"><div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white ml-0.5" /></div><span className="text-sm font-bold">Shorts</span></div>
            </div>
            <div className="absolute right-2 bottom-14 flex flex-col items-center gap-3.5">
              <RailButton icon={ThumbsUp} count={reel.likes} />
              <RailButton icon={ThumbsDown} count="Dislike" />
              <RailButton icon={MessageCircle} count={reel.comments} />
              <RailButton icon={Share2} count={reel.shares} />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7B2FBE] to-[#4A1A8A] border border-white/20 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}><Music2 className="w-3.5 h-3.5 text-white" /></div>
            </div>
            <div className="absolute left-3 right-12 bottom-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#FF0033] to-[#D4AF37]" />
                <p className="text-[10px] font-semibold">{reel.user}</p>
                <span className="text-[8px] bg-[#FF0033] rounded-full px-2 py-0.5 font-semibold">Subscribe</span>
              </div>
              <p className="text-[9px] text-white/85 leading-snug line-clamp-1 mb-1">{reel.caption}</p>
              <div className="flex items-center gap-1"><Music className="w-2.5 h-2.5 text-white shrink-0" /><span className="text-[8px] text-white/80 truncate">{reel.music}</span></div>
            </div>
          </>
        )}
      </div>
      <span className="mt-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium" style={{ color: reel.accent }}>{reel.label}</span>
    </motion.div>
  );
}

const FEATURES = [
  { icon: Type, title: 'AI Script Writing', desc: 'Powerful manifestation scripts crafted by AI, optimized for engagement and spiritual impact.', color: '#D4AF37' },
  { icon: Music, title: 'Voice & Music', desc: 'Soothing voiceovers paired with 528Hz frequency music and ambient soundscapes.', color: '#7B2FBE' },
  { icon: Video, title: 'Cinematic Visuals', desc: 'Stock visuals and AI-generated backgrounds matched to your manifestation theme.', color: '#D4AF37' },
  { icon: Sparkles, title: 'Auto Captions', desc: 'Perfectly synced karaoke-style captions that boost engagement and accessibility.', color: '#7B2FBE' },
];

const TIERS = [
  { name: 'Free', monthly: 0, features: ['Demo gallery access', '1 watermarked preview', 'Explore all styles & moods', 'No card required'], cta: 'Start Free', tier: 'free', popular: false },
  { name: 'Pro', monthly: 19.99, features: ['30 coins / month', 'Static reels (1 coin each)', 'HD exports, no watermark', 'All 57 premium voices', 'Buy extra coin bundles'], cta: 'Get Pro', tier: 'pro', popular: true },
  { name: 'Premium', monthly: 49.99, features: ['60 coins / month', 'Cinematic motion reels (4 coins)', 'Static reels too (1 coin)', '4K exports, no watermark', 'Priority generation', 'Schedule & auto-post'], cta: 'Get Premium', tier: 'premium', popular: false },
];

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Manifestation Coach', avatar: '/testimonials/sarah.jpg', text: 'ManifestReel completely transformed my content game. I went from struggling to post to having a week of reels done in 20 minutes. My audience has grown 3x since I started using it.', stars: 5 },
  { name: 'David K.', role: 'Spiritual Creator', avatar: '/testimonials/david.jpg', text: 'The quality of the scripts is incredible. My followers think I hired a professional team. The 528Hz music tracks are chef\'s kiss — my reels actually feel healing.', stars: 5 },
  { name: 'Luna R.', role: 'LOA Influencer', avatar: '/testimonials/luna.jpg', text: 'I\'ve tried every reel tool out there. This is the only one that actually understands the manifestation niche. 500K views on my first reel. Game changer.', stars: 5 },
  { name: 'Marcus T.', role: 'Mindset Mentor', avatar: '/testimonials/marcus.jpg', text: 'As someone who coaches high-performers, my content needs to match that energy. ManifestReel delivers polished, professional reels that resonate with my audience every single time.', stars: 5 },
  { name: 'Priya S.', role: 'Meditation Teacher', avatar: '/testimonials/priya.jpg', text: 'The combination of soothing voiceovers and frequency music is perfect for my guided meditation reels. My students love sharing them. It\'s like having a whole production studio.', stars: 5 },
  { name: 'Aiden C.', role: 'TikTok Creator', avatar: '/testimonials/aiden.jpg', text: 'I was spending 4+ hours per reel manually. Now I create 5 in under an hour and they perform even better. The captions sync perfectly — my engagement rate doubled.', stars: 5 },
  { name: 'Jasmine W.', role: 'Abundance Coach', avatar: '/testimonials/jasmine.jpg', text: 'My clients always ask how I make my reels so beautiful. ManifestReel gives me that luxury aesthetic without needing any design skills. The affirmation scripts are pure gold.', stars: 5 },
  { name: 'Elena V.', role: 'Energy Healer', avatar: '/testimonials/elena.jpg', text: 'What I love most is how the AI truly captures spiritual language. Other tools feel generic, but ManifestReel creates scripts that feel authentic to the healing community.', stars: 5 },
  { name: 'Tyler M.', role: 'YouTube Shorts Creator', avatar: '/testimonials/tyler.jpg', text: 'I repurpose every reel across TikTok, Instagram, and YouTube Shorts. ManifestReel optimizes for all three platforms automatically. My channel hit 100K subscribers thanks to consistent posting.', stars: 5 },
];

export function LandingPage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  const handlePricing = async (tier: string) => {
    if (!session) {
      router.push('/signup');
      return;
    }
    if (tier === 'free') {
      router.push('/dashboard');
      return;
    }
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Failed to process upgrade');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#D4AF37]" />
            <span className="font-display text-lg font-bold tracking-tight">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-white/60 hover:text-white transition-colors">Reviews</a>
            {session ? (
              <Link href="/dashboard" className="px-4 py-2 rounded-lg gold-gradient text-black font-semibold text-sm hover:opacity-90 transition-opacity">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign In</Link>
                <Link href="/signup" className="px-4 py-2 rounded-lg gold-gradient text-black font-semibold text-sm hover:opacity-90 transition-opacity">Get Started</Link>
              </>
            )}
          </nav>
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 px-4 pb-4">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block py-2 text-white/60">Features</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block py-2 text-white/60">Pricing</a>
            <a href="#testimonials" onClick={() => setMobileMenu(false)} className="block py-2 text-white/60">Reviews</a>
            {session ? (
              <Link href="/dashboard" className="block py-2 text-[#D4AF37] font-semibold">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="block py-2 text-white/60">Sign In</Link>
                <Link href="/signup" className="block py-2 text-[#D4AF37] font-semibold">Get Started</Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 hero-gradient">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-[#7B2FBE]/10 rounded-full blur-[100px]" />
          <div className="absolute top-40 right-1/4 w-48 h-48 bg-[#D4AF37]/10 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-[1200px] mx-auto px-4 text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-xs text-white/70">AI-Powered Manifestation Content</span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Create <span className="text-[#D4AF37]">Viral</span> Manifestation<br />Reels in Minutes
            </h1>
            <p className="text-base md:text-lg text-white/50 max-w-2xl mx-auto mb-8 leading-relaxed">
              Type your intention, pick a style, and let AI craft a stunning vertical reel
              with script, voiceover, music, and captions — ready to post.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={session ? '/dashboard' : '/signup'} className="px-8 py-3.5 rounded-xl gold-gradient text-black font-bold text-base hover:opacity-90 transition-all gold-glow flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Start Creating Free
              </Link>
              <a href="#features" className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-base hover:bg-white/10 transition-all flex items-center gap-2">
                See How It Works <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2">
              <div className="flex -space-x-2">
                {[
                  { src: '/testimonials/sarah.jpg', alt: 'Happy creator Sarah' },
                  { src: '/testimonials/david.jpg', alt: 'Happy creator David' },
                  { src: '/testimonials/jasmine.jpg', alt: 'Happy creator Jasmine' },
                  { src: '/testimonials/priya.jpg', alt: 'Happy creator Priya' },
                  { src: '/testimonials/marcus.jpg', alt: 'Happy creator Marcus' },
                ].map((item, i) => (
                  <div key={i} className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#0A0A0A] ring-1 ring-[#D4AF37]/30">
                    <Image src={item.src} alt={item.alt} fill className="object-cover" sizes="32px" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 sm:ml-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                  ))}
                </div>
                <span className="text-sm text-white/60">Rated <span className="text-white/90 font-semibold">4.9/5</span> by <span className="text-white/90 font-semibold">2,000+</span> creators</span>
              </div>
            </div>
          </motion.div>

          {/* Platform showcase reels */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-16"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-white/40 mb-8">One prompt, ready for every platform</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-5 max-w-3xl mx-auto">
              {SHOWCASE.map((reel: any, i: number) => (
                <ShowcaseReel key={reel.platform} reel={reel} index={i} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Four Pillars of <span className="text-[#D4AF37]">Creation</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">Every reel is crafted through our AI pipeline — from script to final render.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f: any, i: number) => (
              <motion.div
                key={f?.title ?? i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${f?.color ?? '#D4AF37'}15` }}>
                  {f?.icon && <f.icon className="w-5 h-5" style={{ color: f?.color ?? '#D4AF37' }} />}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{f?.title ?? ''}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f?.desc ?? ''}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-32 bg-white/[0.01]">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, Transparent Pricing</h2>
            <p className="text-white/50 max-w-xl mx-auto">Start free. Upgrade when you're ready to scale your manifestation content.</p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
              >
                Annually
                <span className="text-[11px] font-bold text-[#D4AF37]">50% OFF</span>
              </button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TIERS.map((t: any, i: number) => (
              <motion.div
                key={t?.name ?? i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className={`relative p-6 rounded-xl border transition-all duration-300 ${
                  t?.popular ? 'bg-gradient-to-b from-[#D4AF37]/10 to-transparent border-[#D4AF37]/30 gold-glow' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                {t?.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gold-gradient text-black text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-display text-lg font-semibold">{t?.name ?? ''}</h3>
                    {billing === 'annual' && t?.monthly > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">50% OFF</span>
                    )}
                  </div>
                  {t?.monthly === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-[#D4AF37]">$0</span>
                      <span className="text-sm text-white/40">forever</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        {billing === 'annual' && (
                          <span className="text-lg font-semibold text-white/30 line-through">${t.monthly}</span>
                        )}
                        <span className="text-3xl font-bold text-[#D4AF37]">
                          ${billing === 'annual' ? (t.monthly / 2).toFixed(2) : t.monthly}
                        </span>
                        <span className="text-sm text-white/40">/mo</span>
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {billing === 'annual'
                          ? `Billed $${(t.monthly * 6).toFixed(2)} yearly`
                          : 'Billed monthly'}
                      </p>
                    </div>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {(t?.features ?? []).map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePricing(t?.tier ?? 'free')}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    t?.popular ? 'gold-gradient text-black hover:opacity-90' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {t?.cta ?? 'Get Started'}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">Loved by <span className="text-[#D4AF37]">Creators</span></h2>
            <p className="text-white/50 max-w-xl mx-auto">Join thousands of manifestation creators who transformed their content with AI.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t: any, i: number) => (
              <motion.div
                key={t?.name ?? i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: (i % 3) * 0.1 }}
                className="group p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-[#D4AF37]/30 shrink-0">
                    <Image src={t.avatar} alt={t.name} fill className="object-cover" sizes="44px" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t?.name ?? ''}</p>
                    <p className="text-xs text-[#D4AF37] truncate">{t?.role ?? ''}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t?.stars ?? 5 }).map((_: any, j: number) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                  ))}
                </div>
                <p className="text-sm text-white/65 leading-relaxed">"{t?.text ?? ''}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-4 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Ready to <span className="text-[#D4AF37]">Manifest</span> Your Content?
            </h2>
            <p className="text-white/50 max-w-lg mx-auto mb-8">Join thousands of creators using AI to build their spiritual brand.</p>
            <Link href={session ? '/dashboard' : '/signup'} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl gold-gradient text-black font-bold text-lg hover:opacity-90 transition-all gold-glow">
              <Sparkles className="w-5 h-5" /> Create Your First Reel
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-4">
          {/* Main footer content */}
          <div className="py-10 flex flex-col items-center text-center">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-display text-lg font-bold tracking-tight">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed max-w-sm">
              The #1 AI-powered platform for creating viral manifestation reels.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Bottom bar */}
          <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Sparkles className="w-3 h-3 text-[#D4AF37]/50" />
              <span>Powered by <span className="text-white/50 font-medium">ManifestReel AI</span></span>
            </div>
            <p className="text-xs text-white/30 text-center">
              © {new Date().getFullYear()} ManifestReel AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
