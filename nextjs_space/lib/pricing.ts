// ── Pricing configuration ────────────────────────────────────────
// All prices are in USD. Stripe prices are created on-demand via
// the checkout API, so we don't need hardcoded Stripe Price IDs.

export const PLANS = {
  pro: {
    name: 'Pro',
    monthlyPrice: 1999, // cents
    reelsCap: 30,
    trialDays: 3,
    introMonthlyPrice: 999, // cents – first 3 months discount
    introDurationMonths: 3,
  },
  premium: {
    name: 'Premium',
    monthlyPrice: 4999, // cents
    reelsCap: 60,
    trialDays: 3,
    introMonthlyPrice: 2500, // cents – first 3 months discount
    introDurationMonths: 3,
  },
} as const;

export type PlanTier = keyof typeof PLANS;

// ── Coin bundles (one-time purchases) ────────────────────────────
export const COIN_BUNDLES = [
  { id: 'bundle-10', label: '10 Extra Reels', reels: 10, price: 1000 }, // cents
  { id: 'bundle-20', label: '20 Extra Reels', reels: 20, price: 1500 }, // cents
] as const;

export const FREE_TRIAL_CAP = 1; // 1 reel on free/trial

export function savePct(full: number, intro: number) {
  return Math.round(((full - intro) / full) * 100);
}

export function premiumSavePct() {
  const yearly = PLANS.premium.monthlyPrice * 12;
  const proYearly = PLANS.pro.monthlyPrice * 12;
  return Math.round(((proYearly * 2 - yearly) / (proYearly * 2)) * 100);
}
