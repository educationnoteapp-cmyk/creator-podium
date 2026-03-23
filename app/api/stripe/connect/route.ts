// /api/stripe/connect — Stripe Connect OAuth flow for creator onboarding.
//
// GET  /api/stripe/connect          → redirect to Stripe Connect OAuth URL
// GET  /api/stripe/connect?code=xxx → exchange code, save stripe_account_id
//
// Flow:
//   1. Creator clicks "Connect Stripe" in the dashboard.
//   2. Client calls GET /api/stripe/connect (no code param).
//   3. Server builds a Stripe Connect OAuth URL with client_id and redirects.
//   4. Creator authorises on Stripe, then Stripe redirects back to:
//      /api/stripe/connect?code=<auth_code>&state=<creator_id>
//   5. Server exchanges code for access_token, extracts stripe_user_id (acct_xxx),
//      stores it in creators.stripe_account_id, and redirects to /dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { env } from '@/lib/env';

// Validate env at import time
void env;

const STRIPE_CLIENT_ID      = process.env.STRIPE_CLIENT_ID!;
const STRIPE_CONNECT_SCOPES = 'read_write';

// Validation patterns
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Stripe OAuth authorization codes always begin with "ac_"
const STRIPE_CODE_RE = /^ac_[a-zA-Z0-9]+$/;

export async function GET(req: NextRequest) {
  // ── Rate limit: 3 requests per IP per minute ─────────────────────────────
  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`stripe-connect:${ip}`, 3, 10_000);
  if (!rl.success) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/dashboard?stripe_connect=error&reason=too_many_requests`
    );
  }

  const { searchParams, origin } = req.nextUrl;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');   // creator_id passed as OAuth state
  const error = searchParams.get('error');

  // ── Step 4+5: OAuth callback — exchange code for account ID ──────────────
  if (code && state) {
    // Validate code format: Stripe auth codes always start with "ac_"
    if (!STRIPE_CODE_RE.test(code)) {
      return NextResponse.redirect(
        `${origin}/dashboard?stripe_connect=error&reason=invalid_code`
      );
    }

    // CSRF protection: validate state is a well-formed UUID before any DB query
    if (!UUID_RE.test(state)) {
      return NextResponse.redirect(
        `${origin}/dashboard?stripe_connect=error&reason=invalid_state`
      );
    }

    // Verify the callback belongs to the currently authenticated user.
    // Without this check, a CSRF attack could associate a Stripe account
    // with a creator the attacker doesn't own by crafting a callback URL
    // with an arbitrary state (creator_id).
    const supabaseCallback = createClient();
    const { data: { session: callbackSession } } = await supabaseCallback.auth.getSession();

    if (!callbackSession) {
      return NextResponse.redirect(`${origin}/login`);
    }

    // Confirm the creator in state belongs to the authenticated user
    const { data: ownerCheck } = await supabaseAdmin
      .from('creators')
      .select('id')
      .eq('id', state)
      .eq('auth_user_id', callbackSession.user.id)
      .maybeSingle();

    if (!ownerCheck) {
      return NextResponse.redirect(
        `${origin}/dashboard?stripe_connect=error&reason=unauthorized_state`
      );
    }

    try {
      // Exchange authorization code for the connected account token
      const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
      });

      const stripeAccountId = response.stripe_user_id;
      if (!stripeAccountId) {
        return NextResponse.redirect(
          `${origin}/dashboard?stripe_connect=error&reason=no_account_id`
        );
      }

      // Persist the connected account ID on the creator row
      const { error: updateError } = await supabaseAdmin
        .from('creators')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', state);

      if (updateError) {
        console.error('Failed to save stripe_account_id:', updateError);
        return NextResponse.redirect(
          `${origin}/dashboard?stripe_connect=error&reason=db_update_failed`
        );
      }

      return NextResponse.redirect(`${origin}/dashboard?stripe_connect=success`);
    } catch (err) {
      console.error('Stripe OAuth token exchange failed:', err);
      return NextResponse.redirect(
        `${origin}/dashboard?stripe_connect=error&reason=token_exchange_failed`
      );
    }
  }

  // ── Step 2: User cancelled on Stripe side ─────────────────────────────────
  if (error) {
    return NextResponse.redirect(
      `${origin}/dashboard?stripe_connect=cancelled`
    );
  }

  // ── Step 2: Initiate OAuth flow ───────────────────────────────────────────
  // Require the creator to be authenticated so we can pass their ID as state
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Look up the creator row to get the creator ID for the state param
  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.redirect(
      `${origin}/dashboard?stripe_connect=error&reason=no_creator_row`
    );
  }

  if (!STRIPE_CLIENT_ID) {
    console.error('STRIPE_CLIENT_ID is not configured');
    return NextResponse.redirect(
      `${origin}/dashboard?stripe_connect=error&reason=not_configured`
    );
  }

  // Build Stripe Connect OAuth URL
  const redirectUri = `${origin}/api/stripe/connect`;
  const connectUrl  = new URL('https://connect.stripe.com/oauth/authorize');
  connectUrl.searchParams.set('response_type', 'code');
  connectUrl.searchParams.set('client_id',     STRIPE_CLIENT_ID);
  connectUrl.searchParams.set('scope',         STRIPE_CONNECT_SCOPES);
  connectUrl.searchParams.set('redirect_uri',  redirectUri);
  connectUrl.searchParams.set('state',         creator.id); // passed back in callback

  return NextResponse.redirect(connectUrl.toString());
}
