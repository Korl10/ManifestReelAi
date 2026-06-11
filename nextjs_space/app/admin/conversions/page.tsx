'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Percent,
  Download, Loader2, BarChart3, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Minus, Filter, RefreshCw,
  ShieldAlert, UserPlus, UserMinus, CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, Funnel, FunnelChart,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────────
interface KpiVal {
  value: number;
  change?: number;
}

interface ConversionsData {
  kpis: {
    trialSignups: KpiVal;
    conversionRate: KpiVal;
    abandonRate: KpiVal;
    mrr: KpiVal;
    arr: KpiVal;
    arpu: KpiVal;
    churnRate: KpiVal;
    ltv: KpiVal;
    netNewMrr: KpiVal;
    activePaidSubs: KpiVal;
    totalUsers: KpiVal;
  };
  charts: {
    dailyTrials: { day: string; count: number }[];
    dailyNewPaid: { day: string; count: number }[];
    funnel: { stage: string; count: number }[];
    planMix: { tier: string; name: string; count: number; mrrCents: number }[];
  };
  tables: {
    blockedReasons: { reason: string; count: number; pct: number }[];
    recentConversions: { email: string; plan: string; mrrAdded: number; date: string }[];
    recentChurns: { email: string; plan: string; daysActive: number; date: string }[];
    recentTopups: { email: string; credits: number; description: string | null; date: string }[];
  };
}

// ── Colors ──────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const PIE_COLORS = ['#D4AF37', '#A855F7', '#3B82F6', '#10B981'];
const FUNNEL_COLORS = ['#3B82F6', '#6366F1', '#A855F7', '#D4AF37', '#10B981'];

const DATE_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const PLAN_OPTIONS = [
  { label: 'All Plans', value: 'all' },
  { label: 'Starter', value: 'starter' },
  { label: 'Creator', value: 'creator' },
  { label: 'Pro', value: 'pro' },
  { label: 'Studio', value: 'studio' },
];

// ── CSV Export ─────────────────────────────────────────────────
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => {
      const v = r[h];
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v ?? '';
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({ label, value, change, prefix, suffix, icon: Icon }: {
  label: string;
  value: number;
  change?: number;
  prefix?: string;
  suffix?: string;
  icon: typeof TrendingUp;
}) {
  const formattedValue = prefix === '$'
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix || ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/40 text-xs uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-white/20" />
      </div>
      <p className="text-xl font-bold text-white">{formattedValue}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${
          change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-white/40'
        }`}>
          {change > 0 ? <ArrowUpRight className="w-3 h-3" /> :
           change < 0 ? <ArrowDownRight className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          {change > 0 ? '+' : ''}{change.toFixed(1)}% vs prior
        </div>
      )}
    </motion.div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────
function Section({ title, icon: Icon, onExport, children }: {
  title: string;
  icon: typeof BarChart3;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#D4AF37]" />
          {title}
        </h2>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1 text-white/40 hover:text-white/60 text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function ConversionsPage() {
  const [data, setData] = useState<ConversionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [plan, setPlan] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/conversions?days=${days}&plan=${plan}`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setData(d);
    } catch {
      toast.error('Failed to load conversions data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, plan]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const { kpis, charts, tables } = data;

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-[#D4AF37]" />
            Conversions
          </h1>
          <p className="text-white/50 mt-1 text-sm">Revenue metrics, trial funnel, and growth analytics.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  days === r.value
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Plan filter */}
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#D4AF37]/50"
          >
            {PLAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0A0A0A]">
                {o.label}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Trial Signups" value={kpis.trialSignups.value} change={kpis.trialSignups.change} icon={UserPlus} />
        <KpiCard label="Conversion Rate" value={kpis.conversionRate.value} change={kpis.conversionRate.change} suffix="%" icon={Percent} />
        <KpiCard label="Abandon Rate" value={kpis.abandonRate.value} suffix="%" icon={UserMinus} />
        <KpiCard label="MRR" value={kpis.mrr.value} prefix="$" icon={DollarSign} />
        <KpiCard label="ARR" value={kpis.arr.value} prefix="$" icon={DollarSign} />
        <KpiCard label="ARPU" value={kpis.arpu.value} prefix="$" icon={DollarSign} />
        <KpiCard label="Churn Rate" value={kpis.churnRate.value} suffix="%" icon={TrendingDown} />
        <KpiCard label="LTV" value={kpis.ltv.value} prefix="$" icon={DollarSign} />
        <KpiCard label="Net New MRR" value={kpis.netNewMrr.value} prefix="$" icon={TrendingUp} />
        <KpiCard label="Active Paid" value={kpis.activePaidSubs.value} icon={Users} />
      </div>

      {/* Charts Row 1: Daily Trials + Daily New Paid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Daily Trial Signups" icon={BarChart3}>
          <div className="h-64">
            {charts.dailyTrials.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-16">No trial data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.dailyTrials}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="count" name="Trials" stroke={GOLD} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section title="Daily New Paid Subs" icon={BarChart3}>
          <div className="h-64">
            {charts.dailyNewPaid.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-16">No paid subscription data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.dailyNewPaid}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="count" name="New Paid" stroke="#A855F7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Charts Row 2: Funnel + Plan Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Conversion Funnel" icon={BarChart3}>
          <div className="h-72">
            {charts.funnel.every((f) => f.count === 0) ? (
              <p className="text-white/30 text-sm text-center py-16">No funnel data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.funnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                    {charts.funnel.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section title="Plan Mix" icon={PieIcon}>
          <div className="h-72">
            {charts.planMix.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-16">No active paid subscriptions.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.planMix}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, count }) => `${name}: ${count}`}
                    labelLine={false}
                  >
                    {charts.planMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [`${v} subs`, name]} />
                  <Legend
                    formatter={(value) => <span className="text-white/60 text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked Reasons */}
        <Section
          title="Top Blocked Trial Reasons (7d)"
          icon={ShieldAlert}
          onExport={() => downloadCsv(tables.blockedReasons, 'blocked-reasons.csv')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10">
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2 pr-4 text-right">Count</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {tables.blockedReasons.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-white/30">No blocked trials in last 7 days.</td></tr>
                ) : (
                  tables.blockedReasons.map((r) => (
                    <tr key={r.reason} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-white/70 text-xs">{r.reason}</td>
                      <td className="py-2 pr-4 text-right text-white font-mono text-xs">{r.count}</td>
                      <td className="py-2 text-right text-white/50 text-xs">{r.pct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Recent Conversions */}
        <Section
          title="Recent Conversions"
          icon={UserPlus}
          onExport={() => downloadCsv(
            tables.recentConversions.map((c) => ({ ...c, date: new Date(c.date).toISOString() })),
            'recent-conversions.csv',
          )}
        >
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10 sticky top-0 bg-white/5">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4 text-right">MRR</th>
                  <th className="pb-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {tables.recentConversions.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-white/30">No conversions yet.</td></tr>
                ) : (
                  tables.recentConversions.map((c, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-white font-mono text-xs">{c.email}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] capitalize">{c.plan}</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono">+${c.mrrAdded}</td>
                      <td className="py-2 text-right text-white/40 text-xs">{new Date(c.date).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Recent Churns */}
        <Section
          title="Recent Churns"
          icon={UserMinus}
          onExport={() => downloadCsv(
            tables.recentChurns.map((c) => ({ ...c, date: new Date(c.date).toISOString() })),
            'recent-churns.csv',
          )}
        >
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10 sticky top-0 bg-white/5">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4 text-right">Days Active</th>
                  <th className="pb-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {tables.recentChurns.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-white/30">No churns recorded.</td></tr>
                ) : (
                  tables.recentChurns.map((c, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-white font-mono text-xs">{c.email}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 capitalize">{c.plan}</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-white/50 text-xs font-mono">{c.daysActive}d</td>
                      <td className="py-2 text-right text-white/40 text-xs">{new Date(c.date).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Recent Top-ups */}
        <Section
          title="Recent Top-up Purchases"
          icon={CreditCard}
          onExport={() => downloadCsv(
            tables.recentTopups.map((t) => ({ ...t, date: new Date(t.date).toISOString() })),
            'recent-topups.csv',
          )}
        >
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/10 sticky top-0 bg-white/5">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4 text-right">Credits</th>
                  <th className="pb-2 pr-4">Pack</th>
                  <th className="pb-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {tables.recentTopups.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-white/30">No top-up purchases yet.</td></tr>
                ) : (
                  tables.recentTopups.map((t, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-white font-mono text-xs">{t.email}</td>
                      <td className="py-2 pr-4 text-right text-[#D4AF37] text-xs font-mono">+{t.credits.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-white/50 text-xs">{t.description || '—'}</td>
                      <td className="py-2 text-right text-white/40 text-xs">{new Date(t.date).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
