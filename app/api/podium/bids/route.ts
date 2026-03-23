// GET /api/podium/bids?creator_id=<uuid>
//
// Returns:
//   - bids: top-10 rows for podium display (ordered by amount_paid DESC)
//   - Analytics aggregates computed from ALL bids (no limit) so totals are correct
//   - hasSeedData + seedBids so the dashboard seed editor can be populated
//
// All cent values are RAW CENTS — callers divide by 100 for display.
// Uses supabaseAdmin (service role) to bypass RLS.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id');

  console.log('API called with creator_id:', creatorId);

  if (!creatorId || !UUID_RE.test(creatorId)) {
    return NextResponse.json({ error: 'creator_id is required and must be a UUID' }, { status: 400 });
  }

  // ── Query 1: ALL bids for correct analytics (no LIMIT) ───────────────────
  const { data: allBids, error: allError } = await supabaseAdmin
    .from('bids')
    .select('id, amount_paid, fan_handle, fan_avatar_url, message, stripe_payment_intent_id, created_at')
    .eq('creator_id', creatorId);

  if (allError) {
    console.error('[podium/bids] allBids fetch error:', allError.message);
    return NextResponse.json({ error: allError.message }, { status: 500 });
  }

  // ── Query 2: top-10 full rows for podium display ──────────────────────────
  const { data: top10, error: top10Error } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creatorId)
    .order('amount_paid', { ascending: false })
    .limit(10);

  if (top10Error) {
    console.error('[podium/bids] top10 fetch error:', top10Error.message);
    return NextResponse.json({ error: top10Error.message }, { status: 500 });
  }

  const rows      = allBids ?? [];
  const totalBids = rows.length;
  const totalCents = rows.reduce((sum, b) => sum + b.amount_paid, 0);
  const kingBid   = rows.length > 0
    ? rows.reduce((max, b) => (b.amount_paid > max.amount_paid ? b : max), rows[0])
    : null;
  const avgCents  = totalBids > 0 ? Math.round(totalCents / totalBids) : 0;

  const seedBids    = rows.filter((b) => b.stripe_payment_intent_id?.startsWith('seed_'));
  const hasSeedData = seedBids.length > 0;

  console.log('[podium/bids] totalBids:', totalBids, 'totalCents:', totalCents,
    'kingCents:', kingBid?.amount_paid, 'hasSeedData:', hasSeedData, 'seedBids:', seedBids.length);

  return NextResponse.json({
    bids:        top10 ?? [],   // top-10 for podium display + realtime re-fetch
    totalBids,                  // count of ALL bids
    totalCents,                 // raw cents sum of ALL bids — NO division
    kingCents:   kingBid?.amount_paid ?? 0,
    kingHandle:  kingBid?.fan_handle  ?? '',
    avgCents,
    hasSeedData,
    seedBids,                   // all seeded bids (for seed editor)
  });
}
