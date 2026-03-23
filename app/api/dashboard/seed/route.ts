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
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Look up the creator row for this user
  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
  }

  // Guard: only seed an empty podium
  const { count } = await supabaseAdmin
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creator.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Podium already has bids — seeding disabled' },
      { status: 409 },
    );
  }

  const rows = FAKE_FANS.map((fan) => ({
    creator_id:               creator.id,
    fan_handle:               fan.handle,
    fan_avatar_url:           null,
    message:                  fan.message,
    amount_paid:              fan.amount,
    stripe_payment_intent_id: `pi_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }));

  const { error } = await supabaseAdmin.from('bids').insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
