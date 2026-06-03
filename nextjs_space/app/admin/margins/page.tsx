'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const MarginsChart = dynamic(() => import('./_components/margins-chart'), { ssr: false, loading: () => <div className="h-64 flex items-center justify-center"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div> });

export default function AdminMarginsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/margins')
      .then(r => { if (!r.ok) throw new Error('Failed to load margin data'); return r.json(); })
      .then(d => setData(d))
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-10 h-10 text-red-400/50" />
      <p className="text-white/40 text-sm">{error}</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white/50 hover:bg-white/10">Retry</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#D4AF37]" /> Revenue & Margins</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
          <p className="text-xs text-white/40 mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">${(data?.monthlyRevenue ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
          <p className="text-xs text-white/40 mb-1">Total Costs</p>
          <p className="text-2xl font-bold font-mono text-red-400">${(data?.totalCost ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
          <p className="text-xs text-white/40 mb-1">Blended Margin</p>
          <p className="text-2xl font-bold font-mono text-[#D4AF37]">{data?.margin ?? 0}%</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold mb-4">Revenue vs Cost</h2>
        <div className="h-64">
          <MarginsChart chartData={data?.chartData ?? []} />
        </div>
      </div>
    </div>
  );
}
