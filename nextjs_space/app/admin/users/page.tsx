'use client';
import React, { useState, useEffect } from 'react';
import { Users, Loader2, AlertCircle, Crown } from 'lucide-react';
import { HydrationDate } from '@/components/hydration-date';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => { if (!r.ok) throw new Error('Failed to load users'); return r.json(); })
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(err => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const TIER_COLORS: Record<string, string> = {
    free: 'text-white/40',
    pro: 'text-[#D4AF37]',
    premium: 'text-[#A855F7]',
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Users className="w-5 h-5 text-[#D4AF37]" /> User Management
      </h1>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => window.location.reload()} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}

      {!error && (users?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No users registered yet.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="p-4 text-white/40 font-medium">Name</th>
                <th className="p-4 text-white/40 font-medium hidden sm:table-cell">Email</th>
                <th className="p-4 text-white/40 font-medium">Role</th>
                <th className="p-4 text-white/40 font-medium">Tier</th>
                <th className="p-4 text-white/40 font-medium hidden md:table-cell">Reels</th>
                <th className="p-4 text-white/40 font-medium hidden lg:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u?.id ?? ''} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                  <td className="p-4 font-medium">
                    <div className="flex items-center gap-2">
                      {u?.role === 'admin' && <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />}
                      {u?.name ?? 'Unnamed'}
                    </div>
                  </td>
                  <td className="p-4 text-white/40 hidden sm:table-cell">{u?.email ?? '—'}</td>
                  <td className="p-4 capitalize">
                    <span className={u?.role === 'admin' ? 'text-[#D4AF37] font-medium' : 'text-white/50'}>{u?.role ?? 'user'}</span>
                  </td>
                  <td className="p-4">
                    <span className={`capitalize font-medium ${TIER_COLORS[u?.tier ?? ''] ?? 'text-white/40'}`}>{u?.tier ?? 'free'}</span>
                  </td>
                  <td className="p-4 font-mono text-white/50 hidden md:table-cell">{u?.reelCount ?? 0}</td>
                  <td className="p-4 text-white/30 hidden lg:table-cell"><HydrationDate date={u?.createdAt} fallback="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
