export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { PLANS, type PlanTier, isFoundersPeriod, FOUNDERS_ANNUAL_PRICE } from '@/lib/pricing';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { tier, useIntro } = body ?? {};
  const billing = body?.billing === 'annual' ? 'annual' : 'monthly';
  const wantsTrial = body?.trial === true;

  if (!tier || !['starter', 'creator', 'pro', 'studio', 'premium', 'agency'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }
  // Map legacy tier slugs to new canonical keys
  const tierMap: Record<string, string> = { premium: 'pro', agency: 'studio' };
  const resolvedTier = tierMap[tier] ?? tier;

  // Trial-start guards (only when a free trial is being requested):
  if (wantsTrial) {
    // 1) Email-verification gate — a trial may not begin until the email is verified.
    //    (Users CAN still explore the configurator unverified; only checkout is gated.)
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
    if (!me?.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before starting your free trial. Check your inbox or resend the link from Settings.', code: 'email_unverified' },
        { status: 403 },
      );
    }
    // 2) Anti-abuse: cap trial-start attempts per IP (2 per 24h).
    const ip = getClientIp(request);
    if (ip) {
      const rl = await consumeRateLimit('trial-checkout', ip, 2, DAY_MS);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too many trial attempts from this network today. Please try again later.', code: 'rate_limited', retryAfterSec: rl.retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
        );
      }
    }
  }

  const plan = PLANS[resolvedTier as PlanTier];
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

  // One-trial-per-user: reject if trial already used.
  if (wantsTrial && sub?.trialUsed) {
    return NextResponse.json({ error: 'You have already used your free trial. Choose a plan to subscribe.', code: 'trial_already_used' }, { status: 400 });
  }

  // Determine price and trial. Intro offers only apply to monthly billing.
  const isAnnual = billing === 'annual';
  const isIntro = !isAnnual && useIntro && !sub?.introUsed;
  const interval = isAnnual ? ('year' as const) : ('month' as const);
  // Founders' Launch Promo: deeper annual pricing during the launch window,
  // Founders' pricing: Stripe keeps the subscription's price on renewal.
  const isFounders = isAnnual && isFoundersPeriod();
  const annualAmount = isFounders
    ? FOUNDERS_ANNUAL_PRICE[resolvedTier as PlanTier]
    : plan.annualPrice;
  const unitAmount = isAnnual
    ? annualAmount
    : (isIntro ? plan.introMonthlyPrice : plan.monthlyPrice);

  // Build checkout session params
  const applyTrial = wantsTrial && !sub?.trialUsed;
  const params: any = {
    mode: 'subscription' as const,
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `ManifestReel AI ${plan.name}`,
          description: `${plan.credits.toLocaleString()} credits/month • billed ${isAnnual ? (isFounders ? "annually (Founders' pricing)" : 'annually') : 'monthly'}${isIntro ? ' (introductory offer)' : ''}${applyTrial ? ' • 3-day free trial' : ''}`,
        },
        unit_amount: unitAmount,
        recurring: { interval },
      },
      quantity: 1,
    }],
    success_url: `${origin}/dashboard?upgraded=${resolvedTier}&session_id={CHECKOUT_SESSION_ID}${applyTrial ? '&trial=1' : ''}`,
    cancel_url: `${origin}/dashboard`,
    metadata: { userId, tier: resolvedTier, isIntro: isIntro ? 'true' : 'false', billing, isFounders: isFounders ? 'true' : 'false', isTrial: applyTrial ? 'true' : 'false' },
    subscription_data: {
      metadata: { userId, tier: resolvedTier, isIntro: isIntro ? 'true' : 'false', billing, isFounders: isFounders ? 'true' : 'false' },
      ...(applyTrial ? { trial_period_days: 3 } : {}),
    },
  };

  const checkoutSession = await stripe.checkout.sessions.create(params);

  return NextResponse.json({ url: checkoutSession.url });
}