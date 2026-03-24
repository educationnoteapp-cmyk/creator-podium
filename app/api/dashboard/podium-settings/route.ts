// POST /api/dashboard/podium-settings
// Updates seed_count and/or min_bid_dollars for the authenticated user's creator.
//
// seedCount changes:
//   Decrease → deletes the lowest seed bids and rebuilds podium_spots.
//   Increase → inserts new placeholder seed fans and rebuilds podium_spots.
//
// minBidDollars changes:
//   Updates creators.min_bid_dollars, deletes any seed bids below the new
//   floor, rebuilds podium_spots, and returns deletedCount.
//
// Body: { seedCount?: number; minBidDollars?: number }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// Full list of 10 placeholder fans — sliced as needed
const FAKE_FANS = [
  { handle: '@CryptoChad',       message: 'TO THE MOON 🚀',                   amount: 1200 },
  { handle: '@BigSpenderSteve',  message: 'I sold my couch for this',          amount: 1100 },
  { handle: '@DadJokeDave',      message: "Hi Hungry, I'm on the podium",       amount: 1000 },
  { handle: '@MemeQueen99',      message: 'This is fine 🔥',                   amount:  900 },
  { handle: '@TouchGrassPlease', message: 'Outside is overrated anyway',        amount:  800 },
  { handle: '@NFTBro2024',       message: 'My jpeg told me to do this',         amount:  700 },
  { handle: '@YOLOKing',         message: 'You only live once',                 amount:  700 },
  { handle: '@VibeCheck',        message: 'Vibe: immaculate ✅',                amount:  600 },
  { handle: '@NoSleepCrew',      message: "It's 3am and I have no regrets",     amount:  600 },
  { handle: '@JustHereToWatch',  message: 'Here for the drama honestly',        amount:  500 },
];

async function rebuildPodiumSpots(creatorId: string) {
  const { data: remainingBids } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creatorId)
    .order('amount_paid', { ascending: false })
    .limit(10);

  await supabaseAdmin
    .from('podium_spots')
    .delete()
    .eq('creator_id', creatorId);

  if (remainingBids && remainingBids.length > 0) {
    const newSpots = remainingBids.map((bid, idx) => ({
      creator_id:               creatorId,
      position:                 idx + 1,
      fan_handle:               bid.fan_handle,
      fan_avatar_url:           bid.fan_avatar_url,
      message:                  bid.message,
      amount_paid:              bid.amount_paid,
      stripe_payment_intent_id: bid.stripe_payment_intent_id,
    }));
    await supabaseAdmin.from('podium_spots').insert(newSpots);
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { seedCount?: number; minBidDollars?: number };
  const { seedCount, minBidDollars } = body;

  // Validate whichever fields were provided
  if (seedCount !== undefined && (typeof seedCount !== 'number' || seedCount < 0 || seedCount > 10)) {
    return NextResponse.json({ error: 'seedCount must be 0–10' }, { status: 400 });
  }
  if (minBidDollars !== undefined && (typeof minBidDollars !== 'number' || minBidDollars < 1 || minBidDollars > 50)) {
    return NextResponse.json({ error: 'minBidDollars must be 1–50' }, { status: 400 });
  }
  if (seedCount === undefined && minBidDollars === undefined) {
    return NextResponse.json({ error: 'Provide seedCount or minBidDollars' }, { status: 400 });
  }

  // Get creator
  const { data: creator, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('id, seed_count')
    .eq('auth_user_id', user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  let deletedCount = 0;

  // ── Handle minBidDollars change ────────────────────────────────────────────
  if (minBidDollars !== undefined) {
    const floorCents = minBidDollars * 100;

    // Find seed bids below the new minimum
    const { data: belowMin } = await supabaseAdmin
      .from('bids')
      .select('id, stripe_payment_intent_id')
      .eq('creator_id', creator.id)
      .like('stripe_payment_intent_id', 'seed_%')
      .lt('amount_paid', floorCents);

    if (belowMin && belowMin.length > 0) {
      deletedCount = belowMin.length;
      const idsToDelete = belowMin.map((b) => b.id);
      const piToDelete  = belowMin.map((b) => b.stripe_payment_intent_id);

      await supabaseAdmin.from('bids').delete().in('id', idsToDelete);
      await supabaseAdmin
        .from('podium_spots')
        .delete()
        .in('stripe_payment_intent_id', piToDelete)
        .eq('creator_id', creator.id);

      await rebuildPodiumSpots(creator.id);
    }

    // Save new min_bid_dollars
    await supabaseAdmin
      .from('creators')
      .update({ min_bid_dollars: minBidDollars })
      .eq('id', creator.id);
  }

  // ── Handle seedCount change ────────────────────────────────────────────────
  if (seedCount !== undefined) {
    // Get current seed bids ordered by amount_paid ASC (lowest first for deletion)
    const { data: seedBids, error: seedError } = await supabaseAdmin
      .from('bids')
      .select('id, stripe_payment_intent_id, amount_paid, fan_handle')
      .eq('creator_id', creator.id)
      .like('stripe_payment_intent_id', 'seed_%')
      .order('amount_paid', { ascending: true });

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }

    const currentSeedCount = seedBids?.length ?? 0;

    if (seedCount < currentSeedCount) {
      // ── Decrease: delete lowest seed bids ─────────────────────────────────
      const toDelete = (seedBids ?? []).slice(0, currentSeedCount - seedCount);
      const idsToDelete = toDelete.map((b) => b.id);
      const piToDelete  = toDelete.map((b) => b.stripe_payment_intent_id);

      await supabaseAdmin.from('bids').delete().in('id', idsToDelete);
      await supabaseAdmin
        .from('podium_spots')
        .delete()
        .in('stripe_payment_intent_id', piToDelete)
        .eq('creator_id', creator.id);

      await rebuildPodiumSpots(creator.id);

    } else if (seedCount > currentSeedCount) {
      // ── Increase: figure out which seed slots are missing and insert them ─
      const existingNums = new Set(
        (seedBids ?? []).map((b) =>
          parseInt(b.stripe_payment_intent_id.replace('seed_', ''), 10)
        )
      );

      const toInsert: Array<{
        creator_id: string;
        fan_handle: string;
        message: string;
        amount_paid: number;
        fan_avatar_url: null;
        stripe_payment_intent_id: string;
      }> = [];

      for (let i = 1; i <= 10 && toInsert.length < seedCount - currentSeedCount; i++) {
        if (existingNums.has(i)) continue;
        const fan = FAKE_FANS[i - 1];
        toInsert.push({
          creator_id:               creator.id,
          fan_handle:               fan.handle,
          message:                  fan.message,
          amount_paid:              fan.amount,
          fan_avatar_url:           null,
          stripe_payment_intent_id: `seed_${i}`,
        });
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabaseAdmin.from('bids').insert(toInsert);
        if (insertErr) {
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }
        await rebuildPodiumSpots(creator.id);
      }
    }

    // Update seed_count on creators table
    await supabaseAdmin
      .from('creators')
      .update({ seed_count: seedCount })
      .eq('id', creator.id);
  }

  return NextResponse.json({ success: true, deletedCount });
}
