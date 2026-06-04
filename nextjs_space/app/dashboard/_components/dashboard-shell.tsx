'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Sparkles, Home, Library, Settings, Shield, LogOut, Menu, X, Zap, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Create', icon: Home },
  { href: '/dashboard/library', label: 'My Reels', icon: Library },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free: { label: 'Free Trial', color: 'text-white/70', bg: 'bg-white/10' },
  pro: { label: 'Pro', color: 'text-[#A855F7]', bg: 'bg-[#7B2FBE]/15' },
  premium: { label: 'Premium', color: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/15' },
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quota, setQuota] = useState<any>(null);
  const isAdmin = (session?.user as any)?.role === 'admin';

  useEffect(() => {
    if (!session) return;
    fetch('/api/payments/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.quota) setQuota(data.quota); })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-[#D4AF37] mx-auto mb-4 animate-pulse" />
          <p className="text-white/50 text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const navItems = isAdmin ? [...NAV_ITEMS, { href: '/admin', label: 'Admin', icon: Shield }] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5 h-14">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="w-5 h-5 text-white/60" /> : <Menu className="w-5 h-5 text-white/60" />}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-display text-base font-bold hidden sm:block">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Membership tier badge */}
            {quota && (() => {
              const t = TIER_LABELS[quota.tier] ?? TIER_LABELS['free'];
              return (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${t.bg} border border-white/5`}>
                  <Crown className={`w-3.5 h-3.5 ${t.color}`} />
                  <span className={`text-[11px] font-bold ${t.color} hidden sm:inline`}>{t.label}</span>
                </div>
              );
            })()}
            {/* Credits pill */}
            {quota && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#D4AF37]/15 to-[#7B2FBE]/15 border border-[#D4AF37]/25">
                <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[11px] font-bold text-[#D4AF37]">{Math.max(0, (quota.reelsCap ?? 0) - (quota.reelsUsed ?? 0))}</span>
              </div>
            )}
            <button onClick={() => signOut({ callbackUrl: '/' })} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Sign out">
              <LogOut className="w-4 h-4 text-white/40" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed top-14 left-0 bottom-0 w-56 bg-[#0A0A0A] border-r border-white/5 z-40 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="p-3 space-y-1">
          {navItems.map((item: any) => {
            const isActive = item?.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item?.href ?? '');
            return (
              <Link
                key={item?.href ?? ''}
                href={item?.href ?? '/dashboard'}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {item?.icon && <item.icon className="w-4 h-4" />}
                {item?.label ?? ''}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="pt-14 lg:pl-56 min-h-screen">
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/8">
        <div className="relative flex items-end justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {(() => {
            const rest = navItems.filter((n: any) => n?.href !== '/dashboard');
            const create = navItems.find((n: any) => n?.href === '/dashboard');
            const mid = Math.ceil(rest.length / 2);
            const ordered = [...rest.slice(0, mid), create, ...rest.slice(mid)].filter(Boolean);
            return ordered;
          })().map((item: any) => {
            const isActive = item?.href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(item?.href ?? '');
            const isCreate = item?.href === '/dashboard';
            if (isCreate) {
              return (
                <Link key={item?.href} href={item?.href} className="flex flex-col items-center -mt-7 w-16">
                  <span className={`w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-lg transition-transform ${isActive ? 'gold-glow scale-105' : ''}`}>
                    <item.icon className="w-6 h-6 text-black" strokeWidth={2.5} />
                  </span>
                  <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-[#D4AF37]' : 'text-white/50'}`}>{item?.label}</span>
                </Link>
              );
            }
            return (
              <Link key={item?.href} href={item?.href} className="flex flex-col items-center gap-1 w-16 py-1">
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#D4AF37]' : 'text-white/45'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#D4AF37]' : 'text-white/45'}`}>{item?.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
