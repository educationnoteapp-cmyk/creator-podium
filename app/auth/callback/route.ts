// /auth/callback — OAuth code exchange handler.
//
// Supabase redirects here after Google OAuth completes.
// We exchange the one-time `code` param for a real session,
// then send the creator to /dashboard (or /login on failure).

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Session is now set in cookies — send to dashboard
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Exchange failed or no code → back to login with error flag
  return NextResponse.redirect(`${origin}/login?error=true`);
}
