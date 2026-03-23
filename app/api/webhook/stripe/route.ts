// /api/webhook/stripe — handles Stripe webhook events to finalize bids.
//
// STRIPE CONNECT FLOW (payment_intent.succeeded):
// 1. Verify the webhook signature using the PLATFORM webhook secret
//    (STRIPE_WEBHOOK_SECRET env var) — one secret for all creators.
// 2. Log the event with a timestamp.
// 3. Extract creator_id from payment_intent metadata.
// 4. Call the atomic `process_bid_and_update_podium` stored procedure, which:
//    a. Inserts the bid (idempotent — ON CONFLICT DO NOTHING on stripe_payment_intent_id).
//    b. Rebuilds podium_spots atomically (DELETE + ranked INSERT, top 10).
// 5. Return 200 to Stripe immediately.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import type { CheckoutMetadata } from '@/types';

// Validate env at import time
void env;

function ts(): string {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  if (!sig) {
    console.error(`[${ts()}] Webhook: missing stripe-signature header`);
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // --- Verify signature with the platform webhook secret ---
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`[${ts()}] Webhook: STRIPE_WEBHOOK_SECRET is not configured`);
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(`[${ts()}] Webhook: signature verification failed:`, err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Log every received event with a timestamp
  console.log(`[${ts()}] Webhook received: ${event.type} | id=${event.id}`);

  // Only handle payment_intent.succeeded
  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const paymentIntent  = event.data.object as Stripe.PaymentIntent;
  const metadata       = paymentIntent.metadata as unknown as CheckoutMetadata;

  if (!metadata?.creator_id) {
    console.error(`[${ts()}] Webhook: missing creator_id in metadata for ${paymentIntent.id}`);
    return NextResponse.json({ error: 'Missing creator_id in metadata' }, { status: 400 });
  }

  const amountCents     = parseInt(metadata.amount_cents, 10);
  const fanHandle       = metadata.fan_handle;
  const fanAvatarUrl    = metadata.fan_avatar_url || null;
  const message         = metadata.message || null;
  const creatorId       = metadata.creator_id;
  const paymentIntentId = paymentIntent.id;

  // --- Atomic bid insert + podium rebuild via stored procedure ---
  // The function handles idempotency internally via ON CONFLICT DO NOTHING
  // on stripe_payment_intent_id, so duplicate Stripe deliveries are safe.
  const { error: rpcError } = await supabaseAdmin.rpc('process_bid_and_update_podium', {
    p_creator_id:    creatorId,
    p_fan_handle:    fanHandle,
    p_avatar:        fanAvatarUrl ?? '',
    p_message:       message ?? '',
    p_amount:        amountCents,
    p_stripe_intent: paymentIntentId,
  });

  if (rpcError) {
    console.error(`[${ts()}] Webhook: RPC failed:`, rpcError);
    return NextResponse.json({ error: 'Failed to process bid' }, { status: 500 });
  }

  console.log(
    `[${ts()}] Webhook: bid processed — ${fanHandle} paid $${(amountCents / 100).toFixed(2)} ` +
    `on creator=${creatorId} pi=${paymentIntentId}`
  );

  return NextResponse.json({ received: true });
}
