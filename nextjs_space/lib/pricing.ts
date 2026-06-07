// ── Pricing configuration (Phase 5 — June 2026 revision) ────────
// All prices are in USD cents. Stripe prices are created on-demand via
// the checkout API, so we don't need hardcoded Stripe Price IDs.
//
// Coin model:
//   • Coins are the universal currency. Each reel type + duration has
//     a fixed coin cost (see REEL_COIN_COSTS below).
//   • Subscriptions include a monthly coin allotment that RESETS each month.
//   • Coin bundles are one-time purchases that STACK on top of the
//     subscription balance and stay valid for 12 months.
//   • Coins extend VOLUME within a tier — they never unlock features.
//     Feature access (model tiers, auto-post, 4K, etc.) is gated by plan.

// ── Subscription plans ───────────────────────────────────────────
export const PLANS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 1999,    // $19.99
    annualPrice: 19188,    // $15.99/mo × 12 = $191.88/yr — save $48/yr (20% off)
    coins: 200,
    reelsCap: 200,         // legacy alias
    modelTiers: ['standard', 'pro'] as string[],
    autoPostPlatforms: [] as string[],  // manual export only
    features: ['Standard + Pro tiers', 'HD exports, no watermark', '160 AI voices', 'Manual export only'],
    introMonthlyPrice: 999,
    introDurationMonths: 3,
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 3999,    // $39.99
    annualPrice: 38388,    // $31.99/mo × 12 = $383.88/yr — save $96/yr (20% off)
    coins: 500,
    reelsCap: 500,
    modelTiers: ['standard', 'pro', 'cinematic'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok'],
    features: ['All 3 tiers', 'Auto-post IG + TikTok', '1080p export', '3 Craft presets', '500 coins/month'],
    introMonthlyPrice: 1999,
    introDurationMonths: 3,
  },
  premium: {
    name: 'Premium',
    monthlyPrice: 8999,    // $89.99
    annualPrice: 86388,    // $71.99/mo × 12 = $863.88/yr — save $216/yr (20% off)
    coins: 1200,
    reelsCap: 1200,
    modelTiers: ['standard', 'pro', 'cinematic'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok', 'youtube', 'x'],
    features: ['All tiers + 4K', 'Brand Kit', 'Auto-post IG/TikTok/YT/X', 'Priority queue', 'API access', '1,200 coins/month'],
    introMonthlyPrice: 4499,
    introDurationMonths: 3,
  },
  agency: {
    name: 'Agency',
    monthlyPrice: 19900,   // $199.00
    annualPrice: 190800,   // $159/mo × 12 = $1,908/yr — save $480/yr (20% off)
    coins: 3000,
    reelsCap: 3000,
    modelTiers: ['standard', 'pro', 'cinematic'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok', 'youtube', 'x'],
    features: ['5 seats', 'Multi-brand', 'Bulk generation', 'White-label option', '3,000 coins/month'],
    introMonthlyPrice: 9900,
    introDurationMonths: 3,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type BillingInterval = 'monthly' | 'annual';

export const PLAN_ORDER: PlanTier[] = ['starter', 'pro', 'premium', 'agency'];

// ── Per-reel coin costs (by model tier × duration) ───────────────
// Columns: [5s, 10s, 15s, 25s, 30s]
export const REEL_DURATIONS = [5, 10, 15, 25, 30] as const;
export type ReelDuration = typeof REEL_DURATIONS[number];

export const REEL_COIN_COSTS: Record<string, Record<number, number>> = {
  standard: { 5: 6, 10: 8, 15: 10, 25: 14, 30: 16 },
  pro:      { 5: 25, 10: 40, 15: 70, 25: 100, 30: 110 },
  cinematic:{ 5: 90, 10: 170, 15: 250, 25: 400, 30: 420 },
};

// Legacy flat coin costs (backward compat for admin/margins and old reels).
export const COIN_COST = {
  static: 1,   // deprecated — use REEL_COIN_COSTS['standard'][duration]
  motion: 5,   // deprecated — use REEL_COIN_COSTS['pro'][duration]
} as const;

// Lookup: given a model-tier id + reel duration, return the coin cost.
export function reelCoinCost(modelTierId: string, durationSec: number): number {
  const tier = REEL_COIN_COSTS[modelTierId] ?? REEL_COIN_COSTS['standard'];
  // Snap to nearest offered duration
  const snapped = REEL_DURATIONS.reduce((best, d) =>
    Math.abs(d - durationSec) < Math.abs(best - durationSec) ? d : best,
    REEL_DURATIONS[0],
  );
  return tier[snapped] ?? tier[15] ?? 10;
}

// ── Trial configuration ──────────────────────────────────────────
// Each trial: card upfront, 3-day auto-convert, 1× watermarked reel.
export const TRIAL_CONFIG: Record<PlanTier, { coins: number; duration: number; modelTier: string }> = {
  starter: { coins: 8,   duration: 10, modelTier: 'standard' },
  pro:     { coins: 40,  duration: 10, modelTier: 'pro' },
  premium: { coins: 170, duration: 10, modelTier: 'cinematic' },
  agency:  { coins: 170, duration: 10, modelTier: 'cinematic' },
};

// Annual billing is 20% off the monthly rate.
export function annualPerMonth(tier: PlanTier) {
  return Math.round(PLANS[tier].annualPrice / 12);
}
export const ANNUAL_DISCOUNT_PCT = 20;

/** Annual savings in cents for a given tier. */
export function annualSavingsCents(tier: PlanTier): number {
  return PLANS[tier].monthlyPrice * 12 - PLANS[tier].annualPrice;
}

// ── Founders’ Launch Promo (first 90 days) ───────────────────────
// Applies to ANNUAL billing for ALL tiers. Deeper than the standard
// 20% annual discount (33–38% off). Locked for life: a founder keeps
// their discounted annual rate on every renewal. After Day 90 the
// pricing auto-reverts to the standard 20% annual discount.
export const LAUNCH_DATE = new Date('2026-06-07T00:00:00Z');
export const FOUNDERS_DURATION_DAYS = 90;

/** Founders’ ANNUAL price (cents/year) per tier. */
export const FOUNDERS_ANNUAL_PRICE: Record<PlanTier, number> = {
  starter: 15588,   // $155.88/yr → $12.99/mo (35% off $19.99)
  pro:     29988,   // $299.88/yr → $24.99/mo (38% off $39.99)
  premium: 71988,   // $719.88/yr → $59.99/mo (33% off $89.99)
  agency:  154800,  // $1,548/yr  → $129/mo   (35% off $199)
};

/** Founders’ annual price as a monthly-equivalent (cents). */
export function foundersAnnualPerMonth(tier: PlanTier): number {
  return Math.round(FOUNDERS_ANNUAL_PRICE[tier] / 12);
}

/** Founders’ annual savings vs standard monthly × 12 (cents). */
export function foundersAnnualSavingsCents(tier: PlanTier): number {
  return PLANS[tier].monthlyPrice * 12 - FOUNDERS_ANNUAL_PRICE[tier];
}

/** True if we’re within the founders’ pricing window. */
export function isFoundersPeriod(): boolean {
  const now = new Date();
  const elapsed = (now.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24);
  return elapsed < FOUNDERS_DURATION_DAYS;
}

/** Days remaining in the founders’ window (0 if expired). */
export function foundersCountdownDays(): number {
  const now = new Date();
  const endDate = new Date(LAUNCH_DATE.getTime() + FOUNDERS_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const remaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
}

// ── Coin bundles (one-time purchases, stack on subscription) ─────
export const COIN_BUNDLES = [
  { id: 'mini',        label: 'Mini',        coins: 100,   price: 999,    popular: false },
  { id: 'creator',     label: 'Creator',     coins: 280,   price: 2499,   popular: true },
  { id: 'studio',      label: 'Studio',      coins: 600,   price: 4999,   popular: false },
  { id: 'pro-pack',    label: 'Pro Pack',    coins: 1300,  price: 9999,   popular: false },
  { id: 'agency-pack', label: 'Agency Pack', coins: 3500,  price: 24900,  popular: false },
] as const;

export const BUNDLE_EXPIRY_MONTHS = 12;

// Free tier: registration + dashboard + 7s watermarked preview.
export const FREE_PREVIEW_CAP = 1;
export const FREE_TRIAL_CAP = FREE_PREVIEW_CAP;

export function savePct(full: number, intro: number) {
  return Math.round(((full - intro) / full) * 100);
}

export function premiumSavePct() {
  const yearly = PLANS.premium.monthlyPrice * 12;
  const proYearly = PLANS.pro.monthlyPrice * 12;
  return Math.round(((proYearly * 2 - yearly) / (proYearly * 2)) * 100);
}

// Per-coin economics — used by admin/margin reporting.
export function cheapestPerCoinCents() {
  return Math.min(...COIN_BUNDLES.map((b) => b.price / b.coins));
}
