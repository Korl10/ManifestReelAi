// ── Pricing configuration ────────────────────────────────────────
// All prices are in USD. Stripe prices are created on-demand via
// the checkout API, so we don't need hardcoded Stripe Price IDs.

export const PLANS = {
  pro: {
    name: 'Pro',
    monthlyPrice: 1999, // cents
    annualPrice: 11994, // cents billed once per year = 1999 * 12 * 0.5 (50% off)
    reelsCap: 30,
    introMonthlyPrice: 999, // cents – first 3 months discount
    introDurationMonths: 3,
  },
  premium: {
    name: 'Premium',
    monthlyPrice: 4999, // cents
    annualPrice: 29994, // cents billed once per year = 4999 * 12 * 0.5 (50% off)
    reelsCap: 60,
    introMonthlyPrice: 2500, // cents – first 3 months discount
    introDurationMonths: 3,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type BillingInterval = 'monthly' | 'annual';

// Annual billing is 50% off the monthly rate. Returns the effective
// per-month price (in cents) when billed annually.
export function annualPerMonth(tier: PlanTier) {
  return Math.round(PLANS[tier].annualPrice / 12);
}

// Percentage saved by choosing annual billing vs paying monthly for a year.
export const ANNUAL_DISCOUNT_PCT = 50;

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
