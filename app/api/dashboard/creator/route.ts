// POST /api/dashboard/creator
// Upserts a creator row for the authenticated user.
// Uses supabaseAdmin (service role) to bypass RLS.
//
// Body: { slug: string }
//
// On first login the dashboard passes a generated temp slug.
// On "Save URL" it passes the user-chosen slug.
// Uses ON CONFLICT (auth_user_id) so the same row is updated each time.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { slug?: string };
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  // Upsert: insert on first login, update slug on subsequent saves.
  // creators_auth_user_id_idx is a unique index so ON CONFLICT works correctly.
  const { data: creator, error } = await supabaseAdmin
    .from('creators')
    .upsert(
      { auth_user_id: session.user.id, slug },
      { onConflict: 'auth_user_id' },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ creator });
}
