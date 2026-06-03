export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST() {
  // Stripe webhook stub — will process real webhooks when STRIPE_WEBHOOK_SECRET is set
  return NextResponse.json({ received: true });
}
