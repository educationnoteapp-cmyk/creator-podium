// GET /api/podium/bids?creator_id=<uuid>
//
// Returns the top 10 bids for a creator, ordered by amount_paid DESC.
// Uses supabaseAdmin (service role) to bypass RLS — the bids table has no
// anonymous SELECT policy, so the public podium page must go through this
// route for client-side re-fetches (e.g. after a realtime INSERT event).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id');

  if (!creatorId || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'creator_id is required and must be a UUID' }, { status: 400 });
  }

  const { data: bids, error } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creatorId)
    .order('amount_paid', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[podium/bids] Fetch error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bids: bids ?? [] });
}
