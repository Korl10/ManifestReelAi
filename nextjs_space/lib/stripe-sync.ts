import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/pricing';
import Stripe from 'stripe';

// Shared subscription sync logic used by BOTH the Stripe webhook and the
// success_url verification fallback. Idempotent: safe to run multiple times
// for the same subscription (upsert + usage-counter reconcile).
export async function applySubscriptionUpdate(userId: string, subscription: Stripe.Subscription) {
  const tier = subscription.metadata?.tier || 'pro';
  const isIntro = subscription.metadata?.isIntro === 'true';
  const plan = PLANS[tier as keyof typeof PLANS] ?? PLANS.pro;

  // Map Stripe status -> our status
  let status = 'active';
  if (subscription.status === 'canceled') status = 'cancelled';
  else if (subscription.status === 'past_due') status = 'past_due';
  else if (subscription.status === 'trialing') status = 'active';
  else if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') status = 'inactive';

  // As of Stripe API 2025-03-31.basil, current_period_start/end were REMOVED
  // from the top-level Subscription and moved onto each subscription item.
  // Read from the item first, fall back to the (legacy) top-level field, then
  // compute a sensible default so the DB write never receives an Invalid Date.
  const item: any = subscription.items?.data?.[0];
  const rawStart = item?.current_period_start ?? (subscription as any).current_period_start ?? (subscription as any).start_date;
  const rawEnd = item?.current_period_end ?? (subscription as any).current_period_end;
  const intervalUnit: 'year' | 'month' =
    item?.price?.recurring?.interval === 'year'
      ? 'year'
      : (subscription.metadata?.billing === 'annual' ? 'year' : 'month');

  const periodStart = (typeof rawStart === 'number' && rawStart > 0)
    ? new Date(rawStart * 1000)
    : new Date();
  let periodEnd: Date;
  if (typeof rawEnd === 'number' && rawEnd > 0) {
    periodEnd = new Date(rawEnd * 1000);
  } else {
    // Fallback: derive end from start + billing interval.
    periodEnd = new Date(periodStart);
    if (intervalUnit === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      trialUsed: subscription.status === 'trialing' || !!subscription.trial_end,
      introUsed: isIntro,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    update: {
      tier,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      trialUsed: subscription.status === 'trialing' || !!subscription.trial_end,
      introUsed: isIntro ? true : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // Reconcile this month's usage counter (sets the coin cap for the tier).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const existing = await prisma.usageCounter.findFirst({
    where: { userId, tier, periodStart: { lte: now }, periodEnd: { gte: now } },
  });

  if (existing) {
    await prisma.usageCounter.update({
      where: { id: existing.id },
      data: { reelsCap: plan.reelsCap },
    });
  } else {
    await prisma.usageCounter.create({
      data: { userId, tier, reelsCap: plan.reelsCap, reelsUsed: 0, periodStart: monthStart, periodEnd: monthEnd },
    });
  }

  console.log(`[StripeSync] Subscription applied: user=${userId} tier=${tier} status=${status}`);
}
