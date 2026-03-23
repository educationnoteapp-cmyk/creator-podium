// lib/auth.ts — Auth helpers for Creator Podium
//
// Thin wrappers over @supabase/ssr so the rest of the app
// never imports supabase clients directly.
//
// getSession()       → current session (browser)
// getUser()          → current user (browser)
// signInWithGoogle() → triggers OAuth → /auth/callback → /dashboard
// signOut()          → clears session + hard-navigates to /login

import { createClient } from '@/lib/supabase/client';

/** Returns the current session, or null if unauthenticated. */
export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Returns the current user, or null if unauthenticated. */
export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Initiates Google OAuth. Supabase redirects the browser to Google, then
 * back to /auth/callback, which exchanges the code and lands on /dashboard.
 */
export async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

/**
 * Signs out the current session and navigates to /login.
 * Uses hard navigation so all server component caches are cleared.
 */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = '/login';
}
