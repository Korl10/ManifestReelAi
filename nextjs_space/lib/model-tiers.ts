// ── Model tier picker ──────────────────────────────────────────
// Three quality tiers map onto different AI video + image models. Each tier
// carries the fal.ai model ids + measured per-second pricing so the pipeline
// and the cost dashboard stay honest about unit economics.
//
//   Standard  → Kling 2.5 Turbo (standard) + Flux 1.1 Pro
//   Pro       → Kling 2.5 Turbo Pro        + Flux 1.1 Pro Ultra
//   Cinematic → Veo 3 Fast + Flux 1.1 Pro Ultra + Luma Ray 2 (b-roll)
//
// COIN cost is what the user actually pays today (kept margin-safe; no
// regression vs the existing flat motion=5). `creditCost` is the Phase-5
// target credit pricing (1 credit = $0.10) shown for transparency.

import type { PlanTier } from '@/lib/pricing';

export type ModelTierId = 'standard' | 'pro' | 'cinematic';

// Subscription tiers that can access each model tier. Current live tiers are
// free / pro / premium; this maps the product roadmap (Starter→Standard,
// Creator→Standard+Pro, Pro+/Studio→all) onto today's tiers.
//   free    → preview only (no live motion)
//   pro     → standard + pro
//   premium → standard + pro + cinematic
export interface ModelTier {
  id: ModelTierId;
  name: string;
  tagline: string;
  /** fal.ai image-to-video model id. */
  videoModel: string;
  /** USD per second of generated video (measured / published fal pricing). */
  videoPricePerSec: number;
  /** fal.ai text-to-image model id. */
  imageModel: string;
  /** USD per generated still. */
  imagePricePerImage: number;
  /** Optional b-roll model (cinematic only). */
  brollModel?: string;
  /** Coins charged for a motion reel at this tier (what users pay today). */
  coinCost: number;
  /** Phase-5 credit cost (informational; 1 credit = $0.10). */
  creditCost: number;
  /** Minimum subscription tier that can select this model tier. */
  minSubscription: PlanTier | 'free';
  /** Sample reel preview (representative placeholder until per-tier samples exist). */
  sampleVideoUrl: string;
  samplePoster: string;
  features: string[];
}

export const MODEL_TIERS: Record<ModelTierId, ModelTier> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'Fast, crisp motion for everyday reels',
    videoModel: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
    videoPricePerSec: 0.05,
    imageModel: 'fal-ai/flux-pro/v1.1',
    imagePricePerImage: 0.04,
    coinCost: 5,
    creditCost: 50,
    minSubscription: 'pro',
    sampleVideoUrl: '/showcase/dream.mp4',
    samplePoster: '/showcase/dream-poster.jpg',
    features: ['Kling 2.5 Turbo', 'Flux 1.1 Pro stills', '5s hero clips', 'Great for daily posting'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Sharper detail & richer cinematic motion',
    videoModel: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    videoPricePerSec: 0.07,
    imageModel: 'fal-ai/flux-pro/v1.1-ultra',
    imagePricePerImage: 0.06,
    coinCost: 12,
    creditCost: 120,
    minSubscription: 'pro',
    sampleVideoUrl: '/showcase/wealth.mp4',
    samplePoster: '/showcase/wealth-poster.jpg',
    features: ['Kling 2.5 Turbo Pro', 'Flux 1.1 Pro Ultra stills', 'Higher fidelity & detail', 'Best for hero content'],
  },
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    tagline: 'Flagship Veo 3 motion with Ray 2 b-roll',
    videoModel: 'fal-ai/veo3/fast/image-to-video',
    videoPricePerSec: 0.25,
    imageModel: 'fal-ai/flux-pro/v1.1-ultra',
    imagePricePerImage: 0.06,
    brollModel: 'fal-ai/luma-dream-machine/ray-2',
    coinCost: 25,
    creditCost: 250,
    minSubscription: 'premium',
    sampleVideoUrl: '/showcase/selflove.mp4',
    samplePoster: '/showcase/selflove-poster.jpg',
    features: ['Google Veo 3 Fast', 'Flux 1.1 Pro Ultra stills', 'Luma Ray 2 b-roll', 'Premium flagship quality'],
  },
};

export const MODEL_TIER_LIST: ModelTier[] = [MODEL_TIERS.standard, MODEL_TIERS.pro, MODEL_TIERS.cinematic];

export const DEFAULT_MODEL_TIER: ModelTierId = 'standard';

/** Which model tiers a subscription tier can access. */
export function modelTierAccess(subTier?: string | null): ModelTierId[] {
  switch (subTier) {
    case 'premium': return ['standard', 'pro', 'cinematic'];
    case 'pro': return ['standard', 'pro'];
    default: return []; // free → preview only, no live motion
  }
}

/** True if a subscription tier may use the given model tier. */
export function canUseModelTier(subTier: string | null | undefined, tierId: ModelTierId): boolean {
  return modelTierAccess(subTier).includes(tierId);
}

/**
 * Resolve a requested model-tier id into a concrete ModelTier, clamped to what
 * the subscription tier can access. Falls back to the best allowed tier, or
 * Standard if the caller has no access yet (defensive default).
 */
export function resolveModelTier(requested: string | null | undefined, subTier: string | null | undefined): ModelTier {
  const allowed = modelTierAccess(subTier);
  const req = (requested ?? '').toLowerCase() as ModelTierId;
  if (req && allowed.includes(req)) return MODEL_TIERS[req];
  if (allowed.length) return MODEL_TIERS[allowed[allowed.length - 1]];
  return MODEL_TIERS[DEFAULT_MODEL_TIER];
}

export function getModelTier(id?: string | null): ModelTier {
  const key = (id ?? '').toLowerCase() as ModelTierId;
  return MODEL_TIERS[key] ?? MODEL_TIERS[DEFAULT_MODEL_TIER];
}

/** Custom music upload slots per subscription tier. Pro = 1, Premium(Studio) = 5. */
export function customMusicSlots(subTier?: string | null): number {
  switch (subTier) {
    case 'premium': return 5;
    case 'pro': return 1;
    default: return 0;
  }
}
