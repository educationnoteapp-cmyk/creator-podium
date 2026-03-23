// GET /api/admin/data — returns all creators + bids for the admin panel.
//
// Uses supabaseAdmin (service role) to bypass RLS, which restricts creators
// to own-row only and bids to public-read. Only callable by the admin user.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

function isAdmin(email: string): boolean {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
  return Boolean(adminEmail) && email === adminEmail;
}

export async function GET() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !isAdmin(session.user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [creatorsRes, bidsRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from('creators')
      .select('id, slug, plan_type, auth_user_id, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('bids')
      .select('id, creator_id, fan_handle, message, amount_paid, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('site_settings')
      .select('is_registration_open')
      .eq('id', 1)
      .single(),
  ]);

  return NextResponse.json({
    creators:             creatorsRes.data  ?? [],
    bids:                 bidsRes.data      ?? [],
    is_registration_open: settingsRes.data?.is_registration_open ?? true,
  });
}
