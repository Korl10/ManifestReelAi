export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { PLANS, BUNDLE_EXPIRY_MONTHS } from '@/lib/pricing';
import Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  // If webhook secret is set, verify signature; otherwise parse raw (dev/test)
  if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err?.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    event = JSON.parse(body) as Stripe.Event;
  }

  console.log(`[Stripe Webhook] ${event.type}`);

  try {
    switch (event.type) {
      // ======= SUBSCRIPTION CREATED / UPDATED =======
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          console.warn('No userId in subscription metadata, looking up by customerId');
          const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
          if (!sub) { console.error('Cannot find user for customer', customerId); break; }
          await handleSubscriptionUpdate(sub.userId, subscription);
        } else {
          await handleSubscriptionUpdate(userId, subscription);
        }
        break;
      }

      // ======= SUBSCRIPTION CANCELLED =======
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { tier: 'free', status: 'cancelled', stripeSubscriptionId: null, cancelAtPeriodEnd: false },
          });
          console.log(`[Webhook] Subscription cancelled for user ${sub.userId}`);
        }
        break;
      }

      // ======= PAYMENT FAILED =======
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id;
        if (customerId) {
          const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'past_due' },
            });
            console.log(`[Webhook] Payment failed for user ${sub.userId}`);
          }
        }
        break;
      }

      // ======= CHECKOUT COMPLETED (coin purchases + subscriptions) =======
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const meta = checkoutSession.metadata ?? {};

        // Handle coin purchase
        if (meta.type === 'coin_purchase' && meta.userId) {
          const purchase = await prisma.coinPurchase.findFirst({
            where: { stripeSessionId: checkoutSession.id, status: 'pending' },
          });
          if (purchase) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + BUNDLE_EXPIRY_MONTHS);
            await prisma.coinPurchase.update({
              where: { id: purchase.id },
              data: { status: 'completed', coinsRemaining: purchase.reelsAdded, expiresAt },
            });
            console.log(`[Webhook] Coin purchase completed: ${purchase.reelsAdded} coins for user ${meta.userId} (expires ${expiresAt.toISOString()})`);
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error('[Webhook] Error processing event:', err?.message);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionUpdate(userId: string, subscription: Stripe.Subscription) {
  const tier = subscription.metadata?.tier || 'pro';
  const isIntro = subscription.metadata?.isIntro === 'true';
  const plan = PLANS[tier as keyof typeof PLANS] ?? PLANS.pro;

  // Map Stripe status
  let status = 'active';
  if (subscription.status === 'canceled') status = 'cancelled';
  else if (subscription.status === 'past_due') status = 'past_due';
  else if (subscription.status === 'trialing') status = 'active'; // trial counts as active

  const periodStart = new Date((subscription as any).current_period_start * 1000);
  const periodEnd = new Date((subscription as any).current_period_end * 1000);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier,
      status,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
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
      stripeSubscriptionId: subscription.id,
      trialUsed: subscription.status === 'trialing' || !!subscription.trial_end,
      introUsed: isIntro ? true : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // Create/update usage counter for this period
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

  console.log(`[Webhook] Subscription updated: user=${userId} tier=${tier} status=${status}`);
}
