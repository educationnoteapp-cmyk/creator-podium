// POST /api/dashboard/seed/reset
// Deletes all seed bids for the authenticated creator and re-inserts all 10
// default demo fans, then rebuilds podium_spots and resets seed_count to 10.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const FAKE_FANS = [
  { handle: '@CryptoChad',       seed: 'felix', message: 'TO THE MOON 🚀',                   amount: 1200 },
  { handle: '@BigSpenderSteve',  seed: 'aneka', message: 'I sold my couch for this',          amount: 1100 },
  { handle: '@DadJokeDave',      seed: 'bob',   message: "Hi Hungry, I'm on the podium",       amount: 1000 },
  { handle: '@MemeQueen99',      seed: 'sara',  message: 'This is fine 🔥',                   amount:  900 },
  { handle: '@TouchGrassPlease', seed: 'mike',  message: 'Outside is overrated anyway',        amount:  800 },
  { handle: '@NFTBro2024',       seed: 'luna',  message: 'My jpeg told me to do this',         amount:  700 },
  { handle: '@YOLOKing',         seed: 'jake',  message: 'You only live once',                 amount:  700 },
  { handle: '@VibeCheck',        seed: 'emma',  message: 'Vibe: immaculate ✅',                amount:  600 },
  { handle: '@NoSleepCrew',      seed: 'alex',  message: "It's 3am and I have no regrets",     amount:  600 },
  { handle: '@JustHereToWatch',  seed: 'zoe',   message: 'Here for the drama honestly',        amount:  500 },
];

export async function POST() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  // 1. Delete all existing seed bids
  await supabaseAdmin
    .from('bids')
    .delete()
    .eq('creator_id', creator.id)
    .eq('is_seed', true);

  // 2. Delete corresponding podium_spots
  await supabaseAdmin
    .from('podium_spots')
    .delete()
    .eq('creator_id', creator.id);

  // 3. Insert all 10 default demo fans
  const rows = FAKE_FANS.map((fan, i) => ({
    creator_id:               creator.id,
    fan_handle:               fan.handle,
    fan_avatar_url:           `https://api.dicebear.com/7.x/avataaars/svg?seed=${fan.seed}`,
    message:                  fan.message,
    amount_paid:              fan.amount,
    stripe_payment_intent_id: `seed_${i + 1}`,
    is_seed:                  true,
  }));

  const { error: insertError } = await supabaseAdmin.from('bids').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 4. Rebuild podium_spots from all bids (seeds + any real bids)
  const { data: allBids } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creator.id)
    .order('amount_paid', { ascending: false })
    .limit(10);

  if (allBids && allBids.length > 0) {
    const newSpots = allBids.map((bid, idx) => ({
      creator_id:               creator.id,
      position:                 idx + 1,
      fan_handle:               bid.fan_handle,
      fan_avatar_url:           bid.fan_avatar_url,
      message:                  bid.message,
      amount_paid:              bid.amount_paid,
      stripe_payment_intent_id: bid.stripe_payment_intent_id,
    }));
    await supabaseAdmin.from('podium_spots').insert(newSpots);
  }

  // 5. Reset seed_count to 10
  await supabaseAdmin
    .from('creators')
    .update({ seed_count: 10 })
    .eq('id', creator.id);

  return NextResponse.json({ ok: true });
}
