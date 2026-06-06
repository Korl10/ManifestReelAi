'use client';
import React, { useState, useEffect, Fragment } from 'react';
import {
  Loader2, TrendingUp, AlertCircle, DollarSign, BarChart3,
  ChevronDown, ChevronRight, Users, Layers, Activity, Music, Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const DailyTrendChart = dynamic(
  () => import('./_components/margins-chart').then(m => m.DailyTrendChart),
  { ssr: false, loading: () => <ChartLoader /> },
);
const CategoryPieChart = dynamic(
  () => import('./_components/margins-chart').then(m => m.CategoryPieChart),
  { ssr: false, loading: () => <ChartLoader /> },
);

function ChartLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
    </div>
  );
}

/* ── helpers ── */
function fmt$(v: number, decimals = 2) {
  return `$${v.toFixed(decimals)}`;
}
function fmtPct(v: number) {
  return `${v}%`;
}
function statusBadge(s: string) {
  const map: Record<string, string> = {
    ready: 'bg-emerald-500/15 text-emerald-400',
    processing: 'bg-amber-500/15 text-amber-400',
    failed: 'bg-red-500/15 text-red-400',
    queued: 'bg-blue-500/15 text-blue-400',
  };
  return map[s] ?? 'bg-white/5 text-white/40';
}

export default function AdminMarginsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedReel, setExpandedReel] = useState<string | null>(null);
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    fetch('/api/admin/margins')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(d => setData(d))
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400/50" />
        <p className="text-white/40 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white/50 hover:bg-white/10 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    monthlyRevenue = 0, totalCost = 0, totalReels = 0,
    completedReels = 0, avgCostPerReel = 0, margin = 0,
    costByCategory = {}, dailyData = [], weeklyData = [], reelDetails = [],
    musicCoverage = null,
  } = data ?? {};

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
        Cost & Margin Dashboard
      </h1>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Monthly Revenue"
          value={fmt$(monthlyRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
          color="text-emerald-400"
        />
        <KpiCard
          label="Total Cost"
          value={fmt$(totalCost, 4)}
          icon={<BarChart3 className="w-4 h-4" />}
          color="text-red-400"
        />
        <KpiCard
          label="Blended Margin"
          value={fmtPct(margin)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-[#D4AF37]"
        />
        <KpiCard
          label="Avg Cost / Reel"
          value={fmt$(avgCostPerReel, 4)}
          icon={<Activity className="w-4 h-4" />}
          color="text-purple-400"
        />
        <KpiCard
          label="Reels (done / total)"
          value={`${completedReels} / ${totalReels}`}
          icon={<Layers className="w-4 h-4" />}
          color="text-blue-400"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Trend */}
        <div className="lg:col-span-2 rounded-xl bg-white/[0.02] border border-white/5 p-5">
          <h2 className="text-sm font-semibold mb-3 text-white/70">Daily Trend (30 days)</h2>
          <div className="h-64">
            <DailyTrendChart data={dailyData} />
          </div>
        </div>
        {/* Category Breakdown Pie */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
          <h2 className="text-sm font-semibold mb-3 text-white/70">Cost by Category</h2>
          <div className="h-64">
            <CategoryPieChart data={costByCategory} />
          </div>
          {/* Legend table */}
          <div className="mt-3 space-y-1">
            {Object.entries(costByCategory as Record<string, number>)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, val]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-white/50">{cat}</span>
                  <span className="font-mono text-white/70">{fmt$(val, 4)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Music Library Coverage ── */}
      {musicCoverage && (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <Music className="w-4 h-4 text-[#A855F7]" />
              Music Library Coverage
            </h2>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[#A855F7]" /> {musicCoverage.stingers} stingers</span>
              <span className="font-mono">{musicCoverage.total} tracks total</span>
            </div>
          </div>
          {musicCoverage.moods?.some((m: any) => m.low) && (
            <div className="mb-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Some moods have fewer than 3 tracks — add more in the next batch to improve match variety.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {musicCoverage.moods?.map((m: any) => (
              <div
                key={m.mood}
                className={`rounded-lg border px-3 py-2.5 ${
                  m.low
                    ? 'bg-amber-400/10 border-amber-400/30'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-white/40 capitalize">{m.mood}</p>
                <p className={`text-lg font-bold font-mono ${m.low ? 'text-amber-300' : 'text-white'}`}>
                  {m.count}
                  {m.low && <span className="ml-1 text-[10px] font-normal align-middle">low</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabbed Time Summaries ── */}
      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setTab('daily')}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
              tab === 'daily' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setTab('weekly')}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
              tab === 'weekly' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            Weekly
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 border-b border-white/5">
                <th className="text-left py-2 pr-4 font-medium">{tab === 'daily' ? 'Date' : 'Week'}</th>
                <th className="text-right py-2 px-3 font-medium">Reels</th>
                <th className="text-right py-2 px-3 font-medium">Cost</th>
                <th className="text-right py-2 px-3 font-medium">Retail</th>
                <th className="text-right py-2 pl-3 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'daily' ? dailyData : weeklyData).map((row: any, i: number) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                  <td className="py-2 pr-4 text-white/60 font-mono">
                    {tab === 'daily' ? row.day : row.week}
                  </td>
                  <td className="py-2 px-3 text-right text-white/70">{row.count}</td>
                  <td className="py-2 px-3 text-right text-red-400 font-mono">{fmt$(row.cost, 4)}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-mono">{fmt$(row.retail)}</td>
                  <td className="py-2 pl-3 text-right font-mono">
                    <span className={row.margin >= 50 ? 'text-emerald-400' : row.margin >= 0 ? 'text-amber-400' : 'text-red-400'}>
                      {fmtPct(row.margin)}
                    </span>
                  </td>
                </tr>
              ))}
              {(tab === 'daily' ? dailyData : weeklyData).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-white/25">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Per-Reel Detail Table ── */}
      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-semibold mb-4 text-white/70 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#D4AF37]" />
          Per-Reel Detail (latest 100)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40 border-b border-white/5">
                <th className="w-6"></th>
                <th className="text-left py-2 pr-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">User</th>
                <th className="text-left py-2 px-2 font-medium">Type</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Cost</th>
                <th className="text-right py-2 px-2 font-medium">Retail</th>
                <th className="text-right py-2 pl-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {reelDetails.map((r: any) => (
                <Fragment key={r.id}>
                  <tr
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition cursor-pointer"
                    onClick={() => setExpandedReel(expandedReel === r.id ? null : r.id)}
                  >
                    <td className="py-2 text-white/30">
                      {expandedReel === r.id
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />}
                    </td>
                    <td className="py-2 pr-2 text-white/50 font-mono">
                      {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2 px-2 text-white/60 truncate max-w-[140px]">{r.user}</td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.type === 'motion' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-red-400 font-mono">{fmt$(r.cost, 4)}</td>
                    <td className="py-2 px-2 text-right text-emerald-400 font-mono">{fmt$(r.retail)}</td>
                    <td className="py-2 pl-2 text-right font-mono">
                      <span className={r.margin >= 50 ? 'text-emerald-400' : r.margin >= 0 ? 'text-amber-400' : 'text-red-400'}>
                        {fmtPct(r.margin)}
                      </span>
                    </td>
                  </tr>
                  {expandedReel === r.id && (
                    <tr className="bg-white/[0.01]">
                      <td></td>
                      <td colSpan={7} className="py-3 px-2">
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                          {Object.entries(r.breakdown as Record<string, number>).map(([k, v]) => (
                            <div key={k} className="text-center">
                              <p className="text-[10px] text-white/30 capitalize">{k}</p>
                              <p className="text-xs font-mono text-white/60">{fmt$(v, 4)}</p>
                            </div>
                          ))}
                        </div>
                        {r.style && (
                          <p className="mt-2 text-[10px] text-white/30">
                            Style: <span className="text-white/50">{r.style}</span>
                            {r.mood && <> · Mood: <span className="text-white/50">{r.mood}</span></>}
                          </p>
                        )}
                        {(r.modelTier || r.musicTrackId || r.voiceTier) && (
                          <p className="mt-1 text-[10px] text-white/30">
                            {r.modelTier && <>Model: <span className="text-white/50 capitalize">{r.modelTier}</span></>}
                            {r.voiceTier && <> · Voice: <span className="text-white/50">{r.voiceTier}</span></>}
                            {r.musicTrackId && <> · Music: <span className="text-white/50">{r.musicTrackId}</span></>}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {reelDetails.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-white/25">No reels generated yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`${color} opacity-60`}>{icon}</span>
        <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
