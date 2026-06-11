'use client';

/**
 * INTERNAL Phase 5A preview page — not linked from any nav.
 * Renders the new credit pricing, cost engine samples, coin→credit conversion
 * preview, the conversion banner, and the voice picker with tier-locking so the
 * new system can be visually verified before the PRICING_V2 flag is flipped.
 */

import { useState } from 'react';
import VoiceBrowser from '@/components/voice-browser';
import ConversionBanner from '@/components/conversion-banner';
import type { VoiceTier } from '@/lib/voice-catalog';
import {
  PLANS_V2, PLAN_ORDER_V2, reelCreditCost, coinsToCredits,
  TOPUP_PACKS, type PlanTierV2,
} from '@/lib/pricing-v2';

const SAMPLE_COSTS: { label: string; q: 'static' | 'standard' | 'pro' | 'cinematic'; d: number }[] = [
  { label: 'Static 5s', q: 'static', d: 5 },
  { label: 'Standard 10s', q: 'standard', d: 10 },
  { label: 'Pro 15s', q: 'pro', d: 15 },
  { label: 'Cinematic 25s', q: 'cinematic', d: 25 },
];

export default function PricingV2Preview() {
  const [voiceId, setVoiceId] = useState('female-f-01');
  const [tier, setTier] = useState<VoiceTier>('multilingual');
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [planTier, setPlanTier] = useState<PlanTierV2>('starter');

  const sampleCoins = 250;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10 space-y-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Pricing V2 — Phase 5A Preview</h1>
          <p className="text-sm text-white/50 mt-1">Internal verification page (PRICING_V2 flag still off).</p>
        </header>

        <ConversionBanner previousCoins={sampleCoins} newCredits={coinsToCredits(sampleCoins)} />

        {/* Plans */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLAN_ORDER_V2.map(id => {
              const p = PLANS_V2[id];
              return (
                <div key={id} className={`rounded-xl border p-4 ${p.highlight ? 'border-[#D4AF37]/40 bg-[#D4AF37]/5' : 'border-white/10 bg-white/[0.02]'}`}>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-2xl font-bold mt-1">${(p.monthlyCents / 100).toFixed(2)}<span className="text-xs text-white/40">/mo</span></p>
                  <p className="text-[11px] text-white/40">or ${(p.annualPerMonthCents / 100).toFixed(2)}/mo billed yearly (${(p.annualTotalCents / 100).toFixed(2)})</p>
                  <p className="text-sm text-[#D4AF37] mt-2">{p.credits.toLocaleString()} credits</p>
                  <p className="text-[11px] text-white/50">{p.voiceCount} voices · up to {p.maxModelTier}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cost engine samples */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Credit cost samples</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_COSTS.map(s => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs text-white/50">{s.label}</p>
                <p className="text-xl font-bold text-[#D4AF37]">{reelCreditCost(s.q, s.d)} <span className="text-xs text-white/40 font-normal">credits</span></p>
              </div>
            ))}
          </div>
        </section>

        {/* Top-ups + conversion */}
        <section className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Top-up packs</h2>
            <div className="space-y-2">
              {TOPUP_PACKS.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <span className="text-sm">{t.label} — {t.credits.toLocaleString()} credits {t.popular && <span className="text-[10px] text-[#D4AF37]">★ popular</span>}</span>
                  <span className="text-sm font-semibold">${(t.priceCents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-3">Coin → Credit conversion (2.7x)</h2>
            <div className="space-y-2">
              {[100, 250, 500, 1500].map(c => (
                <div key={c} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="text-white/60">{c.toLocaleString()} coins</span>
                  <span className="text-[#D4AF37] font-semibold">→ {coinsToCredits(c).toLocaleString()} credits</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Voice picker with gating */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Voice picker (tier-locked)</h2>
            <div className="flex gap-1.5">
              {PLAN_ORDER_V2.map(t => (
                <button
                  key={t}
                  onClick={() => setPlanTier(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs ${planTier === t ? 'bg-[#D4AF37] text-black font-medium' : 'bg-white/5 text-white/60'}`}
                >
                  {PLANS_V2[t].name}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/40 mb-3">Viewing as <span className="text-[#D4AF37]">{PLANS_V2[planTier].name}</span> plan. Locked voices show an upgrade badge; previews still play for everyone.</p>
          <div className="max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
            <VoiceBrowser
              selectedVoiceId={voiceId}
              onSelect={setVoiceId}
              voiceTier={tier}
              onTierChange={setTier}
              stability={stability}
              onStabilityChange={setStability}
              similarity={similarity}
              onSimilarityChange={setSimilarity}
              planTier={planTier}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
