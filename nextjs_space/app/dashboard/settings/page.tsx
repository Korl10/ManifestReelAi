'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, User, CreditCard, Link2, Key, Crown, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { data: session } = useSession() || {};
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrading, setUpgrading] = useState('');

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
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Upgrade failed');
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch { toast.error('Upgrade failed. Please try again.'); }
    finally { setUpgrading(''); }
  };

  const sub = subData?.subscription;
  const quota = subData?.quota;
  const currentTier = sub?.tier ?? 'free';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#D4AF37]" /> Settings
        </h1>
        <p className="text-sm text-white/40 mt-1">Manage your account and subscription.</p>
      </div>

      {/* Error state */}
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
                <p className="text-sm font-semibold capitalize">{currentTier} Plan</p>
                <p className="text-xs text-white/40">{sub?.status === 'active' ? 'Active' : sub?.status ?? 'Active'}</p>
              </div>
            </div>
            {quota && (
              <div className="p-3 rounded-lg bg-white/[0.02]">
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>Reels used</span>
                  <span>{quota?.reelsUsed ?? 0} / {quota?.reelsCap ?? 0}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full gold-gradient" style={{ width: `${Math.min(100, ((quota?.reelsUsed ?? 0) / Math.max(1, quota?.reelsCap ?? 1)) * 100)}%` }} />
                </div>
                {quota?.tier === 'free' && (quota?.reelsUsed ?? 0) >= 1 && (
                  <p className="text-xs text-[#D4AF37]/70 mt-2">You&apos;ve used your free reel. Upgrade to continue creating!</p>
                )}
              </div>
            )}
            {currentTier !== 'premium' && (
              <div className="flex gap-2">
                {currentTier === 'free' && (
                  <button onClick={() => handleUpgrade('pro')} disabled={!!upgrading} className="flex-1 py-2.5 rounded-lg gold-gradient text-black font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                    {upgrading === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upgrade to Pro — $19.99/mo'}
                  </button>
                )}
                <button onClick={() => handleUpgrade('premium')} disabled={!!upgrading} className="flex-1 py-2.5 rounded-lg bg-[#7B2FBE]/20 border border-[#7B2FBE]/30 text-[#A855F7] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#7B2FBE]/30 disabled:opacity-50">
                  {upgrading === 'premium' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Premium — $49.99/mo'}
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

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
        <p className="text-xs text-white/20 mt-3">Social account connections will be available in a future update.</p>
      </motion.div>

      {/* API Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><Key className="w-4 h-4 text-[#D4AF37]" /> API Status</h2>
        <div className="space-y-2">
          {[{ name: 'Script Generation', status: 'Mock (Demo)' }, { name: 'Voice Synthesis', status: 'Mock (Demo)' }, { name: 'Music Generation', status: 'Mock (Demo)' }, { name: 'Video Rendering', status: 'Mock (Demo)' }, { name: 'Payments', status: 'Mock (Demo)' }].map((api: any) => (
            <div key={api.name} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white/50">{api.name}</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium">{api.status}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
