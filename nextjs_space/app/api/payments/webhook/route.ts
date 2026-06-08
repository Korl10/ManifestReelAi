export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { applySubscriptionUpdate } from '@/lib/stripe-sync';
import { sendTrialEndingEmail } from '@/lib/email-trial';
import Stripe from 'stripe';

const GRACE_DAYS = 3;

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
          await applySubscriptionUpdate(sub.userId, subscription);
        } else {
          await applySubscriptionUpdate(userId, subscription);
        }
        break;
      }

      // ======= TRIAL ENDING SOON (24h notice) =======
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const localSub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
        if (localSub) {
          const user = await prisma.user.findUnique({ where: { id: localSub.userId }, select: { email: true, name: true } });
          if (user?.email) {
            const sent = await sendTrialEndingEmail(user.email, user.name, localSub.tier);
            console.log(`[Webhook] trial_will_end → reminder email ${sent ? 'sent' : 'skipped'} for user ${localSub.userId}`);
          }
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
            // Start (or keep) a 3-day grace window: the user keeps their tier and
            // can still generate while we retry the charge. checkGeneration()
            // lazily downgrades to free once graceEndsAt passes.
            const graceEndsAt = sub.graceEndsAt && sub.graceEndsAt.getTime() > Date.now()
              ? sub.graceEndsAt
              : new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'past_due', graceEndsAt },
            });
            console.log(`[Webhook] Payment failed for user ${sub.userId} — grace until ${graceEndsAt.toISOString()}`);
          }
        }
        break;
      }

      // ======= CHECKOUT COMPLETED (coin purchases + subscriptions) =======
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const meta = checkoutSession.metadata ?? {};

        // Subscription checkout: activate immediately (don't wait for the
        // separate customer.subscription.* event, which can lag).
        if (checkoutSession.mode === 'subscription' && meta.userId && checkoutSession.subscription) {
          const subId = typeof checkoutSession.subscription === 'string'
            ? checkoutSession.subscription
            : checkoutSession.subscription.id;
          try {
            const fullSub = await stripe.subscriptions.retrieve(subId);
            await applySubscriptionUpdate(meta.userId, fullSub);
            console.log(`[Webhook] Subscription activated from checkout for user ${meta.userId}`);
          } catch (e: any) {
            console.error('[Webhook] Failed to retrieve subscription from checkout:', e?.message);
          }
        }

        // Handle coin purchase
        if (meta.type === 'coin_purchase' && meta.userId) {
          const purchase = await prisma.coinPurchase.findFirst({
            where: { stripeSessionId: checkoutSession.id, status: 'pending' },
          });
          if (purchase) {
            await prisma.coinPurchase.update({
              where: { id: purchase.id },
              data: { status: 'completed', coinsRemaining: purchase.reelsAdded, expiresAt: null },
            });
            console.log(`[Webhook] Coin purchase completed: ${purchase.reelsAdded} coins for user ${meta.userId} (never expires)`);
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