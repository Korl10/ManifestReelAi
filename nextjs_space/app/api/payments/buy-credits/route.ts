export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { COIN_BUNDLES } from '@/lib/pricing';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;
  const body = await request.json();
  const { bundleId } = body ?? {};

  const bundle = COIN_BUNDLES.find(b => b.id === bundleId);
  if (!bundle) return NextResponse.json({ error: 'Invalid bundle' }, { status: 400 });

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
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, tier: 'free', status: 'active', stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${bundle.label} — ManifestReel AI`,
          description: `${bundle.reels} extra reel credits`,
        },
        unit_amount: bundle.price,
      },
      quantity: 1,
    }],
    success_url: `${origin}/dashboard?coins=purchased`,
    cancel_url: `${origin}/dashboard/settings`,
    metadata: { userId, bundleId: bundle.id, reels: String(bundle.reels), type: 'coin_purchase' },
  });

  // Create pending purchase record
  await prisma.coinPurchase.create({
    data: {
      userId,
      bundleId: bundle.id,
      reelsAdded: bundle.reels,
      amountCents: bundle.price,
      stripeSessionId: checkoutSession.id,
      status: 'pending',
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
