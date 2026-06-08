'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Crown, Zap, Check, Loader2, Gift, Play, Clock, Star } from 'lucide-react';
import { toast } from 'sonner';
import { COIN_BUNDLES, PLANS, PLAN_ORDER, isFoundersPeriod, FOUNDERS_ANNUAL_PRICE, type PlanTier } from '@/lib/pricing';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  tier: string;
  reelsUsed: number;
  reelsCap: number;
  trialUsed?: boolean;
}

function trackEvent(event: string, metadata?: Record<string, any>) {
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, metadata }),
  }).catch(() => {});
}

export function PaywallModal({ open, onClose, tier, reelsUsed, reelsCap, trialUsed }: PaywallModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [founders, setFounders] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  useEffect(() => { setFounders(isFoundersPeriod()); }, []);

  useEffect(() => {
    if (open) {
      trackEvent('paywall_shown', { tier, reelsUsed, reelsCap });
      setShowDiscount(false);
      setDismissed(false);
      setShowAllPlans(false);
    }
  }, [open, tier, reelsUsed, reelsCap]);

  const handleDismiss = useCallback(() => {
    if (!dismissed && isPaid) {
      trackEvent('paywall_dismissed', { tier });
      setDismissed(true);
      setShowDiscount(true);
      return;
    }
    onClose();
  }, [dismissed, onClose, tier]);

  const handleStartTrial = async (targetTier: string) => {
    setLoading(`trial-${targetTier}`);
    try {
      // Save reel config to localStorage so it persists through Stripe checkout redirect
      try {
        const saved = localStorage.getItem('manifestreel_draft_config');
        if (saved) { /* already saved by dashboard */ }
      } catch { /* ignore */ }
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier, trial: true, billing: 'monthly' }),
      });
      const data = await res.json();
      if (data?.url) {
        trackEvent('paywall_trial_started', { tier: targetTier });
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

  const isPaid = PLAN_ORDER.includes(tier as PlanTier);
  const isFree = !isPaid;
  const isTopTier = tier === 'agency';
  const canTrial = isFree && !trialUsed;
  // Tiers available to upgrade to (higher than current)
  const upgradeTiers = PLAN_ORDER.filter(t => {
    const currentIdx = PLAN_ORDER.indexOf(tier as PlanTier);
    return PLAN_ORDER.indexOf(t) > currentIdx;
  });

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
              {isFree ? <Play className="w-6 h-6 text-black" /> : (isPaid ? <Zap className="w-6 h-6 text-black" /> : <Crown className="w-6 h-6 text-black" />)}
            </div>
            <h2 className="font-display text-xl font-bold">
              {isFree
                ? '\ud83c\udfac Ready to bring this reel to life?'
                : 'Need More Reels?'}
            </h2>
            <p className="text-sm text-white/50 mt-1">
              {isFree
                ? 'Your reel configuration is saved. Start a free trial to generate it.'
                : `You're out of coins. Top up a bundle or upgrade your plan.`}
            </p>
          </div>

          <div className="p-6 pt-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-none">
            {/* ── FREE USER: TRIAL-FOCUSED VIEW ── */}
            {isFree && !showAllPlans && (
              <>
                {canTrial ? (
                  <>
                    {/* Trial benefits */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-[#D4AF37]/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Gift className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">\ud83c\udf81 3-day free trial</span>
                      </div>
                      <ul className="space-y-2">
                        {[
                          'Generate up to 3 reels',
                          'Full access to all features of your chosen plan',
                          'No watermark, 1080p exports',
                          'Cancel anytime \u2014 no charge if cancelled in trial',
                        ].map(f => (
                          <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Quick trial CTA — default to Starter */}
                    <button
                      onClick={() => handleStartTrial('starter')}
                      disabled={!!loading}
                      className="w-full py-3.5 rounded-xl gold-gradient text-black font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 gold-glow"
                    >
                      {loading === 'trial-starter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Start Free Trial
                    </button>

                    <button
                      onClick={() => setShowAllPlans(true)}
                      className="w-full text-center text-xs text-white/40 hover:text-white/60 transition py-1"
                    >
                      See all plans \u2192
                    </button>
                  </>
                ) : (
                  /* Trial already used — show subscription plans */
                  <>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 text-center">
                      <p className="text-sm text-white/60">Your free trial has been used. Subscribe to keep creating.</p>
                    </div>
                    {renderUpgradeTiers()}
                  </>
                )}
              </>
            )}

            {/* ── ALL PLANS VIEW (from "See all plans" or paid user) ── */}
            {(showAllPlans || isPaid) && (
              <>
                {showAllPlans && isFree && (
                  <button onClick={() => setShowAllPlans(false)} className="text-xs text-white/40 hover:text-white/60 transition mb-2">
                    \u2190 Back to trial
                  </button>
                )}
                {renderUpgradeTiers()}
              </>
            )}

            {/* ── DISCOUNT OFFER (shown on first dismiss for paid users) ── */}
            <AnimatePresence>
              {showDiscount && isPaid && (
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
                    <p className="text-xs text-white/60 mb-3">We don\u2019t want you to miss out. Here\u2019s an exclusive deal:</p>
                    <div className="space-y-2">
                      {upgradeTiers.slice(0, 2).map(t => {
                        const plan = PLANS[t];
                        const introMo = (plan.introMonthlyPrice / 100).toFixed(0);
                        const fullMo = (plan.monthlyPrice / 100).toFixed(2);
                        const isGold = t === 'starter' || t === 'pro';
                        return (
                          <button
                            key={t}
                            onClick={() => handleUpgrade(t, true)}
                            disabled={!!loading}
                            className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 ${
                              isGold
                                ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25'
                                : 'bg-[#7B2FBE]/15 border-[#7B2FBE]/40 text-[#A855F7] hover:bg-[#7B2FBE]/25'
                            }`}
                          >
                            {loading === `upgrade-${t}-intro` ? <Loader2 className="w-4 h-4 animate-spin" /> : (isGold ? <Sparkles className="w-4 h-4" /> : <Crown className="w-4 h-4" />)}
                            {plan.name} \u2014 ${introMo}/mo for {plan.introDurationMonths}mo <span className="text-[10px] text-white/40">(then ${fullMo})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                        <p className="text-sm font-semibold flex items-center gap-1.5">{bundle.label}{(bundle as any).popular && <span className="px-1.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] text-[9px] font-bold uppercase">Popular</span>}</p>
                        <p className="text-[10px] text-white/40">{bundle.coins} coins \u2022 never expire</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#D4AF37]">${(bundle.price / 100).toFixed(2)}</span>
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

  // ── Helper: render upgrade tier cards ──
  function renderUpgradeTiers() {
    const tiers = isFree ? PLAN_ORDER.filter(t => t !== 'agency') : upgradeTiers;
    if (tiers.length === 0) return null;
    return (
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
              <span className="text-[10px] font-bold text-emerald-400">{founders ? '\ud83d\udd25 Founders' : '(Save 20%)'}</span>
            </button>
          </div>
        </div>
        {tiers.slice(0, 3).map(t => {
          const plan = PLANS[t];
          const monthly = (plan.monthlyPrice / 100).toFixed(2);
          const annualCents = founders ? FOUNDERS_ANNUAL_PRICE[t] : plan.annualPrice;
          const annualMo = (Math.round(annualCents / 12) / 100).toFixed(2);
          const isGold = t === 'starter' || t === 'pro';
          const accent = isGold ? '#D4AF37' : '#A855F7';
          const Icon = isGold ? Sparkles : Crown;
          return (
            <button
              key={t}
              onClick={() => canTrial ? handleStartTrial(t) : handleUpgrade(t)}
              disabled={!!loading}
              className={`w-full text-left p-4 rounded-xl border transition ${
                isGold ? 'border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10' : 'border-[#7B2FBE]/30 bg-[#7B2FBE]/5 hover:bg-[#7B2FBE]/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                  <span className="font-bold" style={{ color: accent }}>{plan.name}</span>
                  {canTrial && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">3-day trial</span>}
                  {isPaid && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">UPGRADE</span>}
                </div>
                <span className="text-sm font-bold text-white flex items-baseline gap-1">
                  ${billing === 'annual' ? annualMo : monthly}<span className="text-white/40 font-normal">/mo</span>
                </span>
              </div>
              <div className="space-y-1">
                {[`${plan.coins} coins / month`, ...plan.features.slice(0, 3)].map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <Check className="w-3 h-3" style={{ color: accent }} />{f}
                  </div>
                ))}
              </div>
              {(loading === `upgrade-${t}` || loading === `trial-${t}`) && <Loader2 className="w-4 h-4 animate-spin mt-2" style={{ color: accent }} />}
            </button>
          );
        })}
      </div>
    );
  }
}
