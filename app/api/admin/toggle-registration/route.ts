// POST /api/admin/toggle-registration — updates site_settings.is_registration_open.
//
// The site_settings table has only a public read policy — no write policy exists
// for browser clients. This route uses supabaseAdmin (service role) to update it.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

function isAdmin(email: string): boolean {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
  return Boolean(adminEmail) && email === adminEmail;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !isAdmin(session.user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { is_registration_open?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.is_registration_open !== 'boolean') {
    return NextResponse.json({ error: 'is_registration_open must be a boolean' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('site_settings')
    .update({ is_registration_open: body.is_registration_open })
    .eq('id', 1);

  if (error) {
    console.error('Failed to update site_settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, is_registration_open: body.is_registration_open });
}
