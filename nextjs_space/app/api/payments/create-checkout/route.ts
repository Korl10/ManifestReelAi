export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { PLANS, type PlanTier } from '@/lib/pricing';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { tier, useIntro } = body ?? {};
  const billing = body?.billing === 'annual' ? 'annual' : 'monthly';

  if (!tier || !['pro', 'premium'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const plan = PLANS[tier as PlanTier];
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

  // Determine price and trial. Intro offers only apply to monthly billing.
  const isAnnual = billing === 'annual';
  const isIntro = !isAnnual && useIntro && !sub?.introUsed;
  const interval = isAnnual ? ('year' as const) : ('month' as const);
  const unitAmount = isAnnual
    ? plan.annualPrice
    : (isIntro ? plan.introMonthlyPrice : plan.monthlyPrice);

  // Build checkout session params
  const params: any = {
    mode: 'subscription' as const,
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `ManifestReel AI ${plan.name}`,
          description: `${plan.reelsCap} reels/month • billed ${isAnnual ? 'annually (50% off)' : 'monthly'}${isIntro ? ' (introductory offer)' : ''}`,
        },
        unit_amount: unitAmount,
        recurring: { interval },
      },
      quantity: 1,
    }],
    success_url: `${origin}/dashboard?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/settings`,
    metadata: { userId, tier, isIntro: isIntro ? 'true' : 'false', billing },
    subscription_data: {
      metadata: { userId, tier, isIntro: isIntro ? 'true' : 'false', billing },
    },
  };

  const checkoutSession = await stripe.checkout.sessions.create(params);

  return NextResponse.json({ url: checkoutSession.url });
}
