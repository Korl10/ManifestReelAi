// ── Pricing configuration (June 2026 — credit-based model) ─────
// All prices are in USD cents. 1 credit ≈ $0.10 user value.
// Annual = 40% off monthly. This is the SINGLE SOURCE OF TRUTH for
// all surfaces: landing page, signup, settings, paywall, admin.

// ── Subscription plans ───────────────────────────────────────────
export const PLANS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 1499,    // $14.99
    annualPrice: 10788,    // $8.99/mo × 12 = $107.88/yr — save 40%
    credits: 1500,
    coins: 1500,           // legacy alias
    reelsCap: 1500,        // legacy alias
    modelTiers: ['standard'] as string[],
    autoPostPlatforms: [] as string[],
    features: ['1,500 credits / month', '10 premium voices', 'Up to Standard quality', '720p & 1080p exports', 'Auto-matched background music'],
    introMonthlyPrice: 999,
    introDurationMonths: 3,
  },
  creator: {
    name: 'Creator',
    monthlyPrice: 3499,    // $34.99
    annualPrice: 25188,    // $20.99/mo × 12 = $251.88/yr — save 40%
    credits: 4000,
    coins: 4000,
    reelsCap: 4000,
    modelTiers: ['standard', 'pro'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok'],
    features: ['4,000 credits / month', '30 premium voices', 'Up to Pro quality', '1080p exports', 'Custom music uploads', 'Craft brand presets'],
    introMonthlyPrice: 1999,
    introDurationMonths: 3,
    highlight: true,
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 7999,    // $79.99
    annualPrice: 57588,    // $47.99/mo × 12 = $575.88/yr — save 40%
    credits: 10000,
    coins: 10000,
    reelsCap: 10000,
    modelTiers: ['standard', 'pro', 'cinematic'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok', 'youtube', 'x'],
    features: ['10,000 credits / month', 'All 150+ voices', 'Cinematic quality (Veo 3)', 'Brand Kit (unlimited presets)', '4K upscale add-on', 'Priority rendering'],
    introMonthlyPrice: 4499,
    introDurationMonths: 3,
  },
  studio: {
    name: 'Studio',
    monthlyPrice: 19900,   // $199.00
    annualPrice: 143280,   // $119/mo × 12 = $1,428/yr — save 40%
    credits: 30000,
    coins: 30000,
    reelsCap: 30000,
    modelTiers: ['standard', 'pro', 'cinematic'] as string[],
    autoPostPlatforms: ['instagram', 'tiktok', 'youtube', 'x'],
    features: ['30,000 credits / month', 'All 150+ voices + cloning (Q3 2026)', 'All quality tiers', 'Priority rendering', 'White-label exports', 'Dedicated support'],
    introMonthlyPrice: 9900,
    introDurationMonths: 3,
  },
} as const;

export type PlanTier = keyof typeof PLANS;
export type BillingInterval = 'monthly' | 'annual';

export const PLAN_ORDER: PlanTier[] = ['starter', 'creator', 'pro', 'studio'];

// ── Legacy slug mapping (grandfathered users) ────────────────────
// Maps OLD DB slugs from Phase 5 to the new canonical tier keys.
// Users who signed up under the old plan names keep their OLD tier
// name + OLD price (contractual). New users see only the new names.
export const LEGACY_SLUG_MAP: Record<string, PlanTier> = {
  starter: 'starter',
  pro: 'creator',      // old 'Pro' $39.99 → now sold as 'Creator' $34.99
  premium: 'pro',      // old 'Premium' $89.99 → now sold as 'Pro' $79.99
  agency: 'studio',    // old 'Agency' $199 → now sold as 'Studio' $199
};

export const LEGACY_DISPLAY: Record<string, { name: string; monthlyPrice: number }> = {
  starter: { name: 'Starter', monthlyPrice: 1999 },
  pro: { name: 'Pro', monthlyPrice: 3999 },
  premium: { name: 'Premium', monthlyPrice: 8999 },
  agency: { name: 'Agency', monthlyPrice: 19900 },
};

/** Resolve a potentially-legacy DB slug to the canonical tier key. */
export function resolveSlug(dbSlug: string): PlanTier | null {
  if (dbSlug in PLANS) return dbSlug as PlanTier;
  return LEGACY_SLUG_MAP[dbSlug] ?? null;
}

/** Check if a DB slug is a legacy (old naming) slug. */
export function isLegacySlug(dbSlug: string): boolean {
  return !!(LEGACY_DISPLAY[dbSlug] && !(dbSlug in PLANS));
}

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
// Agency has NO trial — uses 30-day money-back guarantee instead.
export const TRIAL_CONFIG: Partial<Record<PlanTier, { coins: number; duration: number; modelTier: string }>> = {
  starter: { coins: 8,   duration: 10, modelTier: 'standard' },
  creator: { coins: 40,  duration: 10, modelTier: 'pro' },
  pro:     { coins: 170, duration: 10, modelTier: 'cinematic' },
};

// Annual billing is 40% off the monthly rate.
export function annualPerMonth(tier: PlanTier) {
  return Math.round(PLANS[tier].annualPrice / 12);
}
export const ANNUAL_DISCOUNT_PCT = 40;

/** Annual savings in cents for a given tier. */
export function annualSavingsCents(tier: PlanTier): number {
  return PLANS[tier].monthlyPrice * 12 - PLANS[tier].annualPrice;
}

// ── Founders’ Launch Promo (first 90 days) ───────────────────────
// Applies to ANNUAL billing for ALL tiers. Deeper than the standard
// 20% annual discount (33–38% off). A founder keeps their discounted
// annual rate on every renewal. After Day 90 the pricing auto-reverts
// to the standard 20% annual discount for new subscribers.
export const LAUNCH_DATE = new Date('2026-06-07T00:00:00Z');
export const FOUNDERS_DURATION_DAYS = 90;

/** Founders’ ANNUAL price (cents/year) per tier. */
export const FOUNDERS_ANNUAL_PRICE: Record<PlanTier, number> = {
  starter: 10788,   // $107.88/yr → $8.99/mo (same as standard annual — 40% off $14.99)
  creator: 25188,   // $251.88/yr → $20.99/mo (40% off $34.99)
  pro:     57588,   // $575.88/yr → $47.99/mo (40% off $79.99)
  studio:  143280,  // $1,428/yr  → $119/mo   (40% off $199)
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

// ── Coin bundles (one-time purchases, stack on subscription, never expire) ──
// Top-up credit packs (one-time, never expire, active subscribers only).
export const TOPUP_PACKS = [
  { id: 'topup-1000',  label: 'Mini Pack',   credits: 1000,   price: 1499,   popular: false },
  { id: 'topup-3000',  label: 'Plus Pack',   credits: 3000,   price: 3999,   popular: true },
  { id: 'topup-8000',  label: 'Power Pack',  credits: 8000,   price: 9999,   popular: false },
  { id: 'topup-20000', label: 'Studio Pack', credits: 20000,  price: 19900,  popular: false },
] as const;

// Legacy alias for backward compat (old coin bundles).
export const COIN_BUNDLES = TOPUP_PACKS;

// Free tier: registration + dashboard + 7s watermarked preview.
export const FREE_PREVIEW_CAP = 1;
export const FREE_TRIAL_CAP = FREE_PREVIEW_CAP;

export function savePct(full: number, intro: number) {
  return Math.round(((full - intro) / full) * 100);
}

export function premiumSavePct() {
  const yearly = PLANS.studio.monthlyPrice * 12;
  const proYearly = PLANS.pro.monthlyPrice * 12;
  return Math.round(((proYearly * 2 - yearly) / (proYearly * 2)) * 100);
}

// Per-coin economics — used by admin/margin reporting.
export function cheapestPerCoinCents() {
  return Math.min(...COIN_BUNDLES.map((b) => b.price / b.credits));
}
