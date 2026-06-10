// ── Model tier picker ──────────────────────────────────────────
// Three quality tiers map onto different AI video + image models. Each tier
// carries the fal.ai model ids + measured per-second pricing so the pipeline
// and the cost dashboard stay honest about unit economics.
//
//   Standard  → Kling 2.5 Turbo (standard) + Flux 1.1 Pro
//   Pro       → Kling 2.5 Turbo Pro        + Flux 1.1 Pro Ultra
//   Cinematic → Veo 3 Fast + Flux 1.1 Pro Ultra + Luma Ray 2 (b-roll)
//
// Coin costs are now duration-based: see REEL_COIN_COSTS in lib/pricing.ts.
// The `coinCost` field here is the *base display cost* (15s default) shown
// in the tier picker UI. Actual cost is computed at generation time.

import type { PlanTier } from '@/lib/pricing';
import { REEL_COIN_COSTS } from '@/lib/pricing';

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
  /** Base display coin cost (15s reel) shown in tier picker. */
  coinCost: number;
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
    tagline: 'Cinematic Ken Burns stills for everyday reels',
    videoModel: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
    videoPricePerSec: 0.05,
    imageModel: 'fal-ai/flux-pro/v1.1',
    imagePricePerImage: 0.04,
    coinCost: REEL_COIN_COSTS['standard']?.[15] ?? 10,
    minSubscription: 'starter',
    sampleVideoUrl: '/showcase/dream.mp4',
    samplePoster: '/showcase/dream-poster.jpg',
    // Standard = AI stills + continuous Ken Burns motion (pan + drift). No
    // generative video clips — those start at Pro (hybrid) / Cinematic (all-motion).
    features: ['Flux 1.1 Pro AI stills', 'Cinematic Ken Burns motion', 'Synced captions & voice', 'Great for daily posting'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Sharper detail & richer cinematic motion',
    videoModel: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    videoPricePerSec: 0.07,
    imageModel: 'fal-ai/flux-pro/v1.1-ultra',
    imagePricePerImage: 0.06,
    coinCost: REEL_COIN_COSTS['pro']?.[15] ?? 70,
    minSubscription: 'starter',
    sampleVideoUrl: '/showcase/wealth.mp4',
    samplePoster: '/showcase/wealth-poster.jpg',
    features: ['Kling 2.5 Turbo Pro motion', 'Animated hero scenes + stills', 'Flux 1.1 Pro Ultra stills', 'Best for hero content'],
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
    coinCost: REEL_COIN_COSTS['cinematic']?.[15] ?? 250,
    minSubscription: 'pro',
    sampleVideoUrl: '/showcase/selflove.mp4',
    samplePoster: '/showcase/selflove-poster.jpg',
    features: ['Google Veo 3 Fast — every scene animated', 'Flux 1.1 Pro Ultra stills', 'Luma Ray 2 b-roll', '100% all-motion AI video'],
  },
};

export const MODEL_TIER_LIST: ModelTier[] = [MODEL_TIERS.standard, MODEL_TIERS.pro, MODEL_TIERS.cinematic];

export const DEFAULT_MODEL_TIER: ModelTierId = 'standard';

/** Which model tiers a subscription tier can access. */
export function modelTierAccess(subTier?: string | null): ModelTierId[] {
  switch (subTier) {
    case 'agency':  return ['standard', 'pro', 'cinematic'];
    case 'premium': return ['standard', 'pro', 'cinematic'];
    case 'pro':     return ['standard', 'pro', 'cinematic'];
    case 'starter': return ['standard', 'pro'];
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

/**
 * Plain-language summary of exactly which AI models a tier uses, for the studio
 * "This reel will use: …" transparency line (Fix D).
 */
export function tierModelSummary(id?: string | null): string {
  switch ((id ?? '').toLowerCase()) {
    case 'cinematic':
      return 'Veo 3 Fast (every scene animated) + Flux 1.1 Pro Ultra stills';
    case 'pro':
      return 'Kling 2.5 Turbo Pro (animated hero scenes) + Flux 1.1 Pro Ultra stills';
    case 'standard':
    default:
      return 'Flux 1.1 Pro AI stills with cinematic Ken Burns motion';
  }
}

/** Custom music upload slots per subscription tier. */
export function customMusicSlots(subTier?: string | null): number {
  switch (subTier) {
    case 'agency':  return 10;
    case 'premium': return 5;
    case 'pro':     return 3;
    case 'starter': return 1;
    default: return 0;
  }
}

// ---- Music library capabilities by subscription tier (Phase 3) ----
export interface MusicCapabilities {
  /** Browse and pick from the full curated library. */
  canBrowse: boolean;
  /** Click "Regenerate match" to get a fresh AI-matched alternate. */
  canRegenerate: boolean;
  /** Save tracks as favorites for quick reuse. */
  canFavorite: boolean;
  /** Bulk-download license sheet for all library tracks. */
  canBulkLicense: boolean;
  /** Human label of the gate reason when browse is locked. */
  lockedReason: string | null;
}

/**
 * Resolve music capabilities. During an active trial the user is treated as a
 * restricted (free-level) browser regardless of the underlying plan tier, per
 * the product rule "Free + Trial = AI auto-matched only, no manual browse".
 */
export function musicCapabilities(subTier?: string | null, isTrialing?: boolean): MusicCapabilities {
  const effective = isTrialing ? 'free' : (subTier ?? 'free');
  switch (effective) {
    case 'agency':
      return { canBrowse: true, canRegenerate: true, canFavorite: true, canBulkLicense: true, lockedReason: null };
    case 'premium':
      return { canBrowse: true, canRegenerate: true, canFavorite: true, canBulkLicense: false, lockedReason: null };
    case 'pro':
      return { canBrowse: true, canRegenerate: true, canFavorite: false, canBulkLicense: false, lockedReason: null };
    case 'starter':
      return { canBrowse: true, canRegenerate: false, canFavorite: false, canBulkLicense: false, lockedReason: null };
    default:
      return {
        canBrowse: false, canRegenerate: false, canFavorite: false, canBulkLicense: false,
        lockedReason: isTrialing
          ? 'During your trial, music is AI-matched to your mood. Upgrade to browse the full library.'
          : 'Music is AI-matched to your mood. Upgrade to Starter to browse the full library.',
      };
  }
}
