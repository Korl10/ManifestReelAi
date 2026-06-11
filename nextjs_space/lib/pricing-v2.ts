/**
 * ManifestReel AI — Pricing V2 (Credit-based model)
 * ============================================================
 * This module is the NEW canonical pricing/credit/voice-gating system.
 * It is built in PARALLEL to the legacy coin system (lib/pricing.ts) and is
 * gated behind the PRICING_V2 feature flag (process.env.PRICING_V2 === 'true').
 *
 * Rollout plan (see .project_instructions.md / Phase 5 spec section 10):
 *   1. Ship with PRICING_V2=false (legacy coin model stays live).
 *   2. Run the coin→credit migration as a DRY-RUN, review deltas.
 *   3. Run migration for real, then flip PRICING_V2=true.
 *   4. Remove legacy coin code after a 48h soak.
 *
 * Canonical tier keys: 'starter' | 'creator' | 'pro' | 'studio'
 * Legacy DB tier keys:  'starter' | 'pro'     | 'premium' | 'agency'
 *   (legacyTierMap below maps legacy → canonical for migration.)
 */

export const PRICING_V2_ENABLED = process.env.PRICING_V2 === 'true';

export type PlanTierV2 = 'starter' | 'creator' | 'pro' | 'studio';

/** Canonical plan ordering (low → high). Used for tier-gating comparisons. */
export const PLAN_ORDER_V2: PlanTierV2[] = ['starter', 'creator', 'pro', 'studio'];

export function planRank(tier: PlanTierV2): number {
  return PLAN_ORDER_V2.indexOf(tier);
}

/**
 * Maps the LEGACY DB tier string to the NEW canonical key.
 * Used by the migration (Phase 5F) — NOT for live feature checks until the
 * PRICING_V2 flag flips. Note 'starter' is unchanged.
 */
export const legacyTierMap: Record<string, PlanTierV2> = {
  starter: 'starter',
  pro: 'creator',
  premium: 'pro',
  agency: 'studio',
};

/**
 * For grandfathered users we keep the OLD label + OLD price.
 * Maps the canonical key back to the legacy display label + legacy monthly
 * price (cents) the user originally subscribed at.
 */
export const LEGACY_LABELS: Record<PlanTierV2, { label: string; legacyMonthlyCents: number }> = {
  starter: { label: 'Starter', legacyMonthlyCents: 1999 },   // was $19.99
  creator: { label: 'Pro', legacyMonthlyCents: 3999 },       // 'Creator' was sold as 'Pro' @ $39.99
  pro: { label: 'Premium', legacyMonthlyCents: 8999 },       // 'Pro' was sold as 'Premium' @ $89.99
  studio: { label: 'Agency', legacyMonthlyCents: 19900 },    // 'Studio' was sold as 'Agency' @ $199
};

// ──────────────────────────────────────────────────────────────────────────
// PLANS V2
// ──────────────────────────────────────────────────────────────────────────

export interface PlanV2 {
  id: PlanTierV2;
  name: string;
  /** New-signup monthly price in cents (billed monthly). */
  monthlyCents: number;
  /** Effective per-month price in cents when billed annually (40% off). */
  annualPerMonthCents: number;
  /** Total charged once per year in cents (annualPerMonthCents × 12). */
  annualTotalCents: number;
  /** Monthly credit grant. */
  credits: number;
  /** Number of voices unlocked at this tier (cumulative). */
  voiceCount: number;
  /** Highest reel quality model tier this plan can produce. */
  maxModelTier: ModelQuality;
  /** Whether custom voice cloning is available. */
  voiceCloning: boolean;
  /** 4K upscale add-on available. */
  upscale4k: boolean;
  /** Marketing feature bullets. */
  features: string[];
  highlight?: boolean;
}

export type ModelQuality = 'static' | 'standard' | 'pro' | 'cinematic';

/** Annual discount: 40% off the monthly rate, billed yearly. */
export const ANNUAL_DISCOUNT = 0.4;

function annualPerMonth(monthlyCents: number): number {
  return Math.round(monthlyCents * (1 - ANNUAL_DISCOUNT));
}

export const PLANS_V2: Record<PlanTierV2, PlanV2> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyCents: 1499,
    annualPerMonthCents: annualPerMonth(1499), // 899
    annualTotalCents: annualPerMonth(1499) * 12, // 10788 → $107.88
    credits: 1500,
    voiceCount: 10,
    maxModelTier: 'standard',
    voiceCloning: false,
    upscale4k: false,
    features: [
      '1,500 credits / month',
      '10 premium voices',
      'Up to Standard quality reels',
      '720p & 1080p exports',
      'Auto-matched background music',
    ],
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    monthlyCents: 3499,
    annualPerMonthCents: annualPerMonth(3499), // 2099
    annualTotalCents: annualPerMonth(3499) * 12, // 25188 → $251.88
    credits: 4000,
    voiceCount: 30,
    maxModelTier: 'pro',
    voiceCloning: false,
    upscale4k: false,
    highlight: true,
    features: [
      '4,000 credits / month',
      '30 premium voices',
      'Up to Pro quality reels',
      '1080p exports',
      'Premium music library',
      'Craft brand presets',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyCents: 7999,
    annualPerMonthCents: annualPerMonth(7999), // 4799
    annualTotalCents: annualPerMonth(7999) * 12, // 57588 → $575.88
    credits: 10000,
    voiceCount: 151, // ALL active voices
    maxModelTier: 'cinematic',
    voiceCloning: false,
    upscale4k: true,
    features: [
      '10,000 credits / month',
      'All 150+ premium voices',
      'Up to Cinematic quality reels',
      '4K upscale add-on',
      'Priority rendering',
      'All Craft brand presets',
    ],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    monthlyCents: 19900,
    annualPerMonthCents: annualPerMonth(19900), // 11940
    annualTotalCents: annualPerMonth(19900) * 12, // 143280 → $1,432.80
    credits: 30000,
    voiceCount: 151,
    maxModelTier: 'cinematic',
    voiceCloning: true,
    upscale4k: true,
    features: [
      '30,000 credits / month',
      'All 150+ premium voices',
      'Custom voice cloning',
      'Up to Cinematic quality reels',
      '4K upscale add-on',
      'Highest priority rendering',
      'Dedicated support',
    ],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// CREDIT COST ENGINE
// ──────────────────────────────────────────────────────────────────────────
//
// 1 credit = $0.10 of user value (~$0.02 underlying cost → 5x markup).
// Reel cost = base(quality) × durationMultiplier(seconds) + add-ons.

/** Base credit cost for a 5-second reel, by quality tier. */
export const CREDIT_BASE_COSTS: Record<ModelQuality, number> = {
  static: 15,
  standard: 30,
  pro: 60,
  cinematic: 150,
};

/** Duration multipliers (seconds → factor). 5s is the baseline (1.0). */
export const DURATION_MULTIPLIER: Record<number, number> = {
  5: 1.0,
  10: 2.0,
  15: 3.0,
  25: 5.0,
  30: 6.0,
};

/** Optional add-ons (flat credit surcharge). */
export const ADDONS = {
  premiumVoice: 5,
  premiumMusic: 5,
  upscale4k: 30,
  craftPreset: 0,
} as const;

export interface ReelAddons {
  premiumVoice?: boolean;
  premiumMusic?: boolean;
  upscale4k?: boolean;
  craftPreset?: boolean;
}

/** Nearest supported duration multiplier (defensive for odd values). */
function durationFactor(seconds: number): number {
  if (DURATION_MULTIPLIER[seconds] != null) return DURATION_MULTIPLIER[seconds];
  const keys = Object.keys(DURATION_MULTIPLIER).map(Number).sort((a, b) => a - b);
  let chosen = keys[0];
  for (const k of keys) {
    if (seconds >= k) chosen = k;
  }
  return DURATION_MULTIPLIER[chosen];
}

/**
 * Compute the credit cost of a reel.
 * @example reelCreditCost('pro', 15) === 180  // 60 × 3.0
 */
export function reelCreditCost(
  quality: ModelQuality,
  durationSeconds: number,
  addons: ReelAddons = {},
): number {
  const base = CREDIT_BASE_COSTS[quality];
  const factor = durationFactor(durationSeconds);
  let total = Math.round(base * factor);
  if (addons.premiumVoice) total += ADDONS.premiumVoice;
  if (addons.premiumMusic) total += ADDONS.premiumMusic;
  if (addons.upscale4k) total += ADDONS.upscale4k;
  if (addons.craftPreset) total += ADDONS.craftPreset;
  return total;
}

/** Itemised breakdown for UI display. */
export interface CreditBreakdown {
  base: number;
  durationFactor: number;
  subtotal: number;
  addons: { label: string; credits: number }[];
  total: number;
}

export function reelCreditBreakdown(
  quality: ModelQuality,
  durationSeconds: number,
  addons: ReelAddons = {},
): CreditBreakdown {
  const base = CREDIT_BASE_COSTS[quality];
  const factor = durationFactor(durationSeconds);
  const subtotal = Math.round(base * factor);
  const items: { label: string; credits: number }[] = [];
  if (addons.premiumVoice) items.push({ label: 'Premium voice', credits: ADDONS.premiumVoice });
  if (addons.premiumMusic) items.push({ label: 'Premium music', credits: ADDONS.premiumMusic });
  if (addons.upscale4k) items.push({ label: '4K upscale', credits: ADDONS.upscale4k });
  const total = subtotal + items.reduce((s, i) => s + i.credits, 0);
  return { base, durationFactor: factor, subtotal, addons: items, total };
}

// ──────────────────────────────────────────────────────────────────────────
// TOP-UP PACKS (one-time credit purchases)
// ──────────────────────────────────────────────────────────────────────────

export interface TopupPack {
  id: string;
  label: string;
  credits: number;
  priceCents: number;
  popular?: boolean;
}

export const TOPUP_PACKS: TopupPack[] = [
  { id: 'topup-1000', label: 'Mini Pack', credits: 1000, priceCents: 1499 },
  { id: 'topup-3000', label: 'Plus Pack', credits: 3000, priceCents: 3999, popular: true },
  { id: 'topup-8000', label: 'Power Pack', credits: 8000, priceCents: 9999 },
  { id: 'topup-20000', label: 'Studio Pack', credits: 20000, priceCents: 19900 },
];

// ──────────────────────────────────────────────────────────────────────────
// COIN → CREDIT CONVERSION (one-time migration helper)
// ──────────────────────────────────────────────────────────────────────────
//
// Existing balances are converted at 2.7x value (a thank-you bonus), rounded
// UP to the nearest 10 credits.

export const COIN_TO_CREDIT_RATE = 2.7;

export function coinsToCredits(coins: number): number {
  if (coins <= 0) return 0;
  return Math.ceil((coins * COIN_TO_CREDIT_RATE) / 10) * 10;
}

export const CONVERSION_BANNER =
  '🎉 We upgraded our credits system — your balance has been converted at 2.7x value as a thank-you!';

// ──────────────────────────────────────────────────────────────────────────
// VOICE TIER GATING
// ──────────────────────────────────────────────────────────────────────────
//
// Each voice is assigned a minimum required plan tier. A user on plan X can
// access voices whose requiredTier rank <= X rank. Voice previews remain
// available to everyone (gating only blocks USE in a reel).
//
// Starter: 10 voices. Creator: +20 (30 total). Pro & Studio: ALL.

/** 10 hand-picked Starter voices spanning all categories. */
export const STARTER_VOICE_IDS: string[] = [
  'female-f-01', 'female-f-02',
  'male-m-01', 'male-m-02',
  'mot-m-01',
  'med-m-01',
  'mys-m-01',
  'his-m-01',
  'bib-m-01',
  'edu-m-01',
];

/** +20 additional voices unlocked at Creator (30 total with Starter). */
export const CREATOR_VOICE_IDS: string[] = [
  'female-f-03', 'female-f-04', 'female-f-05', 'female-f-06',
  'male-m-03', 'male-m-04', 'male-m-05', 'male-m-06',
  'mot-m-02', 'mot-m-03',
  'med-m-04', 'med-m-06',
  'mys-m-02', 'mys-m-03',
  'his-m-02', 'his-m-03',
  'bib-m-02', 'bib-m-03',
  'edu-m-02', 'edu-m-03',
];

const STARTER_SET = new Set(STARTER_VOICE_IDS);
const CREATOR_SET = new Set(CREATOR_VOICE_IDS);

/** Minimum plan tier required to USE a given voice in a reel. */
export function voiceTierFor(voiceId: string): PlanTierV2 {
  if (STARTER_SET.has(voiceId)) return 'starter';
  if (CREATOR_SET.has(voiceId)) return 'creator';
  return 'pro'; // everything else requires Pro (and above)
}

export interface VoiceAccess {
  locked: boolean;
  requiredTier: PlanTierV2;
  requiredTierName: string;
}

/** Whether a user on `planTier` can use a given voice. */
export function voiceAccess(planTier: PlanTierV2, voiceId: string): VoiceAccess {
  const required = voiceTierFor(voiceId);
  const locked = planRank(planTier) < planRank(required);
  return { locked, requiredTier: required, requiredTierName: PLANS_V2[required].name };
}

/** Whether a plan can produce a reel of the given quality. */
export function planAllowsQuality(planTier: PlanTierV2, quality: ModelQuality): boolean {
  const order: ModelQuality[] = ['static', 'standard', 'pro', 'cinematic'];
  return order.indexOf(quality) <= order.indexOf(PLANS_V2[planTier].maxModelTier);
}
