'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Film, Loader2, AlertCircle } from 'lucide-react';
import { HydrationDate } from '@/components/hydration-date';

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-white/40',
  rendering: 'text-[#A855F7]',
  ready: 'text-emerald-400',
  published: 'text-blue-400',
  scheduled: 'text-amber-400',
  failed: 'text-red-400',
};

export default function AdminReelsPage() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/reels')
      .then(r => { if (!r.ok) throw new Error('Failed to load reels'); return r.json(); })
      .then(d => setReels(Array.isArray(d) ? d : []))
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Film className="w-5 h-5 text-[#D4AF37]" /> All Reels
      </h1>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => window.location.reload()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {!error && (reels?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <Film className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No reels have been created yet.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="p-4 text-white/40 font-medium">Title</th>
                <th className="p-4 text-white/40 font-medium hidden md:table-cell">User</th>
                <th className="p-4 text-white/40 font-medium">Status</th>
                <th className="p-4 text-white/40 font-medium hidden sm:table-cell">Style</th>
                <th className="p-4 text-white/40 font-medium">Cost</th>
                <th className="p-4 text-white/40 font-medium hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {reels.map((reel: any) => (
                <tr key={reel?.id ?? ''} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                  <td className="p-4 truncate max-w-[200px]">{reel?.title ?? reel?.prompt?.slice(0, 30) ?? 'Untitled'}</td>
                  <td className="p-4 text-white/40 hidden md:table-cell">{reel?.user?.email ?? '—'}</td>
                  <td className="p-4">
                    <span className={`capitalize font-medium ${STATUS_COLORS[reel?.status ?? ''] ?? 'text-white/40'}`}>
                      {reel?.status ?? 'draft'}
                    </span>
                  </td>
                  <td className="p-4 text-white/40 capitalize hidden sm:table-cell">{reel?.style ?? '—'}</td>
                  <td className="p-4 font-mono text-[#D4AF37]">${(reel?.totalCost ?? 0).toFixed(2)}</td>
                  <td className="p-4 text-white/30 hidden lg:table-cell"><HydrationDate date={reel?.createdAt} fallback="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
