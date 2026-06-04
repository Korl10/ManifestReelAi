'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, User, CreditCard, Link2, Key, Crown, Loader2, AlertCircle, Zap, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { COIN_BUNDLES } from '@/lib/pricing';

export default function SettingsPage() {
  const { data: session } = useSession() || {};
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrading, setUpgrading] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [buyingCoins, setBuyingCoins] = useState('');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

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
  const isPaid = currentTier === 'pro' || currentTier === 'premium';

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
                <p className="text-xs text-white/40">{sub?.status === 'active' ? 'Active' : sub?.status ?? 'Active'}{sub?.cancelAtPeriodEnd ? ' • Cancels at period end' : ''}</p>
              </div>
            </div>
            {quota && (
              <div className="p-3 rounded-lg bg-white/[0.02]">
                {currentTier === 'free' ? (
                  <div className="flex justify-between text-xs text-white/50">
                    <span>Free preview</span>
                    <span>{quota?.reelsUsed ?? 0} / 1 used</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>Coins available</span>
                      <span className="font-semibold text-[#D4AF37]">{quota?.coinsAvailable ?? 0}{(quota?.bundleCoins ?? 0) > 0 ? ` (incl. ${quota.bundleCoins} bundle)` : ''}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-white/35 mb-1">
                      <span>Monthly plan coins</span>
                      <span>{quota?.subscriptionRemaining ?? 0} / {quota?.subscriptionCoins ?? 0} left</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full gold-gradient" style={{ width: `${Math.min(100, ((quota?.subscriptionRemaining ?? 0) / Math.max(1, quota?.subscriptionCoins ?? 1)) * 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Upgrade buttons */}
            {currentTier !== 'premium' && (
              <div className="space-y-3">
                {/* Billing toggle */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
                    <button onClick={() => setBilling('monthly')} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${billing === 'monthly' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Monthly</button>
                    <button onClick={() => setBilling('annual')} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${billing === 'annual' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
                      Annually <span className="text-[10px] font-bold text-[#D4AF37]">50% OFF</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {currentTier === 'free' && (
                    <button onClick={() => handleUpgrade('pro')} disabled={!!upgrading} className="flex-1 py-2.5 rounded-lg gold-gradient text-black font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                      {upgrading === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pro — $${billing === 'annual' ? '9.99' : '19.99'}/mo`}
                    </button>
                  )}
                  <button onClick={() => handleUpgrade('premium')} disabled={!!upgrading} className="flex-1 py-2.5 rounded-lg bg-[#7B2FBE]/20 border border-[#7B2FBE]/30 text-[#A855F7] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#7B2FBE]/30 disabled:opacity-50">
                    {upgrading === 'premium' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Premium — $${billing === 'annual' ? '24.99' : '49.99'}/mo`}
                  </button>
                </div>
                {billing === 'annual' && (
                  <p className="text-[11px] text-center text-white/40">Billed annually — save 50% vs monthly</p>
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
          <p className="text-xs text-white/40 mb-4">Top up with a one-time coin bundle. Bundle coins stack on your plan and stay valid for 12 months. Static reel = 1 coin, motion reel = 5 coins.</p>
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
                    <p className="text-[10px] text-white/40">{bundle.coins} coins • valid 12 months</p>
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
    </div>
  );
}
