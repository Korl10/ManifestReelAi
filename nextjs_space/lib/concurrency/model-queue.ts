/**
 * Global, in-process per-model concurrency governor (semaphore + queue).
 *
 * WHY THIS EXISTS
 * ---------------
 * The generation pipeline runs fire-and-forget inside a single Node process,
 * and every motion clip ultimately hits ONE shared fal.ai API key. Without a
 * global limiter, a burst of concurrent reels (Stripe activation bursts, an
 * influencer share, etc.) fires dozens of simultaneous fal.ai requests, the key
 * gets rate-limited, and clips fail en masse -> the "cinematic engines busy"
 * cascade we measured (13/15 cinematic failures in one 31-minute window).
 *
 * This module enforces a hard ceiling on concurrent in-flight requests PER
 * MODEL FAMILY (veo3 / kling / flux). Requests beyond the ceiling WAIT in a
 * FIFO queue instead of failing. Callers get their queue position + a live ETA
 * so the UI can show "Rendering — position 3 in queue, ETA ~90s" instead of a
 * silent rate-limit failure.
 *
 * Limits are environment-configurable so we can tune them in production without
 * a redeploy as our fal.ai tier grows.
 *
 * NOTE ON SCALE: this is an in-PROCESS limiter. It is correct for the current
 * single-instance standalone deployment (all generation runs in one process)
 * and matches the fact that the fal.ai key is a single shared resource. If the
 * app is ever scaled horizontally across processes, this must be promoted to a
 * shared store (e.g. Redis / DB advisory locks).
 */

export type ModelFamily = 'veo3' | 'kling' | 'flux';

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Per-family concurrency ceilings (env-overridable). */
export function familyLimit(family: ModelFamily): number {
  switch (family) {
    case 'veo3':  return envInt('QUEUE_LIMIT_VEO3', 2);
    case 'kling': return envInt('QUEUE_LIMIT_KLING', 4);
    case 'flux':  return envInt('QUEUE_LIMIT_FLUX', 6);
    default:      return 2;
  }
}

/** Classify any fal.ai model id into a coarse family for limiting. */
export function modelFamily(model: string): ModelFamily {
  const m = (model || '').toLowerCase();
  if (m.includes('veo3') || m.includes('veo-3')) return 'veo3';
  if (m.includes('flux')) return 'flux';
  return 'kling';
}

interface Waiter {
  resolve: () => void;
  enqueuedAt: number;
}

interface FamilyState {
  family: ModelFamily;
  active: number;
  waiters: Waiter[];
  /** Rolling window of recent task durations (ms) for ETA estimation. */
  recentDurations: number[];
  /** Completed task count since process start (throughput). */
  completed: number;
  /** Timestamps (ms) of completions in the last hour for throughput/hr. */
  completionTimes: number[];
}

const MAX_RECENT = 20;
const DEFAULT_TASK_MS = 60_000; // assume ~60s per clip before we have samples

class ModelQueue {
  private families = new Map<ModelFamily, FamilyState>();

  private state(family: ModelFamily): FamilyState {
    let s = this.families.get(family);
    if (!s) {
      s = { family, active: 0, waiters: [], recentDurations: [], completed: 0, completionTimes: [] };
      this.families.set(family, s);
    }
    return s;
  }

  /** Average recent task duration (ms) for a family, for ETA math. */
  avgTaskMs(family: ModelFamily): number {
    const s = this.state(family);
    if (s.recentDurations.length === 0) return DEFAULT_TASK_MS;
    return s.recentDurations.reduce((a, b) => a + b, 0) / s.recentDurations.length;
  }

  /**
   * Snapshot of how a NEW request would be queued right now, WITHOUT acquiring.
   * Used to show the user an ETA before/while their reel waits.
   */
  previewWait(family: ModelFamily): { position: number; etaMs: number; active: number; limit: number; waiting: number } {
    const s = this.state(family);
    const limit = familyLimit(family);
    const waiting = s.waiters.length;
    // A new request would sit behind everyone currently waiting.
    const position = Math.max(0, s.active - limit) + waiting; // 0 == runs immediately
    const avg = this.avgTaskMs(family);
    // Batches of `limit` clear roughly every avg ms.
    const etaMs = position <= 0 ? 0 : Math.ceil((position + 1) / limit) * avg;
    return { position: Math.max(0, position), etaMs, active: s.active, limit, waiting };
  }

  /**
   * Acquire a slot for `family`. Resolves immediately if under the ceiling,
   * otherwise waits in FIFO order. Returns a release() that MUST be called
   * (in a finally block) when the request completes.
   */
  async acquire(family: ModelFamily): Promise<() => void> {
    const s = this.state(family);
    const limit = familyLimit(family);
    if (s.active < limit) {
      // A slot is free: take it immediately.
      s.active += 1;
    } else {
      // At capacity: wait in FIFO. The RELEASER increments `active` on our
      // behalf right before resolving (direct slot hand-off), so we must NOT
      // increment here — doing so would over-subscribe the family under bursts.
      await new Promise<void>((resolve) => {
        s.waiters.push({ resolve, enqueuedAt: Date.now() });
      });
    }
    const startedAt = Date.now();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const dur = Date.now() - startedAt;
      s.recentDurations.push(dur);
      if (s.recentDurations.length > MAX_RECENT) s.recentDurations.shift();
      s.completed += 1;
      const now = Date.now();
      s.completionTimes.push(now);
      // keep only last hour
      const cutoff = now - 3_600_000;
      while (s.completionTimes.length && s.completionTimes[0] < cutoff) s.completionTimes.shift();
      const next = s.waiters.shift();
      if (next) {
        // Hand the slot straight to the next waiter — `active` stays unchanged
        // (one out, one in) so the ceiling is never exceeded mid-handoff.
        next.resolve();
      } else {
        s.active -= 1;
      }
    };
  }

  /** Live stats for the admin ops dashboard. */
  stats(): Array<{
    family: ModelFamily;
    limit: number;
    active: number;
    queued: number;
    avgTaskSec: number;
    throughputPerHour: number;
    estWaitSec: number;
  }> {
    const out: any[] = [];
    (['veo3', 'kling', 'flux'] as ModelFamily[]).forEach((fam) => {
      const s = this.state(fam);
      const limit = familyLimit(fam);
      const avg = this.avgTaskMs(fam);
      const preview = this.previewWait(fam);
      out.push({
        family: fam,
        limit,
        active: s.active,
        queued: s.waiters.length,
        avgTaskSec: +(avg / 1000).toFixed(1),
        throughputPerHour: s.completionTimes.length,
        estWaitSec: +(preview.etaMs / 1000).toFixed(0),
      });
    });
    return out as any;
  }
}

// Singleton across the process (survives Next.js module reloads in dev).
const g = globalThis as any;
export const modelQueue: ModelQueue = g.__manifestModelQueue ?? (g.__manifestModelQueue = new ModelQueue());
