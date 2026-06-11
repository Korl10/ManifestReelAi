/**
 * Trial Reel Constraints
 * ============================================================
 * Server-side enforcement of trial reel limitations.
 * All constraints are IMMUTABLE for trial reels.
 *
 * Hard limits:
 *   - duration: 5 seconds (only option)
 *   - resolution: 720p
 *   - quality: standard (Veo 3 LOCKED)
 *   - watermark: burned into video
 *   - voices: limited by plan tier (starter subset)
 *   - craft presets: disabled
 *   - music: auto-matched from curated only
 *   - subtitles: basic only
 */

import { PRICING_V2_ENABLED, voiceAccess, type PlanTierV2 } from '@/lib/pricing-v2';

export interface TrialReelConfig {
  durationSeconds: 5;
  resolution: '720p';
  qualityTier: 'standard';
  watermarkBurned: true;
  craftPresetsEnabled: false;
  musicMode: 'auto_curated';
  subtitlesAdvanced: false;
}

/** The immutable trial reel configuration. */
export const TRIAL_REEL_CONFIG: TrialReelConfig = {
  durationSeconds: 5,
  resolution: '720p',
  qualityTier: 'standard',
  watermarkBurned: true,
  craftPresetsEnabled: false,
  musicMode: 'auto_curated',
  subtitlesAdvanced: false,
};

/** Validate and enforce trial reel parameters server-side. */
export function enforceTrialConstraints(params: {
  durationSeconds?: number;
  resolution?: string;
  qualityTier?: string;
  motion?: boolean;
  voiceId?: string;
  planTier?: PlanTierV2;
}): {
  enforced: TrialReelConfig;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (params.durationSeconds && params.durationSeconds !== 5) {
    warnings.push(`Duration forced to 5s (requested ${params.durationSeconds}s)`);
  }
  if (params.resolution && params.resolution !== '720p') {
    warnings.push(`Resolution forced to 720p (requested ${params.resolution})`);
  }
  if (params.qualityTier && params.qualityTier !== 'standard') {
    warnings.push(`Quality forced to Standard (requested ${params.qualityTier})`);
  }

  // Voice gating
  if (params.voiceId && params.planTier) {
    const access = voiceAccess(params.planTier, params.voiceId);
    if (access.locked) {
      warnings.push(`Voice ${params.voiceId} requires ${access.requiredTierName} plan`);
    }
  }

  return {
    enforced: TRIAL_REEL_CONFIG,
    warnings,
  };
}

/** Check if a reel is a trial reel and should be watermarked. */
export function isTrialReel(reel: { watermarked?: boolean; tier?: string | null }): boolean {
  return reel.watermarked === true;
}

/**
 * Trial re-render: when user upgrades, their trial reel should be
 * re-rendered without the watermark. This returns the params needed
 * for the re-render job.
 */
export function getReRenderParams(reelId: string) {
  return {
    reelId,
    removeWatermark: true,
    // Keep all other params identical to original
    preserveOriginal: true,
  };
}
