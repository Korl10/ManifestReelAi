'use client';

import React, { useState } from 'react';
import { Lock, Check, Play, Sparkles, Coins } from 'lucide-react';
import Link from 'next/link';
import { MODEL_TIER_LIST, type ModelTierId } from '@/lib/model-tiers';
import { reelCoinCost, REEL_COIN_COSTS } from '@/lib/pricing';

interface Props {
  value: ModelTierId;
  onChange: (id: ModelTierId) => void;
  /** Model tier ids this subscription can select. */
  allowed: ModelTierId[];
  /** Selected reel duration — shows exact cost when provided, else a range. */
  durationSec?: number;
}

export default function ModelTierPicker({ value, onChange, allowed, durationSec }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MODEL_TIER_LIST.map((tier) => {
        const locked = !allowed.includes(tier.id);
        const selected = value === tier.id && !locked;
        return (
          <div
            key={tier.id}
            className={`relative rounded-2xl border p-4 transition-all flex flex-col ${
              selected
                ? 'border-[#D4AF37] bg-gradient-to-b from-[#D4AF37]/15 to-[#7B2FBE]/10 shadow-lg shadow-[#D4AF37]/10'
                : locked
                ? 'border-white/10 bg-white/[0.02] opacity-80'
                : 'border-white/10 bg-white/[0.03] hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                {tier.id === 'cinematic' && <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />}
                {tier.name}
              </h4>
              {selected && <Check className="w-4 h-4 text-[#D4AF37]" />}
              {locked && <Lock className="w-3.5 h-3.5 text-white/40" />}
            </div>
            <p className="text-[11px] text-white/45 leading-snug mb-2 min-h-[28px]">{tier.tagline}</p>

            {/* Sample preview */}
            <div className="relative aspect-[9/16] w-full max-h-40 rounded-lg overflow-hidden bg-black/40 mb-2">
              {preview === tier.id ? (
                <video
                  src={tier.sampleVideoUrl}
                  poster={tier.samplePoster}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview(tier.id)}
                  className="group absolute inset-0 flex items-center justify-center"
                  aria-label={`Preview ${tier.name} sample reel`}
                  style={{ backgroundImage: `url(${tier.samplePoster})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                >
                  <span className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                  <span className="relative w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-4 h-4 text-black ml-0.5" />
                  </span>
                </button>
              )}
            </div>

            <ul className="space-y-1 mb-3">
              {tier.features.map((f) => (
                <li key={f} className="text-[10.5px] text-white/55 flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-[#D4AF37] mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <div className="flex items-center justify-between text-[11px] mb-2">
                <span className="flex items-center gap-1 text-[#D4AF37] font-semibold">
                  <Coins className="w-3.5 h-3.5" />{' '}
                  {durationSec
                    ? `${reelCoinCost(tier.id, durationSec)} coins`
                    : (() => {
                        const costs = REEL_COIN_COSTS[tier.id];
                        const vals = costs ? Object.values(costs) : [tier.coinCost];
                        return `${Math.min(...vals)}–${Math.max(...vals)} coins`;
                      })()}
                </span>
                {durationSec && <span className="text-white/30">{durationSec}s reel</span>}
              </div>
              {locked ? (
                <Link
                  href="/dashboard/settings"
                  className="block text-center w-full py-2 rounded-lg bg-white/5 text-[#A855F7] text-xs font-semibold hover:bg-white/10 transition"
                >
                  {tier.minSubscription === 'pro' ? 'Pro+ plan →' : 'Upgrade →'}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange(tier.id)}
                  className={`w-full py-2 rounded-lg text-xs font-bold transition ${
                    selected ? 'gold-gradient text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {selected ? 'Selected' : 'Select'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
