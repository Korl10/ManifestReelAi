export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { applySubscriptionUpdate } from '@/lib/stripe-sync';
import { sendTrialEndingEmail } from '@/lib/email-trial';
import { PRICING_V2_ENABLED, PLANS_V2, type PlanTierV2, planRank, PLAN_ORDER_V2 } from '@/lib/pricing-v2';
import { grantPlanCredits, grantProrationCredits, grantTopupCredits, tierFromPriceId, topupFromPriceId } from '@/lib/credits-v2';
import { sendWelcomeEmail, sendPaymentFailedEmail, sendCancellationEmail, sendDisputeAlertEmail } from '@/lib/email-subscription';
import { updateTrialOutcome } from '@/lib/trial-gates';
import Stripe from 'stripe';

const GRACE_DAYS = 3;

// ── Idempotency wrapper ──────────────────────────────────────────────────
async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: eventId },
  });
  return !!existing?.processedAt;
}

async function markProcessing(eventId: string, eventType: string, payload: any): Promise<void> {
  await prisma.webhookEvent.upsert({
    where: { stripeEventId: eventId },
    create: { stripeEventId: eventId, eventType, payload },
    update: {},
  });
}

async function markProcessed(eventId: string, error?: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      processedAt: new Date(),
      ...(error ? { processingError: error } : {}),
    },
  });
}

// ── Helper: look up user from Stripe customer ID ─────────────────────────
async function userFromCustomer(customerId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  if (!sub) return null;
  const user = await prisma.user.findUnique({
    where: { id: sub.userId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

// ── Helper: extract customer ID string ───────────────────────────────────
function customerId(obj: any): string {
  const c = obj?.customer;
  return typeof c === 'string' ? c : c?.id ?? '';
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  // Verify webhook signature (skip in dev if no secret)
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

  console.log(`[Stripe Webhook] ${event.type} id=${event.id}`);

  // ── Idempotency check ────────────────────────────────────────────────
  if (await isAlreadyProcessed(event.id)) {
    console.log(`[Webhook] SKIP duplicate event ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Mark as in-progress (upsert so retries don't fail)
  await markProcessing(event.id, event.type, event.data.object);

  let processingError: string | undefined;

  try {
    switch (event.type) {
      // ═══════════════════════════════════════════════════════════════
      // SUBSCRIPTION CREATED / UPDATED
      // ═══════════════════════════════════════════════════════════════
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const cid = customerId(subscription);
        const userId = subscription.metadata?.userId;

        // Apply subscription update (legacy coin system — always runs)
        if (!userId) {
          console.warn('No userId in subscription metadata, looking up by customerId');
          const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } });
          if (!sub) { console.error('Cannot find user for customer', cid); break; }
          await applySubscriptionUpdate(sub.userId, subscription);
        } else {
          await applySubscriptionUpdate(userId, subscription);
        }

        // ── V2: Handle upgrade proration ──────────────────────────────
        if (PRICING_V2_ENABLED && event.type === 'customer.subscription.updated') {
          const prevAttrs = (event.data as any).previous_attributes;
          const resolvedUserId = userId ?? (await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } }))?.userId;

          if (resolvedUserId && prevAttrs?.items) {
            // Price changed → potential upgrade/downgrade
            const oldPriceId = prevAttrs.items?.data?.[0]?.price?.id;
            const newPriceId = subscription.items?.data?.[0]?.price?.id;

            if (oldPriceId && newPriceId && oldPriceId !== newPriceId) {
              const oldInfo = tierFromPriceId(oldPriceId);
              const newInfo = tierFromPriceId(newPriceId);

              if (oldInfo && newInfo) {
                const isUpgrade = planRank(newInfo.tier) > planRank(oldInfo.tier);
                const isDowngrade = planRank(newInfo.tier) < planRank(oldInfo.tier);

                if (isUpgrade) {
                  // Grant prorated credits immediately
                  const item = subscription.items?.data?.[0] as any;
                  const periodEnd = item?.current_period_end ?? (subscription as any).current_period_end;
                  const now = Math.floor(Date.now() / 1000);
                  const periodLength = 30 * 24 * 60 * 60; // approximate
                  const remaining = periodEnd ? Math.max(0, (periodEnd - now) / periodLength) : 0.5;

                  await grantProrationCredits(
                    resolvedUserId,
                    oldInfo.tier,
                    newInfo.tier,
                    Math.min(remaining, 1),
                    event.id,
                    subscription.id,
                  );
                  // Clear any scheduled downgrade
                  await prisma.subscription.update({
                    where: { userId: resolvedUserId },
                    data: { scheduledTier: null },
                  });
                  console.log(`[Webhook V2] Upgrade ${oldInfo.tier} → ${newInfo.tier} for user ${resolvedUserId}`);
                } else if (isDowngrade) {
                  // Schedule downgrade for next billing cycle
                  await prisma.subscription.update({
                    where: { userId: resolvedUserId },
                    data: { scheduledTier: newInfo.tier },
                  });
                  console.log(`[Webhook V2] Downgrade scheduled: ${oldInfo.tier} → ${newInfo.tier} for user ${resolvedUserId}`);
                }
              }
            }
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // TRIAL ENDING SOON (24h notice)
      // ═══════════════════════════════════════════════════════════════
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const cid = customerId(subscription);
        const localSub = await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } });
        if (localSub) {
          const user = await prisma.user.findUnique({ where: { id: localSub.userId }, select: { email: true, name: true } });
          if (user?.email) {
            const sent = await sendTrialEndingEmail(user.email, user.name, localSub.tier);
            console.log(`[Webhook] trial_will_end → reminder email ${sent ? 'sent' : 'skipped'} for user ${localSub.userId}`);
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // SUBSCRIPTION CANCELLED
      // ═══════════════════════════════════════════════════════════════
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const cid = customerId(subscription);
        const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } });
        if (sub) {
          const tierBefore = sub.tier;
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              tier: 'free',
              status: 'cancelled',
              stripeSubscriptionId: null,
              cancelAtPeriodEnd: false,
              scheduledTier: null,
            },
          });
          console.log(`[Webhook] Subscription cancelled for user ${sub.userId}`);

          // V2: Update trial outcome + send cancellation email
          if (PRICING_V2_ENABLED) {
            const user = await prisma.user.findUnique({
              where: { id: sub.userId },
              select: { email: true, name: true },
            });
            if (user?.email) {
              await updateTrialOutcome(user.email, 'CANCELLED').catch(() => {});
              const planName = (PLANS_V2 as any)[tierBefore]?.name ?? tierBefore;
              await sendCancellationEmail(user.email, user.name, planName);
            }
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // INVOICE PAYMENT SUCCEEDED (credit grant trigger)
      // ═══════════════════════════════════════════════════════════════
      case 'invoice.payment_succeeded': {
        if (!PRICING_V2_ENABLED) break; // V2 only

        const invoice = event.data.object as any; // Stripe Invoice type varies by API version
        const cid = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!cid) break;

        const user = await userFromCustomer(cid);
        if (!user) { console.warn(`[Webhook] No user for customer ${cid}`); break; }

        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        // Determine if this is a subscription renewal or initial payment
        if (subId) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(subId);
            const priceId = stripeSub.items?.data?.[0]?.price?.id;
            if (!priceId) break;

            const tierInfo = tierFromPriceId(priceId);
            if (!tierInfo) {
              console.log(`[Webhook V2] Unknown price ${priceId} — skipping credit grant`);
              break;
            }

            // Check if this was a trial → paid conversion
            const localSub = await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } });
            const wasTrialing = localSub?.trialEndsAt && localSub.trialEndsAt.getTime() > Date.now() - 24 * 60 * 60 * 1000;

            // Grant monthly credits
            const granted = await grantPlanCredits(
              user.id,
              tierInfo.tier,
              event.id,
              subId,
            );

            if (granted && wasTrialing) {
              // Trial → Paid conversion!
              console.log(`[Webhook V2] Trial → Paid conversion for user ${user.id}`);

              // Update trial outcome
              if (user.email) {
                await updateTrialOutcome(user.email, 'CONVERTED').catch(() => {});
              }

              // Send welcome email
              const planName = PLANS_V2[tierInfo.tier]?.name ?? tierInfo.tier;
              const credits = PLANS_V2[tierInfo.tier]?.credits ?? 0;
              if (user.email) {
                await sendWelcomeEmail(user.email, user.name, planName, credits);
              }

              // Trigger watermark removal on trial reels
              await triggerWatermarkRemoval(user.id);
            }

            // Apply any scheduled downgrade at renewal
            if (localSub?.scheduledTier) {
              const newTier = localSub.scheduledTier as PlanTierV2;
              if (PLAN_ORDER_V2.includes(newTier)) {
                await prisma.subscription.update({
                  where: { userId: user.id },
                  data: { tier: newTier, scheduledTier: null },
                });
                console.log(`[Webhook V2] Applied scheduled downgrade to ${newTier} for user ${user.id}`);
              }
            }
          } catch (e: any) {
            console.error(`[Webhook V2] Error processing payment_succeeded:`, e?.message);
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // PAYMENT FAILED
      // ═══════════════════════════════════════════════════════════════
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const cid = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id;
        if (cid) {
          const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: cid } });
          if (sub) {
            // Start (or keep) a 3-day grace window
            const graceEndsAt = sub.graceEndsAt && sub.graceEndsAt.getTime() > Date.now()
              ? sub.graceEndsAt
              : new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'past_due', graceEndsAt },
            });
            console.log(`[Webhook] Payment failed for user ${sub.userId} — grace until ${graceEndsAt.toISOString()}`);

            // V2: Send payment failed email
            if (PRICING_V2_ENABLED) {
              const user = await prisma.user.findUnique({
                where: { id: sub.userId },
                select: { email: true, name: true },
              });
              if (user?.email) {
                await sendPaymentFailedEmail(user.email, user.name);
              }
            }
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // CHECKOUT COMPLETED (coin purchases + subscriptions)
      // ═══════════════════════════════════════════════════════════════
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const meta = checkoutSession.metadata ?? {};

        // Subscription checkout: activate immediately
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

        // Legacy coin purchase
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

        // V2 top-up purchase
        if (PRICING_V2_ENABLED && meta.type === 'topup_v2' && meta.userId) {
          const priceId = meta.priceId;
          if (priceId) {
            const topup = topupFromPriceId(priceId);
            if (topup) {
              await grantTopupCredits(meta.userId, topup.credits, topup.label, event.id);
              console.log(`[Webhook V2] Top-up: ${topup.credits} credits for user ${meta.userId}`);
            }
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // CHARGE DISPUTE CREATED
      // ═══════════════════════════════════════════════════════════════
      case 'charge.dispute.created': {
        if (!PRICING_V2_ENABLED) break; // V2 only

        const dispute = event.data.object as Stripe.Dispute;
        const charge = typeof dispute.charge === 'string'
          ? await stripe.charges.retrieve(dispute.charge)
          : dispute.charge as Stripe.Charge;

        const cid = typeof charge.customer === 'string' ? charge.customer : (charge.customer as any)?.id;
        if (!cid) break;

        const user = await userFromCustomer(cid);
        if (!user) break;

        // Suspend account
        await prisma.subscription.update({
          where: { userId: user.id },
          data: { status: 'suspended' },
        });

        // Block card fingerprint permanently
        const localSub = await prisma.subscription.findUnique({
          where: { userId: user.id },
          select: { cardFingerprint: true },
        });
        if (localSub?.cardFingerprint) {
          // Mark this fingerprint as permanently blocked in the BlockedDomain model
          // (we repurpose the domain/reason fields for card blocks)
          await prisma.blockedDomain.upsert({
            where: { domain: `card:${localSub.cardFingerprint}` },
            create: { domain: `card:${localSub.cardFingerprint}`, source: 'dispute_block', reason: `dispute:${dispute.id}:${user.email}` },
            update: { reason: `dispute:${dispute.id}:${user.email}` },
          });
        }

        // Send admin alert
        await sendDisputeAlertEmail(
          user.email ?? 'unknown',
          dispute.amount ?? 0,
          dispute.id,
        );

        console.log(`[Webhook V2] DISPUTE: user=${user.id} amount=${dispute.amount} dispute=${dispute.id} — SUSPENDED`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    processingError = err?.message ?? 'Unknown error';
    console.error('[Webhook] Error processing event:', processingError);
  }

  // Mark as processed (with or without error)
  await markProcessed(event.id, processingError).catch((e) => {
    console.error('[Webhook] Failed to mark event processed:', (e as any)?.message);
  });

  return NextResponse.json({ received: true });
}

// ── Watermark removal trigger ────────────────────────────────────────────
// When a trial user converts to paid, queue re-render of their trial reels
// without the watermark. This is a best-effort background operation.
async function triggerWatermarkRemoval(userId: string) {
  try {
    // Find trial reels that have watermark
    const trialReels = await prisma.reel.findMany({
      where: {
        userId,
        watermarked: true,
        status: 'ready',
      },
      select: { id: true },
      take: 5, // limit to first 5 trial reels
    });

    if (trialReels.length === 0) {
      console.log(`[Webhook V2] No watermarked reels to re-render for user ${userId}`);
      return;
    }

    // Mark reels for re-render (the render pipeline will pick them up)
    for (const reel of trialReels) {
      await prisma.reel.update({
        where: { id: reel.id },
        data: {
          watermarked: false,
          // Keep status 'ready' — the frontend will show the reel without
          // watermark since the video URL is unchanged; the watermark was an
          // overlay applied at render time. For true re-render we'd need a
          // background job, but for MVP the overlay removal is sufficient.
          // status stays 'ready'
        },
      });
    }

    console.log(`[Webhook V2] Queued ${trialReels.length} trial reels for watermark removal for user ${userId}`);
  } catch (e: any) {
    // Non-fatal — user can manually re-generate if this fails
    console.error(`[Webhook V2] Watermark removal trigger failed for user ${userId}:`, e?.message);
  }
}
