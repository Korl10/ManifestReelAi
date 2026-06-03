'use client';
import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, BarChart3, Film, Users, TrendingUp, ArrowLeft } from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/reels', label: 'Reels', icon: Film },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/margins', label: 'Margins', icon: TrendingUp },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {};
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const isAdmin = (session?.user as any)?.role === 'admin';

  if (!session) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><p className="text-white/40">Loading...</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white/50 mb-4">Admin access required</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white/60 hover:bg-white/10">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="border-b border-white/5 bg-[#0A0A0A]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/5"><ArrowLeft className="w-4 h-4 text-white/40" /></Link>
            <Shield className="w-5 h-5 text-[#D4AF37]" />
            <span className="font-display text-base font-bold">Admin</span>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-2">
            {TABS.map((tab: any) => {
              const isActive = tab.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(tab.href);
              return (
                <Link key={tab.href} href={tab.href} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${isActive ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
