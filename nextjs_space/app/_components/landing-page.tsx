'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand2, Music, Video, Type, Zap, Crown, Star, ArrowRight, Check, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const FEATURES = [
  { icon: Type, title: 'AI Script Writing', desc: 'Powerful manifestation scripts crafted by AI, optimized for engagement and spiritual impact.', color: '#D4AF37' },
  { icon: Music, title: 'Voice & Music', desc: 'Soothing voiceovers paired with 528Hz frequency music and ambient soundscapes.', color: '#7B2FBE' },
  { icon: Video, title: 'Cinematic Visuals', desc: 'Stock visuals and AI-generated backgrounds matched to your manifestation theme.', color: '#D4AF37' },
  { icon: Sparkles, title: 'Auto Captions', desc: 'Perfectly synced karaoke-style captions that boost engagement and accessibility.', color: '#7B2FBE' },
];

const TIERS = [
  { name: 'Free', price: '$0', period: 'forever', features: ['1 reel total', 'All styles & moods', 'Watermarked exports', 'Basic script generation'], cta: 'Get Started', tier: 'free', popular: false },
  { name: 'Pro', price: '$19.99', period: '/month', features: ['30 reels/month', 'No watermark', 'HD exports', 'All voice presets', 'Priority generation', 'Caption editing'], cta: 'Upgrade to Pro', tier: 'pro', popular: true },
  { name: 'Premium', price: '$49.99', period: '/month', features: ['60 reels/month', 'Everything in Pro', '4K exports', 'AI video backgrounds', 'Custom branding', 'Priority support', 'Schedule & auto-post'], cta: 'Go Premium', tier: 'premium', popular: false },
];

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Manifestation Coach', text: 'ManifestReel completely transformed my content game. I went from struggling to post to having a week of reels done in 20 minutes.', stars: 5 },
  { name: 'David K.', role: 'Spiritual Creator', text: 'The quality of the scripts is incredible. My followers think I hired a professional team. The 528Hz music tracks are chef\'s kiss.', stars: 5 },
  { name: 'Luna R.', role: 'LOA Influencer', text: 'I\'ve tried every reel tool out there. This is the only one that actually understands the manifestation niche. Game changer.', stars: 5 },
];

export function LandingPage() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [mobileMenu, setMobileMenu] = useState(false);

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
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data?.url) {
        router.push(data.url);
        toast.success(`Upgraded to ${tier}!`);
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
          </motion.div>

          {/* Mock reel preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 max-w-sm mx-auto"
          >
            <div className="relative aspect-[9/16] max-h-[420px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#7B2FBE]/30 to-[#4A1A8A]/30 border border-white/10 gold-glow">
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-float">
                  <Sparkles className="w-12 h-12 text-[#D4AF37] mb-4 mx-auto" />
                </div>
                <p className="text-lg font-display font-bold mb-2">"Money flows to me easily"</p>
                <p className="text-sm text-white/50">Wealth Manifestation • 30s Reel</p>
                <div className="mt-6 flex gap-2">
                  {['TikTok', 'Reels', 'Shorts'].map((p: string) => (
                    <span key={p} className="px-3 py-1 rounded-full bg-white/10 text-xs text-white/60">{p}</span>
                  ))}
                </div>
              </div>
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
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, Transparent Pricing</h2>
            <p className="text-white/50 max-w-xl mx-auto">Start free. Upgrade when you're ready to scale your manifestation content.</p>
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
                  <h3 className="font-display text-lg font-semibold mb-1">{t?.name ?? ''}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[#D4AF37]">{t?.price ?? ''}</span>
                    <span className="text-sm text-white/40">{t?.period ?? ''}</span>
                  </div>
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
            <p className="text-white/50">See what manifestation creators are saying.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t: any, i: number) => (
              <motion.div
                key={t?.name ?? i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t?.stars ?? 5 }).map((_: any, j: number) => (
                    <Star key={j} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
                  ))}
                </div>
                <p className="text-sm text-white/70 mb-4 leading-relaxed">"{t?.text ?? ''}"</p>
                <div>
                  <p className="text-sm font-semibold">{t?.name ?? ''}</p>
                  <p className="text-xs text-white/40">{t?.role ?? ''}</p>
                </div>
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
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-sm text-white/40">ManifestReel AI</span>
          </div>
          <div className="flex gap-6 text-sm text-white/40">
            <a href="#features" className="hover:text-white/70 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white/70 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white/70 transition-colors">Reviews</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
