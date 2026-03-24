// POST /api/dashboard/podium-settings
// Updates seed_count for the authenticated user's creator.
// If seedCount decreased, deletes the lowest seed bids and rebuilds podium_spots.
//
// Body: { seedCount: number }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { seedCount?: number };
  const seedCount = body.seedCount;

  if (typeof seedCount !== 'number' || seedCount < 0 || seedCount > 10) {
    return NextResponse.json({ error: 'seedCount must be 0–10' }, { status: 400 });
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

  // Get current seed bids ordered by amount_paid ASC
  const { data: seedBids, error: seedError } = await supabaseAdmin
    .from('bids')
    .select('id, stripe_payment_intent_id, amount_paid')
    .eq('creator_id', creator.id)
    .like('stripe_payment_intent_id', 'seed_%')
    .order('amount_paid', { ascending: true });

  if (seedError) {
    return NextResponse.json({ error: seedError.message }, { status: 500 });
  }

  const currentSeedCount = seedBids?.length ?? 0;

  // If decreasing, delete the excess lowest seed bids
  if (seedCount < currentSeedCount && seedBids) {
    const toDelete = seedBids.slice(0, currentSeedCount - seedCount);
    const idsToDelete = toDelete.map((b) => b.id);
    const piToDelete = toDelete.map((b) => b.stripe_payment_intent_id);

    // Delete from bids
    await supabaseAdmin
      .from('bids')
      .delete()
      .in('id', idsToDelete);

    // Delete from podium_spots
    await supabaseAdmin
      .from('podium_spots')
      .delete()
      .in('stripe_payment_intent_id', piToDelete)
      .eq('creator_id', creator.id);

    // Rebuild podium_spots from remaining bids (top 10 by amount)
    const { data: remainingBids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('creator_id', creator.id)
      .order('amount_paid', { ascending: false })
      .limit(10);

    if (remainingBids && remainingBids.length > 0) {
      // Delete all current podium_spots for this creator, then re-insert
      await supabaseAdmin
        .from('podium_spots')
        .delete()
        .eq('creator_id', creator.id);

      const newSpots = remainingBids.map((bid, idx) => ({
        creator_id: creator.id,
        position: idx + 1,
        fan_handle: bid.fan_handle,
        fan_avatar_url: bid.fan_avatar_url,
        message: bid.message,
        amount_paid: bid.amount_paid,
        stripe_payment_intent_id: bid.stripe_payment_intent_id,
      }));

      await supabaseAdmin.from('podium_spots').insert(newSpots);
    } else {
      // No bids left — clear podium_spots
      await supabaseAdmin
        .from('podium_spots')
        .delete()
        .eq('creator_id', creator.id);
    }
  }

  // Update seed_count on creators table
  await supabaseAdmin
    .from('creators')
    .update({ seed_count: seedCount })
    .eq('id', creator.id);

  return NextResponse.json({ success: true });
}
