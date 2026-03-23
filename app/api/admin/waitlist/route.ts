// GET /api/admin/waitlist — returns all waitlist entries for the admin panel.
//
// The waitlist table has no RLS read policy (only public insert), so we must
// use supabaseAdmin (service role) to bypass RLS.

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

  const { data: waitlist, error } = await supabaseAdmin
    .from('waitlist')
    .select('id, email, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ waitlist: waitlist ?? [] });
}
