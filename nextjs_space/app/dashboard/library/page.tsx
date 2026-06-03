'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Library, Clock, Trash2, Download, Eye, Loader2, Film, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  rendering: 'bg-[#7B2FBE]/20 text-[#A855F7]',
  ready: 'bg-emerald-500/20 text-emerald-400',
  published: 'bg-blue-500/20 text-blue-400',
  scheduled: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function LibraryPage() {
  const { data: session } = useSession() || {};
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session) return;
    fetch('/api/reels').then(r => r.json()).then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [session]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reel?')) return;
    try {
      await fetch(`/api/reels/${id}`, { method: 'DELETE' });
      setReels(prev => (prev ?? []).filter((r: any) => r?.id !== id));
      toast.success('Reel deleted');
    } catch { toast.error('Delete failed'); }
  };

  const filtered = (reels ?? []).filter((r: any) => {
    if (filter !== 'all' && r?.status !== filter) return false;
    if (search && !(r?.title ?? r?.prompt ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Library className="w-6 h-6 text-[#D4AF37]" /> Reel Library
        </h1>
        <p className="text-sm text-white/40 mt-1">All your manifestation reels in one place.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search reels..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/50 text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {['all', 'ready', 'rendering', 'scheduled', 'draft', 'failed'].map((s: string) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === s ? 'gold-gradient text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <Film className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No reels found. Create your first one!</p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 rounded-lg gold-gradient text-black text-sm font-semibold">Create Reel</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((reel: any, i: number) => (
            <motion.div
              key={reel?.id ?? i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/10 transition-all group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-[#7B2FBE]/10 to-[#4A1A8A]/10 flex items-center justify-center relative">
                <Film className="w-8 h-8 text-white/10" />
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[reel?.status ?? ''] ?? STATUS_COLORS['draft']}`}>
                  {(reel?.status ?? 'draft').charAt(0).toUpperCase() + (reel?.status ?? '').slice(1)}
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium truncate mb-1">{reel?.title ?? reel?.prompt?.slice(0, 40) ?? 'Untitled'}</p>
                <p className="text-xs text-white/30 mb-3">{reel?.style ?? ''} • {reel?.platform ?? ''}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-white/20">
                    <Clock className="w-3 h-3" />
                    {new Date(reel?.createdAt ?? Date.now()).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/dashboard/reel/${reel?.id ?? ''}`} className="p-1.5 rounded hover:bg-white/5 transition-colors"><Eye className="w-3.5 h-3.5 text-white/40" /></Link>
                    <button onClick={() => toast.success('Download started (demo)')} className="p-1.5 rounded hover:bg-white/5 transition-colors"><Download className="w-3.5 h-3.5 text-white/40" /></button>
                    <button onClick={() => handleDelete(reel?.id ?? '')} className="p-1.5 rounded hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400/40" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
