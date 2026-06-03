'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, Users } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-[#D4AF37]" /> Users ({users?.length ?? 0})</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Name</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Email</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Role</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Tier</th>
              <th className="text-right py-3 px-3 text-xs text-white/30 font-medium">Reels</th>
              <th className="text-left py-3 px-3 text-xs text-white/30 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u?.id ?? ''} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-3">{u?.name ?? 'N/A'}</td>
                <td className="py-3 px-3 text-white/50">{u?.email ?? ''}</td>
                <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] capitalize ${u?.role === 'admin' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-white/5 text-white/50'}`}>{u?.role ?? 'user'}</span></td>
                <td className="py-3 px-3 capitalize text-white/50">{u?.tier ?? 'free'}</td>
                <td className="py-3 px-3 text-right font-mono">{u?.reelCount ?? 0}</td>
                <td className="py-3 px-3 text-white/30">{new Date(u?.createdAt ?? Date.now()).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
