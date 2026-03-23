// POST /api/dashboard/seed/edit
//
// Updates a seeded bid's fan_handle, message, fan_avatar_url, and optionally
// amount_paid (in cents).  Only seeded bids (stripe_payment_intent_id starts
// with "seed_") may be edited.
//
// When amount_paid changes the podium_spots table is rebuilt from scratch so
// the leaderboard positions stay correct.

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
      amountCents?: number;
    };

    const { bidId, fanHandle, message, fanAvatarUrl, amountCents } = body;

    if (!bidId) {
      return NextResponse.json({ error: 'bidId is required' }, { status: 400 });
    }

    // Validate amountCents if provided ($5–$50)
    if (amountCents !== undefined) {
      if (!Number.isInteger(amountCents) || amountCents < 500 || amountCents > 5000) {
        return NextResponse.json({ error: 'Amount must be between $5 and $50' }, { status: 400 });
      }
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
      .select('id, stripe_payment_intent_id, amount_paid')
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
    if (!bid.stripe_payment_intent_id.startsWith('seed_')) {
      return NextResponse.json({ error: 'Can only edit seeded bids' }, { status: 403 });
    }

    // Build the update payload
    const bidUpdates: Record<string, unknown> = {
      fan_handle:    fanHandle    ?? '',
      message:       message      ?? null,
      fan_avatar_url: fanAvatarUrl ?? null,
    };

    const amountChanged = amountCents !== undefined && amountCents !== bid.amount_paid;
    if (amountChanged) {
      bidUpdates.amount_paid = amountCents;
    }

    // ── Update bids table ─────────────────────────────────────────────────
    const { error: bidUpdateError } = await supabaseAdmin
      .from('bids')
      .update(bidUpdates)
      .eq('id', bidId);

    if (bidUpdateError) {
      console.error('[seed/edit] Bid update error:', bidUpdateError.message);
      return NextResponse.json({ error: bidUpdateError.message }, { status: 500 });
    }

    // ── Rebuild podium_spots ──────────────────────────────────────────────
    // Always rebuild after any seed edit so positions stay consistent.
    const { data: allBids, error: fetchError } = await supabaseAdmin
      .from('bids')
      .select('id, fan_handle, fan_avatar_url, message, amount_paid, stripe_payment_intent_id')
      .eq('creator_id', creator.id)
      .order('amount_paid', { ascending: false });

    if (fetchError) {
      console.error('[seed/edit] Fetch-all-bids error:', fetchError.message);
      // Non-fatal: bid is updated, podium rebuild failed
      return NextResponse.json({ ok: true, warn: 'Bid saved but podium not rebuilt' });
    }

    // Delete old podium_spots for this creator
    const { error: deleteError } = await supabaseAdmin
      .from('podium_spots')
      .delete()
      .eq('creator_id', creator.id);

    if (deleteError) {
      console.error('[seed/edit] Delete podium_spots error:', deleteError.message);
      return NextResponse.json({ ok: true, warn: 'Bid saved but podium not rebuilt' });
    }

    // Re-insert top-10 as new podium_spots (position 1 = highest bid)
    const top10 = (allBids ?? []).slice(0, 10);
    if (top10.length > 0) {
      const spots = top10.map((b, idx) => ({
        creator_id:               creator.id,
        position:                 idx + 1,
        fan_handle:               b.fan_handle,
        fan_avatar_url:           b.fan_avatar_url,
        message:                  b.message,
        amount_paid:              b.amount_paid,
        stripe_payment_intent_id: b.stripe_payment_intent_id,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('podium_spots')
        .insert(spots);

      if (insertError) {
        console.error('[seed/edit] podium_spots insert error:', insertError.message);
        return NextResponse.json({ ok: true, warn: 'Bid saved but podium not rebuilt' });
      }
    }

    console.log('[seed/edit] Updated bid:', bidId, amountChanged ? `(amount → ${amountCents} cents)` : '');
    return NextResponse.json({ ok: true });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[seed/edit] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
