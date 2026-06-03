'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, Film } from 'lucide-react';

export default function AdminReelsPage() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/reels').then(r => r.json()).then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold flex items-center gap-2"><Film className="w-5 h-5 text-[#D4AF37]" /> All Reels ({reels?.length ?? 0})</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Title</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">User</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Status</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Style</th>
              <th className="text-right py-3 px-3 text-xs text-white/30 font-medium">Total Cost</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel: any) => (
              <tr key={reel?.id ?? ''} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-3 max-w-[200px] truncate">{reel?.title ?? reel?.prompt?.slice(0, 30) ?? 'Untitled'}</td>
                <td className="py-3 px-3 text-white/50">{reel?.user?.email ?? ''}</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] capitalize bg-white/5 text-white/60">{reel?.status ?? ''}</span></td>
                <td className="py-3 px-3 text-white/50 capitalize">{reel?.style ?? ''}</td>
                <td className="py-3 px-3 text-right font-mono text-[#D4AF37]">${(reel?.totalCost ?? 0).toFixed(2)}</td>
                <td className="py-3 px-3 text-white/30">{new Date(reel?.createdAt ?? Date.now()).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
