// GET /api/podium/bids?creator_id=<uuid>
//
// Returns the top 10 bids for a creator plus pre-computed analytics aggregates.
// All cent values are RAW CENTS from the DB — callers divide by 100 for display.
// Uses supabaseAdmin (service role) to bypass RLS — the bids table has no
// anonymous SELECT policy.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id');

  console.log('Analytics creator_id:', creatorId);

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

  const rows = bids ?? [];

  // Pre-compute analytics — all values in raw cents so callers divide once
  const totalBids   = rows.length;
  const totalCents  = rows.reduce((s, b) => s + b.amount_paid, 0);
  const kingCents   = rows[0]?.amount_paid ?? 0;       // already sorted DESC
  const kingHandle  = rows[0]?.fan_handle ?? null;
  const avgCents    = totalBids > 0 ? Math.round(totalCents / totalBids) : 0;

  console.log('[podium/bids] totalBids:', totalBids, 'totalCents:', totalCents, 'kingCents:', kingCents);

  return NextResponse.json({
    bids: rows,        // full rows — used by public podium page realtime re-fetch
    totalBids,
    totalCents,
    kingCents,
    kingHandle,
    avgCents,
  });
}
