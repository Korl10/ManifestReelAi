/**
 * ManifestReel AI — V2 Credit Grant / Debit Engine
 * ============================================================
 * All credit mutations go through this module so every change is
 * recorded in the CreditLedger for auditability.
 *
 * Gated behind PRICING_V2 flag — callers must check before invoking.
 */

import { prisma } from '@/lib/prisma';
import { PLANS_V2, type PlanTierV2 } from '@/lib/pricing-v2';

// ── Types ────────────────────────────────────────────────────────
export type LedgerType =
  | 'PLAN_GRANT'
  | 'TOPUP'
  | 'PRORATION_GRANT'
  | 'REEL_DEBIT'
  | 'MIGRATION'
  | 'REFUND';

interface GrantOpts {
  userId: string;
  amount: number;
  type: LedgerType;
  description?: string;
  subscriptionId?: string;
  stripeEventId?: string;
}

// ── Idempotent credit grant ──────────────────────────────────────
/**
 * Grant (or debit) credits with ledger entry.
 * If `stripeEventId` is provided, deduplicates — a second call with
 * the same stripeEventId is a no-op (returns false).
 */
export async function grantCredits(opts: GrantOpts): Promise<boolean> {
  // Dedup guard: skip if already processed for this Stripe event
  if (opts.stripeEventId) {
    const existing = await prisma.creditLedger.findFirst({
      where: { stripeEventId: opts.stripeEventId, type: opts.type },
    });
    if (existing) {
      console.log(`[credits-v2] SKIP duplicate: type=${opts.type} event=${opts.stripeEventId}`);
      return false;
    }
  }

  // Atomic: increment balance + write ledger entry in a transaction
  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId: opts.userId },
      data: { creditBalance: { increment: opts.amount } },
    }),
    prisma.creditLedger.create({
      data: {
        userId: opts.userId,
        amount: opts.amount,
        type: opts.type,
        description: opts.description ?? null,
        subscriptionId: opts.subscriptionId ?? null,
        stripeEventId: opts.stripeEventId ?? null,
      },
    }),
  ]);

  console.log(
    `[credits-v2] ${opts.amount > 0 ? 'GRANT' : 'DEBIT'} ${opts.amount} credits: ` +
    `user=${opts.userId} type=${opts.type}${opts.stripeEventId ? ` event=${opts.stripeEventId}` : ''}`
  );
  return true;
}

// ── Plan credit grant (monthly cycle) ────────────────────────────
/**
 * Grant the full monthly credit allotment for a paid plan.
 * Idempotent per Stripe event.
 */
export async function grantPlanCredits(
  userId: string,
  tier: PlanTierV2,
  stripeEventId: string,
  subscriptionId?: string,
): Promise<boolean> {
  const plan = PLANS_V2[tier];
  if (!plan) {
    console.warn(`[credits-v2] Unknown tier: ${tier}`);
    return false;
  }
  return grantCredits({
    userId,
    amount: plan.credits,
    type: 'PLAN_GRANT',
    description: `${plan.name} monthly credit grant (${plan.credits.toLocaleString()} credits)`,
    subscriptionId,
    stripeEventId,
  });
}

// ── Proration credit grant (upgrade mid-cycle) ───────────────────
/**
 * When a user upgrades mid-cycle, grant the credit difference between
 * the new plan and the old plan, prorated by remaining days.
 */
export async function grantProrationCredits(
  userId: string,
  oldTier: PlanTierV2,
  newTier: PlanTierV2,
  remainingDaysRatio: number, // 0..1 fraction of billing period remaining
  stripeEventId: string,
  subscriptionId?: string,
): Promise<boolean> {
  const oldCredits = PLANS_V2[oldTier]?.credits ?? 0;
  const newCredits = PLANS_V2[newTier]?.credits ?? 0;
  const diff = newCredits - oldCredits;
  if (diff <= 0) return false; // not an upgrade

  const prorated = Math.round(diff * remainingDaysRatio);
  if (prorated <= 0) return false;

  return grantCredits({
    userId,
    amount: prorated,
    type: 'PRORATION_GRANT',
    description: `Upgrade ${PLANS_V2[oldTier]?.name} → ${PLANS_V2[newTier]?.name}: +${prorated} prorated credits (${Math.round(remainingDaysRatio * 100)}% cycle remaining)`,
    subscriptionId,
    stripeEventId,
  });
}

// ── Top-up credit grant ──────────────────────────────────────────
export async function grantTopupCredits(
  userId: string,
  credits: number,
  packLabel: string,
  stripeEventId: string,
): Promise<boolean> {
  return grantCredits({
    userId,
    amount: credits,
    type: 'TOPUP',
    description: `${packLabel} top-up (${credits.toLocaleString()} credits)`,
    stripeEventId,
  });
}

// ── Debit credits for reel generation ────────────────────────────
export async function debitReelCredits(
  userId: string,
  amount: number,
  reelDescription: string,
): Promise<boolean> {
  return grantCredits({
    userId,
    amount: -amount, // negative = debit
    type: 'REEL_DEBIT',
    description: reelDescription,
  });
}

// ── Read current balance ─────────────────────────────────────────
export async function getCreditBalance(userId: string): Promise<number> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { creditBalance: true },
  });
  return sub?.creditBalance ?? 0;
}

// ── Map Stripe price ID → V2 tier + billing ─────────────────────
const PRICE_TIER_MAP: Record<string, { tier: PlanTierV2; billing: 'monthly' | 'annual' }> = {};

// Build from env vars at module load
(function buildPriceMap() {
  const entries: [string, PlanTierV2, 'monthly' | 'annual'][] = [
    ['STRIPE_PRICE_STARTER_MONTHLY', 'starter', 'monthly'],
    ['STRIPE_PRICE_STARTER_ANNUAL', 'starter', 'annual'],
    ['STRIPE_PRICE_CREATOR_MONTHLY', 'creator', 'monthly'],
    ['STRIPE_PRICE_CREATOR_ANNUAL', 'creator', 'annual'],
    ['STRIPE_PRICE_PRO_MONTHLY', 'pro', 'monthly'],
    ['STRIPE_PRICE_PRO_ANNUAL', 'pro', 'annual'],
    ['STRIPE_PRICE_STUDIO_MONTHLY', 'studio', 'monthly'],
    ['STRIPE_PRICE_STUDIO_ANNUAL', 'studio', 'annual'],
  ];
  for (const [envKey, tier, billing] of entries) {
    const priceId = process.env[envKey];
    if (priceId) PRICE_TIER_MAP[priceId] = { tier, billing };
  }
})();

export function tierFromPriceId(priceId: string): { tier: PlanTierV2; billing: 'monthly' | 'annual' } | null {
  return PRICE_TIER_MAP[priceId] ?? null;
}

// ── Map Stripe price ID → Topup credits ─────────────────────────
const TOPUP_PRICE_MAP: Record<string, { credits: number; label: string }> = {};

(function buildTopupMap() {
  const entries: [string, number, string][] = [
    ['STRIPE_PRICE_TOPUP_1K', 1000, 'Mini Pack'],
    ['STRIPE_PRICE_TOPUP_3K', 3000, 'Plus Pack'],
    ['STRIPE_PRICE_TOPUP_8K', 8000, 'Power Pack'],
    ['STRIPE_PRICE_TOPUP_20K', 20000, 'Studio Pack'],
  ];
  for (const [envKey, credits, label] of entries) {
    const priceId = process.env[envKey];
    if (priceId) TOPUP_PRICE_MAP[priceId] = { credits, label };
  }
})();

export function topupFromPriceId(priceId: string): { credits: number; label: string } | null {
  return TOPUP_PRICE_MAP[priceId] ?? null;
}
