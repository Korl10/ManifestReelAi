'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Sparkles, Home, Library, Settings, Shield, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Create', icon: Home },
  { href: '/dashboard/library', label: 'My Reels', icon: Library },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = (session?.user as any)?.role === 'admin';

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
            <Link href="/dashboard" className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-display text-base font-bold hidden sm:block">ManifestReel<span className="text-[#D4AF37]"> AI</span></span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 hidden sm:block">{session?.user?.email ?? ''}</span>
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
    </div>
  );
}
