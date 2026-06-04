'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Crown, Zap, Check, Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { COIN_BUNDLES } from '@/lib/pricing';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  tier: string;
  reelsUsed: number;
  reelsCap: number;
}

function trackEvent(event: string, metadata?: Record<string, any>) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, metadata }),
  }).catch(() => {});
}

export function PaywallModal({ open, onClose, tier, reelsUsed, reelsCap }: PaywallModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  useEffect(() => {
    if (open) {
      trackEvent('paywall_shown', { tier, reelsUsed, reelsCap });
      setShowDiscount(false);
      setDismissed(false);
    }
  }, [open, tier, reelsUsed, reelsCap]);

  const handleDismiss = useCallback(() => {
    if (!dismissed) {
      // First dismiss → show discount offer
      trackEvent('paywall_dismissed', { tier });
      setDismissed(true);
      setShowDiscount(true);
      return;
    }
    // Second dismiss → actually close
    onClose();
  }, [dismissed, onClose, tier]);

  const handleUpgrade = async (targetTier: string, useIntro = false) => {
    setLoading(`upgrade-${targetTier}${useIntro ? '-intro' : ''}`);
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier, useIntro, billing: useIntro ? 'monthly' : billing }),
      });
      const data = await res.json();
      if (data?.url) {
        trackEvent('paywall_converted', { tier: targetTier, useIntro });
        window.location.href = data.url;
      } else {
        toast.error(data?.error ?? 'Failed to start checkout');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleBuyCoins = async (bundleId: string) => {
    setLoading(`coins-${bundleId}`);
    try {
      const res = await fetch('/api/payments/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId }),
      });
      const data = await res.json();
      if (data?.url) {
        trackEvent('paywall_converted', { type: 'coin_purchase', bundleId });
        window.location.href = data.url;
      } else {
        toast.error(data?.error ?? 'Failed to start checkout');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  if (!open) return null;

  const isPaid = tier === 'pro' || tier === 'premium';
  const isProOnly = tier === 'pro';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md rounded-2xl bg-[#111] border border-white/10 overflow-hidden"
        >
          {/* Header gradient */}
          <div className="relative bg-gradient-to-br from-[#D4AF37]/20 via-[#7B2FBE]/15 to-transparent p-6 pb-4">
            <button onClick={handleDismiss} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition">
              <X className="w-5 h-5 text-white/50" />
            </button>
            <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center mb-3">
              {isPaid ? <Zap className="w-6 h-6 text-black" /> : <Crown className="w-6 h-6 text-black" />}
            </div>
            <h2 className="font-display text-xl font-bold">
              {isPaid ? 'Need More Reels?' : 'Unlock Unlimited Power'}
            </h2>
            <p className="text-sm text-white/50 mt-1">
              {isPaid
                ? `You've used all ${reelsCap} reels. Top up with extra coins or upgrade.`
                : 'Upgrade now to unlock the full power of ManifestReel.'}
            </p>
          </div>

          <div className="p-6 pt-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-none">
            {/* ── DISCOUNT OFFER (shown on first dismiss) ── */}
            <AnimatePresence>
              {showDiscount && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#D4AF37]/10 to-[#7B2FBE]/10 border border-[#D4AF37]/30 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-4 h-4 text-[#D4AF37]" />
                      <span className="text-sm font-bold text-[#D4AF37]">Special One-Time Offer!</span>
                    </div>
                    <p className="text-xs text-white/60 mb-3">We don't want you to miss out. Here's an exclusive deal:</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleUpgrade('pro', true)}
                        disabled={!!loading}
                        className="w-full py-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/25 transition flex items-center justify-center gap-2"
                      >
                        {loading === 'upgrade-pro-intro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Pro — $9.99/mo for 3 months <span className="text-[10px] text-white/40">(then $19.99)</span>
                      </button>
                      <button
                        onClick={() => handleUpgrade('premium', true)}
                        disabled={!!loading}
                        className="w-full py-2.5 rounded-xl bg-[#7B2FBE]/15 border border-[#7B2FBE]/40 text-sm font-semibold text-[#A855F7] hover:bg-[#7B2FBE]/25 transition flex items-center justify-center gap-2"
                      >
                        {loading === 'upgrade-premium-intro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                        Premium — $25/mo for 3 months <span className="text-[10px] text-white/40">(then $49.99)</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── UPGRADE OPTIONS ── */}
            {(!isPaid || isProOnly) && !showDiscount && (
              <div className="space-y-3">
                {/* Billing toggle */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
                    <button
                      onClick={() => setBilling('monthly')}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBilling('annual')}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${billing === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                    >
                      Annually
                      <span className="text-[10px] font-bold text-[#D4AF37]">50% OFF</span>
                    </button>
                  </div>
                </div>
                {/* Pro card */}
                {!isPaid && (
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={!!loading}
                    className="w-full text-left p-4 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                        <span className="font-bold text-[#D4AF37]">Pro</span>
                      </div>
                      <span className="text-sm font-bold text-white flex items-baseline gap-1">
                        {billing === 'annual' && <span className="text-xs font-normal text-white/30 line-through">$19.99</span>}
                        ${billing === 'annual' ? '9.99' : '19.99'}<span className="text-white/40 font-normal">/mo</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {['30 reels per month', 'All styles & voices', 'HD export', 'Priority generation'].map(f => (
                        <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                          <Check className="w-3 h-3 text-[#D4AF37]" />{f}
                        </div>
                      ))}
                    </div>
                    {loading === 'upgrade-pro' && <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin mt-2" />}
                  </button>
                )}

                {/* Premium card */}
                <button
                  onClick={() => handleUpgrade('premium')}
                  disabled={!!loading}
                  className="w-full text-left p-4 rounded-xl border border-[#7B2FBE]/30 bg-[#7B2FBE]/5 hover:bg-[#7B2FBE]/10 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#A855F7]" />
                      <span className="font-bold text-[#A855F7]">Premium</span>
                      {isPaid && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7B2FBE]/20 text-[#A855F7]">UPGRADE</span>}
                    </div>
                    <span className="text-sm font-bold text-white flex items-baseline gap-1">
                      {billing === 'annual' && <span className="text-xs font-normal text-white/30 line-through">$49.99</span>}
                      ${billing === 'annual' ? '24.99' : '49.99'}<span className="text-white/40 font-normal">/mo</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    {['60 reels per month', 'Priority rendering', '4K export + no watermark', 'Custom branding'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                        <Check className="w-3 h-3 text-[#A855F7]" />{f}
                      </div>
                    ))}
                  </div>
                  {loading === 'upgrade-premium' && <Loader2 className="w-4 h-4 text-[#A855F7] animate-spin mt-2" />}
                </button>
              </div>
            )}

            {/* ── COIN BUNDLES (for paid users who ran out) ── */}
            {isPaid && (
              <div className="space-y-3">
                <p className="text-xs text-white/40 font-medium">Or buy extra coins:</p>
                {COIN_BUNDLES.map(bundle => (
                  <button
                    key={bundle.id}
                    onClick={() => handleBuyCoins(bundle.id)}
                    disabled={!!loading}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center">
                        <Zap className="w-4 h-4 text-black" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold">{bundle.label}</p>
                        <p className="text-[10px] text-white/40">{bundle.reels} extra reel credits</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#D4AF37]">${(bundle.price / 100).toFixed(0)}</span>
                      {loading === `coins-${bundle.id}` && <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
