'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Film, DollarSign, TrendingUp, Loader2 } from 'lucide-react';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => setStats(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: '#D4AF37' },
    { label: 'Total Reels', value: stats?.totalReels ?? 0, icon: Film, color: '#7B2FBE' },
    { label: 'Total Cost', value: `$${(stats?.totalCost ?? 0).toFixed(2)}`, icon: DollarSign, color: '#D4AF37' },
    { label: 'Avg Cost/Reel', value: `$${(stats?.avgCostPerReel ?? 0).toFixed(2)}`, icon: TrendingUp, color: '#7B2FBE' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold">Dashboard Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c: any, i: number) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-4 h-4" style={{ color: c.color }} />
              <span className="text-xs text-white/40">{c.label}</span>
            </div>
            <p className="text-xl font-bold font-mono">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Reels by status */}
      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold mb-3">Reels by Status</h2>
        <div className="flex flex-wrap gap-3">
          {(stats?.reelsByStatus ?? []).map((r: any) => (
            <div key={r?.status ?? ''} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs text-white/40 capitalize">{r?.status ?? ''}</p>
              <p className="text-lg font-bold font-mono">{r?.count ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold mb-3">Subscriptions by Tier</h2>
        <div className="flex flex-wrap gap-3">
          {(stats?.reelsByTier ?? []).map((r: any) => (
            <div key={r?.tier ?? ''} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-xs text-white/40 capitalize">{r?.tier ?? ''}</p>
              <p className="text-lg font-bold font-mono">{r?.count ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
