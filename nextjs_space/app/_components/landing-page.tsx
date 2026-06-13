'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand2, Music, Video, Type, Zap, Crown, Star, ArrowRight, Check, Menu, X, Heart, MessageCircle, Share2, Bookmark, ThumbsUp, ThumbsDown, Plus, MoreHorizontal, Music2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import YouTubePlayer from '@/components/youtube-player';

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
  { icon: Type, title: 'AI Script Writing', desc: 'Powerful manifestation scripts crafted by AI, optimized for engagement and spiritual impact.', color: '#D4AF37', image: '/features/ai-script.jpg' },
  { icon: Music, title: 'Voice & Music', desc: 'Soothing voiceovers paired with 528Hz frequency music and ambient soundscapes.', color: '#7B2FBE', image: '/features/voice-music.jpg' },
  { icon: Video, title: 'Cinematic AI Motion', desc: 'Cinematic tier is all-motion AI video powered by Veo 3 Fast — every scene animated. Pro adds up to 4 animated hero scenes; Standard includes 2 cinematic motion scenes plus premium Ken Burns stills.', color: '#D4AF37', image: '/features/cinematic-motion.jpg' },
  { icon: Sparkles, title: 'Auto Captions', desc: 'Perfectly synced karaoke-style captions that boost engagement and accessibility.', color: '#7B2FBE', image: '/features/auto-captions.jpg' },
];

const TIERS = [
  { name: 'Free', monthly: 0, annualMo: 0, annualTotal: 0, annualSave: 0, features: ['Demo gallery access', 'Full configurator access — explore all styles & moods', 'Browse premium voices & music library', 'No card required'], cta: 'Get Started', tier: 'free', popular: false },
  { name: 'Starter', monthly: 14.99, annualMo: 8.99, annualTotal: 107.88, annualSave: 72, features: ['1,500 credits / month', '10 premium voices', 'Up to Standard quality', '720p & 1080p exports', 'Auto-matched background music'], cta: 'Get Starter', tier: 'starter', popular: false },
  { name: 'Creator', monthly: 34.99, annualMo: 20.99, annualTotal: 251.88, annualSave: 168, features: ['4,000 credits / month', '30 premium voices', 'Up to Pro quality', '1080p exports', 'Custom music uploads'], cta: 'Get Creator', tier: 'creator', popular: true },
  { name: 'Pro', monthly: 79.99, annualMo: 47.99, annualTotal: 575.88, annualSave: 384, features: ['10,000 credits / month', 'All 150+ voices', 'Cinematic quality (Veo 3)', 'Brand Kit (unlimited presets)', '4K upscale add-on'], cta: 'Get Pro', tier: 'pro', popular: false },
  { name: 'Studio', monthly: 199, annualMo: 119, annualTotal: 1432.80, annualSave: 956, features: ['30,000 credits / month', 'All 150+ voices + cloning (Q3 2026)', 'All quality tiers', 'Priority rendering', 'White-label exports'], cta: 'Start Studio', tier: 'studio', popular: false },
];


const TESTIMONIALS = [
  // Row 1
  { name: 'Sarah M.', role: 'Manifestation Coach', avatar: '/testimonials/sarah.jpg', platform: 'instagram' as const, text: 'ManifestReel completely transformed my content game. I went from struggling to post to having a week of reels done in 20 minutes. My audience has grown 3x since I started using it.', stars: 5 },
  { name: 'David K.', role: 'Spiritual Creator', avatar: '/testimonials/david.jpg', platform: 'youtube' as const, text: 'The quality of the scripts is incredible. My followers think I hired a professional team. The 528Hz music tracks are chef\'s kiss — my reels actually feel healing.', stars: 5 },
  { name: 'Luna R.', role: 'LOA Influencer', avatar: '/testimonials/luna.jpg', platform: 'tiktok' as const, text: 'I\'ve tried every reel tool out there. This is the only one that actually understands the manifestation niche. 500K views on my first reel. Game changer.', stars: 5 },
  { name: 'Marcus T.', role: 'Mindset Mentor', avatar: '/testimonials/marcus.jpg', platform: 'youtube' as const, text: 'As someone who coaches high-performers, my content needs to match that energy. ManifestReel delivers polished, professional reels that resonate with my audience every single time.', stars: 5 },
  { name: 'Natasha P.', role: 'Affirmation Creator', avatar: '/testimonials/natasha.jpg', platform: 'instagram' as const, text: 'I post 3 reels a day now — all made in under 10 minutes each. The affirmation scripts feel like they were written just for my audience. Engagement is through the roof.', stars: 5 },
  { name: 'Jordan L.', role: 'Mindfulness Coach', avatar: '/testimonials/jordan.jpg', platform: 'tiktok' as const, text: 'My TikTok went from 2K to 85K followers in two months. ManifestReel\'s caption sync is flawless — people watch my reels on mute and still get the full message.', stars: 5 },
  { name: 'Mei C.', role: 'Wellness Creator', avatar: '/testimonials/mei.jpg', platform: 'youtube' as const, text: 'The cinematic quality is insane for the price. My Shorts look like they were made by a production house. Clients think I have a whole team behind me.', stars: 5 },
  { name: 'Carlos R.', role: 'Life Coach', avatar: '/testimonials/carlos.jpg', platform: 'instagram' as const, text: 'I\'ve tried Canva, CapCut, everything — nothing comes close. ManifestReel understands the coaching niche perfectly. My DMs are flooded with new client inquiries.', stars: 5 },
  // Row 2
  { name: 'Priya S.', role: 'Meditation Teacher', avatar: '/testimonials/priya.jpg', platform: 'youtube' as const, text: 'The combination of soothing voiceovers and frequency music is perfect for my guided meditation reels. My students love sharing them. It\'s like having a whole production studio.', stars: 5 },
  { name: 'Aiden C.', role: 'TikTok Creator', avatar: '/testimonials/aiden.jpg', platform: 'tiktok' as const, text: 'I was spending 4+ hours per reel manually. Now I create 5 in under an hour and they perform even better. The captions sync perfectly — my engagement rate doubled.', stars: 5 },
  { name: 'Jasmine W.', role: 'Abundance Coach', avatar: '/testimonials/jasmine.jpg', platform: 'instagram' as const, text: 'My clients always ask how I make my reels so beautiful. ManifestReel gives me that luxury aesthetic without needing any design skills. The affirmation scripts are pure gold.', stars: 5 },
  { name: 'Elena V.', role: 'Energy Healer', avatar: '/testimonials/elena.jpg', platform: 'instagram' as const, text: 'What I love most is how the AI truly captures spiritual language. Other tools feel generic, but ManifestReel creates scripts that feel authentic to the healing community.', stars: 5 },
  { name: 'Aria H.', role: 'Gratitude Creator', avatar: '/testimonials/aria.jpg', platform: 'tiktok' as const, text: 'My gratitude reels get saved more than any other content I make. ManifestReel nails the vibe every time — warm visuals, perfect voiceover, healing music. Pure magic.', stars: 5 },
  { name: 'Ben S.', role: 'Shorts Creator', avatar: '/testimonials/ben.jpg', platform: 'youtube' as const, text: 'I monetized my YouTube Shorts channel in 3 months thanks to consistent posting with ManifestReel. The batch creation feature is a total game-changer for productivity.', stars: 5 },
  { name: 'Zara K.', role: 'Spiritual Influencer', avatar: '/testimonials/zara.jpg', platform: 'instagram' as const, text: 'Every reel feels like a mini masterpiece. My followers tell me my content is the highlight of their morning scroll. That\'s the ManifestReel effect.', stars: 5 },
  { name: 'Miles J.', role: 'Manifestation Creator', avatar: '/testimonials/miles.jpg', platform: 'tiktok' as const, text: 'Went viral 4 times in one month. The AI scripts hit different — they feel personal, not robotic. My comment sections are full of people saying "I needed this today."', stars: 5 },
  // Row 3
  { name: 'Tyler M.', role: 'YouTube Shorts Creator', avatar: '/testimonials/tyler.jpg', platform: 'youtube' as const, text: 'I repurpose every reel across TikTok, Instagram, and YouTube Shorts. ManifestReel optimizes for all three platforms automatically. My channel hit 100K subscribers thanks to consistent posting.', stars: 5 },
  { name: 'Olivia D.', role: 'Vision Board Coach', avatar: '/testimonials/olivia.jpg', platform: 'instagram' as const, text: 'ManifestReel turned my vision board workshops into a viral reel series. The visual quality is stunning and my workshop signups tripled since I started posting consistently.', stars: 5 },
  { name: 'Kai N.', role: 'Breathwork Guide', avatar: '/testimonials/kai.jpg', platform: 'youtube' as const, text: 'The frequency music library is incredible — 528Hz, 432Hz, all perfectly matched. My breathwork reels feel like an experience, not just a video. Subscribers love it.', stars: 5 },
  { name: 'Sofia G.', role: 'LOA TikToker', avatar: '/testimonials/sofia.jpg', platform: 'tiktok' as const, text: 'From 500 followers to 200K in 4 months. ManifestReel is my secret weapon. The scripting AI genuinely understands law of attraction language — not generic motivation.', stars: 5 },
  { name: 'Theo W.', role: 'Mindset Creator', avatar: '/testimonials/theo.jpg', platform: 'youtube' as const, text: 'I run 3 YouTube channels and ManifestReel powers all of them. The batch workflow saves me 20+ hours a week. Quality is consistently cinematic — my audience can\'t tell it\'s AI.', stars: 5 },
  { name: 'Nina F.', role: 'Self-Love Coach', avatar: '/testimonials/nina.jpg', platform: 'instagram' as const, text: 'My self-love affirmation series went viral — 2M views in a week. The voiceover quality is so warm and authentic, people thought I recorded it myself. Absolutely love this tool.', stars: 5 },
  { name: 'Ryan T.', role: 'Meditation Creator', avatar: '/testimonials/ryan.jpg', platform: 'tiktok' as const, text: 'Best investment I\'ve made for my content business. Each reel takes 3 minutes to create and performs better than anything I used to spend hours editing manually.', stars: 5 },
  { name: 'Amber L.', role: 'Abundance Creator', avatar: '/testimonials/amber.jpg', platform: 'instagram' as const, text: 'The gold aesthetic in ManifestReel perfectly matches my abundance brand. My reels look cohesive, premium, and professional. Followers constantly ask what tool I use.', stars: 5 },
];

const ROW1_TESTIMONIALS = TESTIMONIALS.slice(0, 8);
const ROW2_TESTIMONIALS = TESTIMONIALS.slice(8, 16);
const ROW3_TESTIMONIALS = TESTIMONIALS.slice(16, 24);

const PLATFORM_ICONS: Record<string, { color: string; path: string }> = {
  tiktok: { color: '#00f2ea', path: 'M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  instagram: { color: '#E1306C', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  youtube: { color: '#FF0000', path: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
};

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
      const res = await fetch('/api/payments/create-checkout-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'subscription', tier, billing }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
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
                <span className="text-sm text-white/60">Rated <span className="text-white/90 font-semibold">4.9/5</span> by <span className="text-white/90 font-semibold">50,000+</span> creators</span>
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
                className="group rounded-2xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-500"
              >
                {/* Feature image */}
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={f.image}
                    alt={f?.title ?? 'Feature'}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
                  {/* Icon badge */}
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${f?.color ?? '#D4AF37'}20`, border: `1px solid ${f?.color ?? '#D4AF37'}30` }}>
                    {f?.icon && <f.icon className="w-5 h-5" style={{ color: f?.color ?? '#D4AF37' }} />}
                  </div>
                </div>
                {/* Text content */}
                <div className="p-6">
                  <h3 className="font-display text-lg font-semibold mb-2">{f?.title ?? ''}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f?.desc ?? ''}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-32 bg-white/[0.01]">
        <div className="max-w-[1400px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, Transparent Pricing</h2>
            <p className="text-white/50 max-w-xl mx-auto">Start free. Upgrade when you're ready to scale your manifestation content.</p>
          </motion.div>

          {/* Billing toggle — Annual LEFT (default), Monthly RIGHT */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
              <button
                onClick={() => setBilling('annual')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billing === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
              >
                Annual ✓
                <span className={`text-[11px] font-bold ${billing === 'annual' ? 'text-emerald-600' : 'text-emerald-400'}`}>(Save 40%)</span>
              </button>
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
              >
                Monthly
              </button>
            </div>
          </motion.div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 lg:gap-4 max-w-6xl mx-auto items-start">
            {TIERS.map((t, i) => {
              const isPro = t.popular;
              const isStudio = t.tier === 'studio';

              return (
                <motion.div
                  key={t.name}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  transition={{ delay: i * 0.08 }}
                  className={`relative p-6 rounded-xl border transition-all duration-300 ${
                    isPro
                      ? 'bg-gradient-to-b from-[#D4AF37]/10 via-[#D4AF37]/5 to-transparent border-[#D4AF37]/40 shadow-[0_0_30px_rgba(212,175,55,0.15)] xl:scale-[1.10] z-10'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Pro badge — top right */}
                  {isPro && (
                    <div className="absolute -top-3 right-3 px-3 py-1 rounded-full gold-gradient text-black text-[11px] font-bold flex items-center gap-1 shadow-lg">
                      ⭐ MOST POPULAR
                    </div>
                  )}

                  {/* Trial badge — paid tiers only (not Studio) */}
                  {t.monthly > 0 && !isStudio && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                      3-day free trial
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-display text-lg font-semibold mb-3">{t.name}</h3>

                    {t.monthly === 0 ? (
                      /* ── Free tier ── */
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-[#D4AF37]">$0</span>
                        <span className="text-sm text-white/40">forever</span>
                      </div>
                    ) : billing === 'annual' ? (
                      /* ── Annual view ── */
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold text-[#D4AF37]">
                            ${t.annualMo % 1 === 0 ? t.annualMo.toFixed(0) : t.annualMo.toFixed(2)}
                          </span>
                          <span className="text-sm text-white/40">/mo</span>
                        </div>
                      </div>
                    ) : (
                      /* ── Monthly view ── */
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold text-[#D4AF37]">
                            ${t.monthly % 1 === 0 ? t.monthly.toFixed(0) : t.monthly.toFixed(2)}
                          </span>
                          <span className="text-sm text-white/40">/mo</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                        <Check className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>

                  {/* Studio: money-back badge */}
                  {isStudio && (
                    <div className="flex items-center gap-1.5 mb-3 text-[11px] font-semibold text-emerald-400">
                      <span>✅</span> 30-day money-back guarantee
                    </div>
                  )}

                  <button
                    onClick={() => handlePricing(t.tier)}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all gold-gradient text-black hover:opacity-90"
                  >
                    {t.cta}
                  </button>

                  {/* Studio: Talk to Sales link */}
                  {isStudio && (
                    <a href="mailto:hello@manifestreel.ai?subject=Studio%20Inquiry" className="block text-center mt-2 text-xs text-white/40 hover:text-white/60 transition">
                      or Talk to Sales →
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Credits note */}
          <p className="text-center text-xs text-white/30 mt-6">
            🔄 Unused credits roll over for 60 days (capped at 1× monthly allotment). Auto-posting launches soon — Pro+ early access.
          </p>

          {/* Subscriber top-up link */}
          <p className="text-center text-xs text-white/30 mt-8">
            Already a subscriber?{' '}
            <Link
              href={session ? '/dashboard/settings' : '/login?next=/dashboard/settings'}
              className="text-[#D4AF37] hover:underline"
            >
              Buy extra credits →
            </Link>
          </p>
        </div>
      </section>

      {/* Demo Videos — YouTube-style showcase */}
      <section className="py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
              From idea to viral — <span className="text-[#D4AF37]">watch it happen live.</span>
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Real creators, real reactions — generating scroll-stopping reels with ManifestReel AI in just 30 seconds. No editing skills, no expensive gear, just a few clicks.
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[960px] mx-auto">
            <YouTubePlayer
              src="/showcase/demos/demo-1.mp4"
              title="Creating a manifestation reel from scratch"
              views="12K views"
              timeAgo="2 days ago"
            />
            <YouTubePlayer
              src="/showcase/demos/demo-2.mp4"
              title="Picking voice, style & mood in seconds"
              views="8.4K views"
              timeAgo="5 days ago"
            />
            <YouTubePlayer
              src="/showcase/demos/demo-3.mp4"
              title="From prompt to finished reel — 30 seconds"
              views="15K views"
              timeAgo="1 week ago"
            />
          </motion.div>
        </div>
      </section>

      {/* Testimonials — auto-scrolling marquee */}
      <section id="testimonials" className="py-20 md:py-32 overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">What Creators Say About <span className="text-[#D4AF37]">ManifestReel AI</span></h2>
            <p className="text-white/50 max-w-xl mx-auto">Join thousands of manifestation creators who transformed their content with AI.</p>
          </motion.div>
        </div>

        {/* Row 1 — scrolls left */}
        <div className="relative mb-5">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee-left gap-4 w-max">
            {[...ROW1_TESTIMONIALS, ...ROW1_TESTIMONIALS].map((t: any, i: number) => {
              const pi = PLATFORM_ICONS[t.platform];
              return (
                <div
                  key={`r1-${i}`}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-white/[0.04] border border-[#D4AF37]/15 hover:border-[#D4AF37]/40 transition-all duration-300 shrink-0 max-w-[420px]"
                >
                  <div className="relative shrink-0">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4AF37]/30">
                      <Image src={t.avatar} alt={t.name} fill className="object-cover" sizes="40px" />
                    </div>
                    {pi && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#0A0A0A] flex items-center justify-center" style={{ width: 18, height: 18 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pi.color}><path d={pi.path} /></svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{t?.name ?? ''}</span>
                      <span className="text-[10px] text-[#D4AF37]/60">|</span>
                      <span className="text-xs text-[#D4AF37] whitespace-nowrap">{t?.role ?? ''}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate max-w-[280px]">"{t?.text?.slice(0, 80) ?? ''}…"</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="relative mb-5">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee-right gap-4 w-max">
            {[...ROW2_TESTIMONIALS, ...ROW2_TESTIMONIALS].map((t: any, i: number) => {
              const pi = PLATFORM_ICONS[t.platform];
              return (
                <div
                  key={`r2-${i}`}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-white/[0.04] border border-[#D4AF37]/15 hover:border-[#D4AF37]/40 transition-all duration-300 shrink-0 max-w-[420px]"
                >
                  <div className="relative shrink-0">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4AF37]/30">
                      <Image src={t.avatar} alt={t.name} fill className="object-cover" sizes="40px" />
                    </div>
                    {pi && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#0A0A0A] flex items-center justify-center" style={{ width: 18, height: 18 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pi.color}><path d={pi.path} /></svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{t?.name ?? ''}</span>
                      <span className="text-[10px] text-[#D4AF37]/60">|</span>
                      <span className="text-xs text-[#D4AF37] whitespace-nowrap">{t?.role ?? ''}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate max-w-[280px]">"{t?.text?.slice(0, 80) ?? ''}…"</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3 — scrolls left (slower) */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee-left-slow gap-4 w-max">
            {[...ROW3_TESTIMONIALS, ...ROW3_TESTIMONIALS].map((t: any, i: number) => {
              const pi = PLATFORM_ICONS[t.platform];
              return (
                <div
                  key={`r3-${i}`}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-white/[0.04] border border-[#D4AF37]/15 hover:border-[#D4AF37]/40 transition-all duration-300 shrink-0 max-w-[420px]"
                >
                  <div className="relative shrink-0">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4AF37]/30">
                      <Image src={t.avatar} alt={t.name} fill className="object-cover" sizes="40px" />
                    </div>
                    {pi && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-[#0A0A0A] flex items-center justify-center" style={{ width: 18, height: 18 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={pi.color}><path d={pi.path} /></svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{t?.name ?? ''}</span>
                      <span className="text-[10px] text-[#D4AF37]/60">|</span>
                      <span className="text-xs text-[#D4AF37] whitespace-nowrap">{t?.role ?? ''}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate max-w-[280px]">"{t?.text?.slice(0, 80) ?? ''}…"</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* #1 AI Reel Generator APP — Showcase */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-[#D4AF37]/[0.04] blur-[150px] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left — Copy + Store Buttons */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">Available Now</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                #1 AI Reel Generator{' '}
                <span className="text-[#D4AF37]">APP</span>
              </h2>
              <p className="text-white/50 text-base md:text-lg leading-relaxed mb-4 max-w-lg mx-auto lg:mx-0">
                Create, discover, and share AI-generated reels anytime, anywhere. ManifestReelAI combines every tool you need — AI scripts, voiceovers, visuals, and auto-captions — into one seamless workspace, fully synced across web and mobile.
              </p>
              <p className="text-[#D4AF37]/80 font-semibold text-lg md:text-xl mb-8">
                Create a viral-ready reel within a minute!
              </p>

              {/* Store Buttons */}
              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3">
                {/* Google Play */}
                <a href="#" className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 hover:border-[#D4AF37]/30 hover:bg-white/[0.08] transition-all duration-300 w-[200px]">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="none">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92z" fill="#4285F4"/>
                    <path d="M17.556 8.236L5.178.738A1.002 1.002 0 003.609 1.814L13.792 12l3.764-3.764z" fill="#EA4335"/>
                    <path d="M3.609 22.186a1.002 1.002 0 001.569 1.076l12.378-7.498L13.792 12 3.609 22.186z" fill="#34A853"/>
                    <path d="M21.003 10.837l-3.447-2.601L13.792 12l3.764 3.764 3.447-2.601c.684-.397.684-1.929 0-2.326z" fill="#FBBC05"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[9px] text-white/40 uppercase tracking-wider leading-none">Get it on</div>
                    <div className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors">Google Play</div>
                  </div>
                </a>
                {/* App Store */}
                <a href="#" className="group flex items-center gap-3 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10 hover:border-[#D4AF37]/30 hover:bg-white/[0.08] transition-all duration-300 w-[200px]">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="white">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-[9px] text-white/40 uppercase tracking-wider leading-none">Download on the</div>
                    <div className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors">App Store</div>
                  </div>
                </a>
              </div>
            </motion.div>

            {/* Right — iPhone Mockup Showcase */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="shrink-0 w-full lg:flex-1">
              <div className="relative w-full max-w-[700px] mx-auto" style={{ aspectRatio: '1693 / 1834' }}>
                <Image
                  src="/showcase/iphone-mockup-dual.png"
                  alt="ManifestReel AI app shown on two iPhone 15 Pro devices — Craft Your Reel screen with mood picker, platform selection, and voice options on the left; Choose Voice screen with AI voice cards, speaking speed slider, and Generate Reel button on the right"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 700px"
                  priority
                />
              </div>
            </motion.div>
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