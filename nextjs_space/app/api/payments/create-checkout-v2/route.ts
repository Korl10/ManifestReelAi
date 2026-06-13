export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { PRICING_V2_ENABLED, PLANS_V2, type PlanTierV2, PLAN_ORDER_V2, TOPUP_PACKS } from '@/lib/pricing-v2';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Stripe Price ID maps (from env) ──────────────────────────────────
function getSubPriceId(tier: PlanTierV2, billing: 'monthly' | 'annual'): string | undefined {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${billing.toUpperCase()}`;
  return process.env[key];
}

function getTopupPriceId(packId: string): string | undefined {
  const map: Record<string, string> = {
    'topup-1000': process.env.STRIPE_PRICE_TOPUP_1K ?? '',
    'topup-3000': process.env.STRIPE_PRICE_TOPUP_3K ?? '',
    'topup-8000': process.env.STRIPE_PRICE_TOPUP_8K ?? '',
    'topup-20000': process.env.STRIPE_PRICE_TOPUP_20K ?? '',
  };
  return map[packId] || undefined;
}

export async function POST(request: Request) {
  // Gate: only available when V2 is enabled
  if (!PRICING_V2_ENABLED) {
    return NextResponse.json({ error: 'V2 pricing not enabled' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;

  const body = await request.json();
  const { mode } = body; // 'subscription' | 'topup'

  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Get or create Stripe customer
  let sub = await prisma.subscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    sub = await prisma.subscription.upsert({
      where: { userId },
      create: { userId, tier: 'free', status: 'active', stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  // ═══ SUBSCRIPTION CHECKOUT ═══
  if (mode === 'subscription') {
    const tier = body.tier as PlanTierV2;
    const billing = body.billing === 'annual' ? 'annual' as const : 'monthly' as const;
    const wantsTrial = body.trial === true;

    if (!PLAN_ORDER_V2.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Trial guards
    if (wantsTrial) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
      if (!me?.emailVerified) {
        return NextResponse.json(
          { error: 'Please verify your email before starting your free trial.', code: 'email_unverified' },
          { status: 403 },
        );
      }
      const ip = getClientIp(request);
      if (ip) {
        const rl = await consumeRateLimit('trial-checkout-v2', ip, 2, DAY_MS);
        if (!rl.allowed) {
          return NextResponse.json(
            { error: 'Too many trial attempts from this network today.', code: 'rate_limited', retryAfterSec: rl.retryAfterSec },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
          );
        }
      }
    }

    // One-trial-per-user
    if (wantsTrial && sub?.trialUsed) {
      return NextResponse.json(
        { error: 'You have already used your free trial.', code: 'trial_already_used' },
        { status: 400 },
      );
    }

    const priceId = getSubPriceId(tier, billing);
    if (!priceId) {
      return NextResponse.json({ error: 'Price configuration missing' }, { status: 500 });
    }

    const plan = PLANS_V2[tier];
    const applyTrial = wantsTrial && !sub?.trialUsed;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}${applyTrial ? '&trial=1' : ''}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        userId,
        tier,
        billing,
        isTrial: applyTrial ? 'true' : 'false',
        pricingVersion: 'v2',
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          billing,
          pricingVersion: 'v2',
        },
        ...(applyTrial ? { trial_period_days: 3 } : {}),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  // ═══ TOP-UP CHECKOUT ═══
  if (mode === 'topup') {
    // Gate: top-ups require an active paid subscription (no free, no trial, no cancelled/past_due)
    if (!sub || sub.tier === 'free') {
      return NextResponse.json(
        { error: 'Top-up packs are available for active subscribers. Please subscribe first.', code: 'no_subscription' },
        { status: 403 },
      );
    }
    if (sub.status === 'cancelled' || sub.status === 'canceled' || sub.status === 'past_due') {
      return NextResponse.json(
        { error: 'Your subscription is no longer active. Please resubscribe to purchase top-ups.', code: 'subscription_inactive' },
        { status: 403 },
      );
    }
    // Block during trial — keep trial scope tight
    if (sub.trialUsed === false && sub.status === 'trialing') {
      return NextResponse.json(
        { error: 'Top-up packs are available after your trial converts to a paid plan.', code: 'trial_active' },
        { status: 403 },
      );
    }
    // Also check via Stripe if subscription is trialing
    if (sub.stripeSubscriptionId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (stripeSub.status === 'trialing') {
          return NextResponse.json(
            { error: 'Top-up packs are available after your trial converts to a paid plan.', code: 'trial_active' },
            { status: 403 },
          );
        }
        if (stripeSub.status === 'canceled' || stripeSub.status === 'past_due' || stripeSub.status === 'unpaid') {
          return NextResponse.json(
            { error: 'Your subscription is no longer active. Please resubscribe to purchase top-ups.', code: 'subscription_inactive' },
            { status: 403 },
          );
        }
      } catch {
        // Non-fatal — proceed with local checks already done
      }
    }

    const packId = body.packId as string;
    const pack = TOPUP_PACKS.find(p => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: 'Invalid top-up pack' }, { status: 400 });
    }

    const priceId = getTopupPriceId(packId);
    if (!priceId) {
      return NextResponse.json({ error: 'Top-up price configuration missing' }, { status: 500 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?topup=${pack.credits}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        userId,
        type: 'topup_v2',
        packId,
        priceId,
        credits: String(pack.credits),
        pricingVersion: 'v2',
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  return NextResponse.json({ error: 'Invalid mode. Use "subscription" or "topup".' }, { status: 400 });
}
