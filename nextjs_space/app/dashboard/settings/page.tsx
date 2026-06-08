'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, User, CreditCard, Link2, Key, Crown, Loader2, AlertCircle, Zap, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { COIN_BUNDLES, PLANS, PLAN_ORDER, isFoundersPeriod, FOUNDERS_ANNUAL_PRICE, foundersCountdownDays, type PlanTier } from '@/lib/pricing';

export default function SettingsPage() {
  const { data: session } = useSession() || {};
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrading, setUpgrading] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [buyingCoins, setBuyingCoins] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [resending, setResending] = useState(false);
  const [showCancelTrial, setShowCancelTrial] = useState(false);
  // Founders flag computed client-side to avoid SSR/CSR hydration mismatch
  const [founders, setFounders] = useState(false);
  const [foundersDays, setFoundersDays] = useState(0);
  useEffect(() => { setFounders(isFoundersPeriod()); setFoundersDays(foundersCountdownDays()); }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/payments/subscription')
      .then(r => { if (!r.ok) throw new Error('Failed to load subscription'); return r.json(); })
      .then(d => setSubData(d))
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [session]);

  const handleUpgrade = async (tier: string) => {
    setUpgrading(tier);
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Upgrade failed'); return; }
      if (data?.url) window.location.href = data.url;
    } catch { toast.error('Upgrade failed. Please try again.'); }
    finally { setUpgrading(''); }
  };

  const handleStartTrial = async (targetTier: string) => {
    setUpgrading(targetTier);
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier, trial: true, billing: 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Could not start trial'); return; }
      if (data?.url) window.location.href = data.url;
    } catch { toast.error('Something went wrong. Please try again.'); }
    finally { setUpgrading(''); }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed to resend'); return; }
      if (data?.alreadyVerified) { toast.success('Your email is already verified.'); }
      else { toast.success('Verification email sent — check your inbox.'); }
    } catch { toast.error('Something went wrong. Please try again.'); }
    finally { setResending(false); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/payments/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed to open portal'); return; }
      if (data?.url) window.location.href = data.url;
    } catch { toast.error('Something went wrong.'); }
    finally { setPortalLoading(false); }
  };

  const handleBuyCoins = async (bundleId: string) => {
    setBuyingCoins(bundleId);
    try {
      const res = await fetch('/api/payments/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Purchase failed'); return; }
      if (data?.url) window.location.href = data.url;
    } catch { toast.error('Something went wrong.'); }
    finally { setBuyingCoins(''); }
  };

  const sub = subData?.subscription;
  const quota = subData?.quota;
  const currentTier = sub?.tier ?? 'free';
  const isPaid = PLAN_ORDER.includes(currentTier as PlanTier);

  return (
    <div className="space-y-6 max-w-2xl pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#D4AF37]" /> Settings
        </h1>
        <p className="text-sm text-white/40 mt-1">Manage your account, subscription, and credits.</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => window.location.reload()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><User className="w-4 h-4 text-[#D4AF37]" /> Account</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/50">Name</span>
            <span className="text-sm">{session?.user?.name ?? 'Not set'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/50">Email</span>
            <span className="text-sm">{session?.user?.email ?? ''}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-white/50">Role</span>
            <span className="text-sm capitalize">{(session?.user as any)?.role ?? 'user'}</span>
          </div>
        </div>

        {/* Email verification status */}
        {!loading && quota && quota.emailVerified === false && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-300">Verify your email to start your free trial</p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">You can explore everything now, but you'll need a verified email before generating reels.</p>
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="mt-2 text-xs text-[#D4AF37] hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              </div>
            </div>
          </div>
        )}
        {!loading && quota && quota.emailVerified === true && (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Email verified
          </div>
        )}
      </motion.div>

      {/* Subscription */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><CreditCard className="w-4 h-4 text-[#D4AF37]" /> Subscription</h2>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <p className="text-sm font-semibold capitalize">{currentTier === 'free' ? 'Free' : currentTier} Plan</p>
                <p className="text-xs text-white/40">
                  {quota?.isTrialing ? 'Trial' : sub?.status === 'active' ? 'Active' : sub?.status ?? 'Active'}
                  {sub?.cancelAtPeriodEnd ? ' • Cancels at period end' : ''}
                </p>
              </div>
            </div>

            {/* Trial status banner */}
            {quota?.isTrialing && quota?.trialEndsAt && (() => {
              const now = new Date();
              const end = new Date(quota.trialEndsAt);
              const diff = end.getTime() - now.getTime();
              const daysLeft = Math.max(0, Math.floor(diff / 86400000));
              const hoursLeft = Math.max(0, Math.floor((diff % 86400000) / 3600000));
              return (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-400">🎁 Free Trial</span>
                    <span className="text-xs text-emerald-400/70">{daysLeft}d {hoursLeft}h remaining</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>Trial reels</span>
                    <span>{quota?.trialReelsUsed ?? 0} of {quota?.trialReelLimit ?? 3} used</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, ((quota?.trialReelsUsed ?? 0) / (quota?.trialReelLimit ?? 3)) * 100)}%` }} />
                  </div>
                  <button
                    onClick={() => setShowCancelTrial(true)}
                    disabled={portalLoading}
                    className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                  >
                    {portalLoading ? 'Opening...' : 'Cancel trial'}
                  </button>
                </div>
              );
            })()}

            {quota && (
              <div className="p-3 rounded-lg bg-white/[0.02]">
                {currentTier === 'free' ? (
                  <div className="text-xs text-white/50">
                    <p>Free plan — explore all configurator features.</p>
                    <button onClick={() => handleStartTrial('pro')} className="mt-2 text-[#D4AF37] hover:underline">Start 3-day free trial →</button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>Coins available</span>
                      <span className="font-semibold text-[#D4AF37]">{quota?.coinsAvailable ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-white/35 mb-1">
                      <span>Monthly plan coins</span>
                      <span>{quota?.subscriptionRemaining ?? 0} / {quota?.subscriptionCoins ?? 0} left</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1">
                      <div className="h-full rounded-full gold-gradient" style={{ width: `${Math.min(100, ((quota?.subscriptionRemaining ?? 0) / Math.max(1, quota?.subscriptionCoins ?? 1)) * 100)}%` }} />
                    </div>
                    {/* Rollover coins */}
                    {(quota?.rolloverCoins ?? 0) > 0 && (
                      <div className="flex justify-between text-[10px] text-emerald-400/70 mt-1">
                        <span>🔄 {quota.rolloverCoins} rolling over</span>
                        <span>expires {new Date(quota.rolloverInfo?.[0]?.expiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {/* Bundle coins */}
                    {(quota?.bundleCoins ?? 0) > 0 && (
                      <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                        <span>+ {quota.bundleCoins} bundle coins</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Upgrade buttons */}
            {currentTier !== 'agency' && (
              <div className="space-y-3">
                {/* Billing toggle */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
                    <button onClick={() => setBilling('monthly')} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Monthly</button>
                    <button onClick={() => setBilling('annual')} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${billing === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                      Annual ✓ <span className="text-[10px] font-bold text-emerald-400">{founders ? '(Founders)' : '(Save 20%)'}</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PLAN_ORDER.filter(tier => {
                    const currentIdx = PLAN_ORDER.indexOf(currentTier as PlanTier);
                    const tierIdx = PLAN_ORDER.indexOf(tier);
                    return tierIdx > currentIdx;
                  }).map(tier => {
                    const plan = PLANS[tier];
                    const annualCents = (billing === 'annual' && founders) ? FOUNDERS_ANNUAL_PRICE[tier] : plan.annualPrice;
                    const monthlyDisplay = billing === 'annual'
                      ? (Math.round(annualCents / 12) / 100).toFixed(2)
                      : (plan.monthlyPrice / 100).toFixed(2);
                    const isGold = tier === 'starter' || tier === 'pro';
                    return (
                      <button
                        key={tier}
                        onClick={() => handleUpgrade(tier)}
                        disabled={!!upgrading}
                        className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition ${
                          isGold ? 'gold-gradient text-black hover:opacity-90' : 'bg-[#7B2FBE]/20 border border-[#7B2FBE]/30 text-[#A855F7] hover:bg-[#7B2FBE]/30'
                        }`}
                      >
                        {upgrading === tier ? <Loader2 className="w-4 h-4 animate-spin" /> : `${plan.name} — $${monthlyDisplay}/mo`}
                      </button>
                    );
                  })}
                </div>
                {billing === 'annual' && (
                  <p className="text-[11px] text-center text-white/40">
                    {founders
                      ? `🔥 Founders' annual pricing — renews at this rate. ${foundersDays} ${foundersDays === 1 ? 'day' : 'days'} left.`
                      : 'Billed annually'}
                  </p>
                )}
              </div>
            )}

            {/* Manage Subscription (Stripe Portal) */}
            {isPaid && sub?.stripeCustomerId && (
              <button onClick={handlePortal} disabled={portalLoading} className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage Subscription
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Extra Coin Bundles */}
      {isPaid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-[#D4AF37]" /> Buy Extra Coins</h2>
          <p className="text-xs text-white/40 mb-4">Top up with a one-time coin bundle. Bundle coins stack on your plan and never expire. Coin cost varies by model tier &amp; duration.</p>
          <div className="space-y-2">
            {COIN_BUNDLES.map(bundle => (
              <button
                key={bundle.id}
                onClick={() => handleBuyCoins(bundle.id)}
                disabled={!!buyingCoins}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-[#D4AF37]/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center">
                    <Zap className="w-4 h-4 text-black" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold flex items-center gap-2">{bundle.label}
                      {(bundle as any).popular && <span className="px-1.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] text-[9px] font-bold uppercase tracking-wide">Most Popular</span>}
                    </p>
                    <p className="text-[10px] text-white/40">{bundle.coins} coins • never expire</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#D4AF37]">${(bundle.price / 100).toFixed(2)}</span>
                  {buyingCoins === bundle.id && <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Connected accounts */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><Link2 className="w-4 h-4 text-[#D4AF37]" /> Connected Accounts</h2>
        <div className="space-y-3">
          {['TikTok', 'Instagram', 'YouTube'].map((p: string) => (
            <div key={p} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-white/60">{p}</span>
              <span className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/20">Coming Soon</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* API Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><Key className="w-4 h-4 text-[#D4AF37]" /> API Status</h2>
        <div className="space-y-2">
          {[
            { name: 'Script Generation', status: 'Mock (Demo)' },
            { name: 'Voice Synthesis', status: 'Mock (Demo)' },
            { name: 'Music Generation', status: 'Mock (Demo)' },
            { name: 'Video Rendering', status: 'Mock (Demo)' },
            { name: 'Payments', status: 'Stripe Connected' },
          ].map((api: any) => (
            <div key={api.name} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white/50">{api.name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                api.status === 'Stripe Connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>{api.status}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cancel-trial confirmation modal */}
      {showCancelTrial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelTrial(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#15131c] border border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold">Cancel your trial?</h3>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              You'll lose access to Pro features when your trial ends, but any reels you've already generated stay yours
              and remain viewable forever. Continue?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowCancelTrial(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 transition"
              >
                Keep my trial
              </button>
              <button
                onClick={() => { setShowCancelTrial(false); handlePortal(); }}
                disabled={portalLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-500/90 hover:bg-red-500 text-white transition disabled:opacity-50"
              >
                {portalLoading ? 'Opening...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}