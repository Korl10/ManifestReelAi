'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CONVERSION_BANNER } from '@/lib/pricing-v2';

interface ConversionBannerProps {
  /** Previous coin balance (for the “X coins → Y credits” detail line). */
  previousCoins?: number;
  /** Resulting credit balance after conversion. */
  newCredits?: number;
  /** Allow dismissal (persisted by caller). */
  onDismiss?: () => void;
}

/**
 * Shown once to existing users after their coin balance is migrated to credits.
 * Display-only in Phase 5A — the actual balance migration happens in 5F.
 */
export default function ConversionBanner({ previousCoins, newCredits, onDismiss }: ConversionBannerProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-gradient-to-r from-[#D4AF37]/12 via-[#D4AF37]/5 to-transparent px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/90 font-medium">{CONVERSION_BANNER}</p>
          {previousCoins != null && newCredits != null && (
            <p className="mt-0.5 text-xs text-white/55">
              Your {previousCoins.toLocaleString()} coins became{' '}
              <span className="text-[#D4AF37] font-semibold">{newCredits.toLocaleString()} credits</span>.
            </p>
          )}
        </div>
        <button
          onClick={() => { setOpen(false); onDismiss?.(); }}
          className="shrink-0 text-white/40 hover:text-white/70 transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
