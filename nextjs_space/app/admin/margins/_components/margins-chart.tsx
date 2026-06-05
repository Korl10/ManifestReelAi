'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

/* ── Daily Trend BarChart ── */
export function DailyTrendChart({ data }: { data: any[] }) {
  if (!data?.length) {
    return <EmptyState text="No daily data yet" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
          tickFormatter={(v: string) => v.slice(5)} // MM-DD
        />
        <YAxis
          tickLine={false}
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
          tickFormatter={(v: number) => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            fontSize: 11,
            color: '#fff',
          }}
          formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
          labelFormatter={(l: string) => `Date: ${l}`}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} />
        <Bar dataKey="retail" fill="#D4AF37" radius={[3, 3, 0, 0]} name="Retail" />
        <Bar dataKey="cost" fill="#7B2FBE" radius={[3, 3, 0, 0]} name="Cost" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Category Pie Chart ── */
const CAT_COLORS: Record<string, string> = {
  script: '#3b82f6',
  image: '#D4AF37',
  voice: '#8b5cf6',
  video: '#ef4444',
  music: '#22c55e',
  render: '#f97316',
  storage: '#06b6d4',
};

export function CategoryPieChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  if (!entries.length) return <EmptyState text="No cost data yet" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={entries}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {entries.map((e) => (
            <Cell key={e.name} fill={CAT_COLORS[e.name] ?? '#888'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            fontSize: 11,
            color: '#fff',
          }}
          formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Empty state ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-white/25 text-sm">
      {text}
    </div>
  );
}

/* default export kept for backward compat (unused now) */
export default function MarginsChart({ chartData }: { chartData: any[] }) {
  return <DailyTrendChart data={chartData} />;
}
