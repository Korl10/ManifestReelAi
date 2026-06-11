/**
 * Phase 5C: Create all Stripe products + prices for V2 pricing.
 * Run with: npx tsx scripts/create-stripe-products.ts
 *
 * Creates:
 *   - 4 subscription products (Starter, Creator, Pro, Studio)
 *   - 8 recurring prices (monthly + annual per product)
 *   - 4 one-time top-up prices
 *   - Total: 16 price IDs
 *
 * All in TEST mode. Reports IDs for env var storage.
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' as any });

interface PlanDef {
  key: string;
  name: string;
  description: string;
  monthlyCents: number;
  annualTotalCents: number;
  credits: number;
  voiceTier: string;
  maxQuality: string;
  maxDurationSeconds: number;
  maxResolution: string;
}

const PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'ManifestReel AI Starter — 1,500 credits/mo, 10 voices, Standard quality',
    monthlyCents: 1499,
    annualTotalCents: 10788, // $107.88
    credits: 1500,
    voiceTier: 'starter',
    maxQuality: 'standard',
    maxDurationSeconds: 30,
    maxResolution: '1080p',
  },
  {
    key: 'creator',
    name: 'Creator',
    description: 'ManifestReel AI Creator — 4,000 credits/mo, 30 voices, Pro quality',
    monthlyCents: 3499,
    annualTotalCents: 25188, // $251.88
    credits: 4000,
    voiceTier: 'creator',
    maxQuality: 'pro',
    maxDurationSeconds: 30,
    maxResolution: '1080p',
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'ManifestReel AI Pro — 10,000 credits/mo, 150+ voices, Cinematic quality',
    monthlyCents: 7999,
    annualTotalCents: 57588, // $575.88
    credits: 10000,
    voiceTier: 'pro',
    maxQuality: 'cinematic',
    maxDurationSeconds: 30,
    maxResolution: '4k',
  },
  {
    key: 'studio',
    name: 'Studio',
    description: 'ManifestReel AI Studio — 30,000 credits/mo, all voices + cloning, Cinematic quality',
    monthlyCents: 19900,
    annualTotalCents: 143280, // $1,432.80
    credits: 30000,
    voiceTier: 'studio',
    maxQuality: 'cinematic',
    maxDurationSeconds: 30,
    maxResolution: '4k',
  },
];

interface TopupDef {
  key: string;
  name: string;
  credits: number;
  priceCents: number;
  popular: boolean;
}

const TOPUPS: TopupDef[] = [
  { key: 'topup_1k', name: 'Mini Pack — 1,000 credits', credits: 1000, priceCents: 1499, popular: false },
  { key: 'topup_3k', name: 'Plus Pack — 3,000 credits', credits: 3000, priceCents: 3999, popular: true },
  { key: 'topup_8k', name: 'Power Pack — 8,000 credits', credits: 8000, priceCents: 9999, popular: false },
  { key: 'topup_20k', name: 'Studio Pack — 20,000 credits', credits: 20000, priceCents: 19900, popular: false },
];

async function main() {
  console.log('\n═══ ManifestReel AI — Stripe V2 Product Creation ═══\n');

  const results: { envKey: string; priceId: string; label: string }[] = [];

  // Create subscription products + prices
  for (const plan of PLANS) {
    console.log(`\n┌─ Creating product: ${plan.name}`);
    const product = await stripe.products.create({
      name: `ManifestReel AI ${plan.name}`,
      description: plan.description,
      metadata: {
        plan_key: plan.key,
        pricing_version: 'v2',
        credits_granted: String(plan.credits),
        voice_tier: plan.voiceTier,
        max_quality: plan.maxQuality,
      },
    });
    console.log(`│  Product: ${product.id}`);

    // Monthly price
    const monthly = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: plan.monthlyCents,
      recurring: { interval: 'month' },
      metadata: {
        plan_key: plan.key,
        billing: 'monthly',
        pricing_version: 'v2',
        credits_granted: String(plan.credits),
        voice_tier: plan.voiceTier,
        max_quality: plan.maxQuality,
        max_duration_seconds: String(plan.maxDurationSeconds),
        max_resolution: plan.maxResolution,
      },
    });
    console.log(`│  Monthly: ${monthly.id} ($${(plan.monthlyCents / 100).toFixed(2)}/mo)`);
    results.push({
      envKey: `STRIPE_PRICE_${plan.key.toUpperCase()}_MONTHLY`,
      priceId: monthly.id,
      label: `${plan.name} Monthly $${(plan.monthlyCents / 100).toFixed(2)}/mo`,
    });

    // Annual price
    const annual = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: plan.annualTotalCents,
      recurring: { interval: 'year' },
      metadata: {
        plan_key: plan.key,
        billing: 'annual',
        pricing_version: 'v2',
        credits_granted: String(plan.credits),
        voice_tier: plan.voiceTier,
        max_quality: plan.maxQuality,
        max_duration_seconds: String(plan.maxDurationSeconds),
        max_resolution: plan.maxResolution,
      },
    });
    console.log(`└  Annual:  ${annual.id} ($${(plan.annualTotalCents / 100).toFixed(2)}/yr)`);
    results.push({
      envKey: `STRIPE_PRICE_${plan.key.toUpperCase()}_ANNUAL`,
      priceId: annual.id,
      label: `${plan.name} Annual $${(plan.annualTotalCents / 100).toFixed(2)}/yr`,
    });
  }

  // Create top-up product + prices
  console.log('\n┌─ Creating top-up product');
  const topupProduct = await stripe.products.create({
    name: 'ManifestReel AI Credit Top-up',
    description: 'One-time credit top-up pack for ManifestReel AI',
    metadata: { pricing_version: 'v2', type: 'topup' },
  });
  console.log(`│  Product: ${topupProduct.id}`);

  for (const topup of TOPUPS) {
    const price = await stripe.prices.create({
      product: topupProduct.id,
      currency: 'usd',
      unit_amount: topup.priceCents,
      metadata: {
        topup_key: topup.key,
        pricing_version: 'v2',
        credits_granted: String(topup.credits),
        popular: String(topup.popular),
      },
    });
    console.log(`│  ${topup.name}: ${price.id} ($${(topup.priceCents / 100).toFixed(2)})`);
    results.push({
      envKey: `STRIPE_PRICE_${topup.key.toUpperCase()}`,
      priceId: price.id,
      label: `${topup.name} $${(topup.priceCents / 100).toFixed(2)}`,
    });
  }
  console.log('└  Done');

  // Output env vars
  console.log('\n═══ ENV VARS TO ADD ═══\n');
  for (const r of results) {
    console.log(`${r.envKey}=${r.priceId}`);
  }

  console.log('\n═══ PRICE ID TABLE ═══\n');
  console.log('| Env Key | Price ID | Label |');
  console.log('|---------|----------|-------|');
  for (const r of results) {
    console.log(`| ${r.envKey} | ${r.priceId} | ${r.label} |`);
  }

  console.log('\n✓ All 16 prices created in TEST mode.');
}

main().catch(console.error);
