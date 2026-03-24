// POST /api/dashboard/creator
// Upserts a creator row for the authenticated user.
// Uses supabaseAdmin (service role) to bypass RLS.
//
// Body: { slug: string, maxBidDollars?: number }
//
// On first login the dashboard passes a generated temp slug.
// On "Save URL" it passes the user-chosen slug.
// On "Save" from Podium Settings it passes maxBidDollars.
// Uses ON CONFLICT (auth_user_id) so the same row is updated each time.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  console.log('[creator] POST /api/dashboard/creator called');

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[creator] Auth failed:', authError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[creator] Authenticated user:', user.id);

  const body = await req.json() as { slug?: string; minBidDollars?: number; maxBidDollars?: number };
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  console.log('[creator] Upserting slug:', slug, 'for user:', user.id);

  const upsertData: Record<string, unknown> = { auth_user_id: user.id, slug };
  if (typeof body.minBidDollars === 'number') {
    upsertData.min_bid_dollars = body.minBidDollars;
  }
  if (typeof body.maxBidDollars === 'number') {
    upsertData.max_bid_dollars = body.maxBidDollars;
  }

  // Upsert: insert on first login, update slug on subsequent saves.
  // creators_auth_user_id_idx is a unique index so ON CONFLICT works correctly.
  const { data: creator, error } = await supabaseAdmin
    .from('creators')
    .upsert(
      upsertData,
      { onConflict: 'auth_user_id' },
    )
    .select()
    .single();

  if (error) {
    console.error('[creator] Upsert error:', error.message, error.code);
    return NextResponse.json({ error }, { status: 400 });
  }

  console.log('[creator] Upserted creator:', creator.id);
  return NextResponse.json({ creator });
}
