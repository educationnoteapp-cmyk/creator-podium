// POST /api/dashboard/seed
// Seeds 10 fake bids for the authenticated user's creator podium.
// Uses supabaseAdmin (service role) to bypass RLS — bids table has no
// browser-client INSERT policy by design (only webhooks/server may write bids).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

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

export async function POST() {
  console.log('[seed] POST /api/dashboard/seed called');

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[seed] Auth failed:', authError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[seed] Authenticated user:', user.id);

  // Look up the creator row for this user
  const { data: creator, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('id, seed_count')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (creatorError) {
    console.error('[seed] Creator lookup error:', creatorError.message);
    return NextResponse.json({ error: creatorError.message }, { status: 500 });
  }

  if (!creator) {
    console.error('[seed] No creator row for user:', user.id);
    return NextResponse.json({ error: 'Creator not found — save your URL first' }, { status: 404 });
  }

  console.log('[seed] Found creator:', creator.id);

  // Guard: only seed if no real (non-seed) bids exist
  const { data: existingBids, error: countError } = await supabaseAdmin
    .from('bids')
    .select('id, is_seed')
    .eq('creator_id', creator.id);

  if (countError) {
    console.error('[seed] Count error:', countError.message);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const realBids = (existingBids ?? []).filter(b => !b.is_seed);
  if (realBids.length > 0) {
    return NextResponse.json(
      { error: 'Podium already has bids — seeding disabled' },
      { status: 409 },
    );
  }

  // Delete any existing seed bids first — prevents duplicate key constraint
  // (stripe_payment_intent_id is UNIQUE; seed_1…seed_N may already exist)
  await supabaseAdmin
    .from('bids')
    .delete()
    .eq('creator_id', creator.id)
    .eq('is_seed', true);

  // Only insert up to seed_count fans (default 10)
  const limit = creator.seed_count ?? 10;
  const rows = FAKE_FANS.slice(0, limit).map((fan, i) => ({
    creator_id:               creator.id,
    fan_handle:               fan.handle,
    fan_avatar_url:           null,
    message:                  fan.message,
    amount_paid:              fan.amount,
    stripe_payment_intent_id: `seed_${i + 1}`,
    is_seed:                  true,
    is_active:                true,
  }));

  const { error: insertError } = await supabaseAdmin.from('bids').insert(rows);

  if (insertError) {
    console.error('[seed] Insert error:', insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // Rebuild podium_spots from new seed bids
  const { data: topBids } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creator.id)
    .or('is_active.is.null,is_active.eq.true')
    .order('amount_paid', { ascending: false })
    .limit(10);

  await supabaseAdmin.from('podium_spots').delete().eq('creator_id', creator.id);
  if (topBids && topBids.length > 0) {
    await supabaseAdmin.from('podium_spots').insert(
      topBids.map((b, idx) => ({
        creator_id:               creator.id,
        position:                 idx + 1,
        fan_handle:               b.fan_handle,
        fan_avatar_url:           b.fan_avatar_url,
        message:                  b.message,
        amount_paid:              b.amount_paid,
        stripe_payment_intent_id: b.stripe_payment_intent_id,
      }))
    );
  }

  console.log('[seed] Seeded', rows.length, 'bids for creator:', creator.id, '(seed_count:', limit, ')');
  return NextResponse.json({ ok: true, count: rows.length });
}
