import { prisma } from '@/lib/prisma';

/**
 * Durable, DB-backed fixed-window rate limiter.
 *
 * Why DB-backed and not in-memory: the app runs as stateless server instances,
 * so an in-memory Map would reset on every cold start and would NOT be shared
 * across concurrent instances. Persisting the counter in the database makes the
 * limit hold across restarts and instances. The cost is one upsert per check,
 * which is negligible for the low-frequency endpoints we guard (signup, trial
 * checkout, generation cooldown).
 *
 * Each (bucket, identifier) pair owns one row. We use a FIXED window: the first
 * hit stamps windowStart; subsequent hits within `windowMs` increment the
 * counter; once the window lapses the next hit resets it.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Current count within the active window (after this hit if allowed). */
  count: number;
  limit: number;
  /** Seconds until the window resets and the caller may retry. */
  retryAfterSec: number;
}

/**
 * Consume one unit against a rate-limit bucket.
 *
 * @param bucket      logical limit name (e.g. "signup")
 * @param identifier  the thing being limited (IP address or userId)
 * @param limit       max allowed hits within the window
 * @param windowMs    window length in milliseconds
 */
export async function consumeRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  // Defensive: if we can't identify the caller, don't hard-block them (fail open
  // for missing IP) — better to allow than to lock out everyone behind a proxy
  // that strips headers. Callers should pass a stable identifier where possible.
  if (!identifier) {
    return { allowed: true, count: 0, limit, retryAfterSec: 0 };
  }

  try {
    const existing = await prisma.rateLimit.findUnique({
      where: { bucket_identifier: { bucket, identifier } },
    });

    // No prior record, or the previous window has fully lapsed -> start fresh.
    if (!existing || now - existing.windowStart.getTime() >= windowMs) {
      await prisma.rateLimit.upsert({
        where: { bucket_identifier: { bucket, identifier } },
        create: { bucket, identifier, windowStart: new Date(now), count: 1 },
        update: { windowStart: new Date(now), count: 1 },
      });
      return { allowed: true, count: 1, limit, retryAfterSec: 0 };
    }

    const windowEnds = existing.windowStart.getTime() + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((windowEnds - now) / 1000));

    // Within the active window and already at/over the limit -> block.
    if (existing.count >= limit) {
      return { allowed: false, count: existing.count, limit, retryAfterSec };
    }

    // Within the window and under the limit -> increment and allow.
    const updated = await prisma.rateLimit.update({
      where: { bucket_identifier: { bucket, identifier } },
      data: { count: { increment: 1 } },
    });
    return { allowed: true, count: updated.count, limit, retryAfterSec };
  } catch (e) {
    // Fail open on infrastructure errors: a transient DB hiccup must never make
    // core flows (signup/checkout/generate) unusable. We log for visibility.
    console.warn('[rate-limit] check failed, failing open:', (e as any)?.message);
    return { allowed: true, count: 0, limit, retryAfterSec: 0 };
  }
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || null;
}
