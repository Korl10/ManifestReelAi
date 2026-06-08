export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { stripe } from '@/lib/stripe';
import { applySubscriptionUpdate } from '@/lib/stripe-sync';

import { prisma } from '@/lib/prisma';

// Fallback activation: called by the dashboard right after Stripe Checkout
// redirects back with ?session_id=. This guarantees the subscription/coins
// are applied even if the webhook is delayed or not yet configured.
// Idempotent + ownership-checked.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any)?.id;

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = checkout.metadata ?? {};

    // Ownership guard: the checkout session must belong to this user.
    if (meta.userId && meta.userId !== userId) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    // Must be paid (subscriptions) or complete.
    const paid = checkout.payment_status === 'paid' || checkout.payment_status === 'no_payment_required' || checkout.status === 'complete';
    if (!paid) {
      return NextResponse.json({ activated: false, pending: true, message: 'Payment not completed yet.' });
    }

    // Subscription checkout -> activate plan.
    if (checkout.mode === 'subscription' && checkout.subscription) {
      const subId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription.id;
      const fullSub = await stripe.subscriptions.retrieve(subId);
      await applySubscriptionUpdate(userId, fullSub);
      return NextResponse.json({ activated: true, type: 'subscription', tier: meta.tier ?? null });
    }

    // One-time coin purchase -> mark completed if still pending.
    if (meta.type === 'coin_purchase') {
      const purchase = await prisma.coinPurchase.findFirst({
        where: { stripeSessionId: checkout.id, status: 'pending' },
      });
      if (purchase) {
        await prisma.coinPurchase.update({
          where: { id: purchase.id },
          data: { status: 'completed', coinsRemaining: purchase.reelsAdded, expiresAt: null },
        });
      }
      return NextResponse.json({ activated: true, type: 'coin_purchase' });
    }

    return NextResponse.json({ activated: false, message: 'Nothing to activate for this session.' });
  } catch (err: any) {
    console.error('[verify-session] Error:', err?.message);
    return NextResponse.json({ error: 'Failed to verify checkout session' }, { status: 500 });
  }
}
