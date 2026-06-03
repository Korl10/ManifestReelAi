'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function MarginsChart({ chartData }: { chartData: any[] }) {
  const data = chartData ?? [];
  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-white/30 text-sm">No data yet. Generate some reels to see margin data.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 15 }}>
        <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
        <YAxis tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Revenue" />
        <Bar dataKey="cost" fill="#7B2FBE" radius={[4, 4, 0, 0]} name="Cost" />
      </BarChart>
    </ResponsiveContainer>
  );
}
