// POST /api/dashboard/seed/edit
//
// Updates a single seeded bid's fan_handle, message, and fan_avatar_url.
// Only works on bids whose stripe_payment_intent_id starts with "pi_seed_".
// Also syncs the matching row in podium_spots (if one exists).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('[seed/edit] POST called');

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      bidId?: string;
      fanHandle?: string;
      message?: string;
      fanAvatarUrl?: string | null;
    };

    const { bidId, fanHandle, message, fanAvatarUrl } = body;

    if (!bidId) {
      return NextResponse.json({ error: 'bidId is required' }, { status: 400 });
    }

    // Resolve creator for this user
    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (creatorError) {
      return NextResponse.json({ error: creatorError.message }, { status: 500 });
    }
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Verify the bid belongs to this creator
    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('id, stripe_payment_intent_id')
      .eq('id', bidId)
      .eq('creator_id', creator.id)
      .maybeSingle();

    if (bidError) {
      return NextResponse.json({ error: bidError.message }, { status: 500 });
    }
    if (!bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    // Guard: only allow editing seeded bids
    if (!bid.stripe_payment_intent_id.startsWith('pi_seed_')) {
      return NextResponse.json({ error: 'Can only edit seeded bids' }, { status: 403 });
    }

    const updates = {
      fan_handle: fanHandle ?? '',
      message: message ?? null,
      fan_avatar_url: fanAvatarUrl ?? null,
    };

    // Update bids table
    const { error: bidUpdateError } = await supabaseAdmin
      .from('bids')
      .update(updates)
      .eq('id', bidId);

    if (bidUpdateError) {
      console.error('[seed/edit] Bid update error:', bidUpdateError.message);
      return NextResponse.json({ error: bidUpdateError.message }, { status: 500 });
    }

    // Sync podium_spots if a matching row exists (best-effort, no error on miss)
    const { error: spotError } = await supabaseAdmin
      .from('podium_spots')
      .update(updates)
      .eq('stripe_payment_intent_id', bid.stripe_payment_intent_id)
      .eq('creator_id', creator.id);

    if (spotError) {
      console.warn('[seed/edit] podium_spots update skipped:', spotError.message);
    }

    console.log('[seed/edit] Updated bid:', bidId);
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[seed/edit] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
