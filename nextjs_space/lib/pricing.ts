// ── Pricing configuration ────────────────────────────────────────
// All prices are in USD cents. Stripe prices are created on-demand via
// the checkout API, so we don't need hardcoded Stripe Price IDs.
//
// Coin model:
//   • A static reel costs 1 coin. A hybrid-motion reel costs MOTION coins.
//   • Subscriptions include a monthly coin allotment that RESETS each month.
//   • Coin bundles are one-time purchases that STACK on top of the
//     subscription balance and stay valid for 12 months.
//   • Coins extend VOLUME within a tier — they never unlock features.
//     Motion stays Premium-only even if a Pro user buys coins.

export const PLANS = {
  pro: {
    name: 'Pro',
    monthlyPrice: 1999, // cents
    annualPrice: 11994, // cents billed once per year = 1999 * 12 * 0.5 (50% off)
    coins: 30, // monthly coin allotment
    reelsCap: 30, // legacy alias (== coins) kept for backward-compat
    motion: false, // static reels only
    introMonthlyPrice: 999, // cents – first 3 months discount
    introDurationMonths: 3,
  },
  premium: {
    name: 'Premium',
    monthlyPrice: 4999, // cents
    annualPrice: 29994, // cents billed once per year = 4999 * 12 * 0.5 (50% off)
    coins: 60, // monthly coin allotment
    reelsCap: 60, // legacy alias (== coins)
    motion: true, // cinematic motion enabled
    introMonthlyPrice: 2500, // cents – first 3 months discount
    introDurationMonths: 3,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type BillingInterval = 'monthly' | 'annual';

// ── Coin cost per reel type ──────────────────────────────────────
export const COIN_COST = {
  static: 1,
  motion: 5, // hybrid-motion reel (Premium-only)
} as const;

// Annual billing is 50% off the monthly rate. Returns the effective
// per-month price (in cents) when billed annually.
export function annualPerMonth(tier: PlanTier) {
  return Math.round(PLANS[tier].annualPrice / 12);
}

// Percentage saved by choosing annual billing vs paying monthly for a year.
export const ANNUAL_DISCOUNT_PCT = 50;

// ── Coin bundles (one-time purchases, stack on subscription) ─────
// Coins from bundles stay valid for 12 months and never expire monthly.
export const COIN_BUNDLES = [
  { id: 'starter', label: 'Starter', coins: 10, reels: 10, price: 799 }, // cents
  { id: 'creator', label: 'Creator', coins: 25, reels: 25, price: 1699, popular: true },
  { id: 'pro-pack', label: 'Pro Pack', coins: 60, reels: 60, price: 3499 },
  { id: 'studio', label: 'Studio', coins: 150, reels: 150, price: 7499 },
] as const;

export const BUNDLE_EXPIRY_MONTHS = 12;

// Free tier: registration + dashboard + watch-only demo gallery +
// ONE watermarked preview built from cached/sample assets (no paid APIs).
export const FREE_PREVIEW_CAP = 1;
export const FREE_TRIAL_CAP = FREE_PREVIEW_CAP; // legacy alias

export function savePct(full: number, intro: number) {
  return Math.round(((full - intro) / full) * 100);
}

export function premiumSavePct() {
  const yearly = PLANS.premium.monthlyPrice * 12;
  const proYearly = PLANS.pro.monthlyPrice * 12;
  return Math.round(((proYearly * 2 - yearly) / (proYearly * 2)) * 100);
}

// Per-coin economics — used by admin/margin reporting.
// Cheapest per-coin price across bundles (Studio = 150 coins / $74.99).
export function cheapestPerCoinCents() {
  return Math.min(...COIN_BUNDLES.map((b) => b.price / b.coins));
}
