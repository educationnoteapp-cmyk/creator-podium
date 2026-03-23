import { createClient } from '@supabase/supabase-js';

// Fallback placeholder keeps `createClient` from throwing during `next build`
// static page-data collection when env vars aren't available in CI.
// At runtime the real values are always present via .env.local / hosting env.
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY      ?? 'placeholder-service-role-key';

// Public client — safe to use in browser / Server Components for read-only queries.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client — uses the service role key. NEVER expose to the browser.
// Use only in API routes / server-side code.
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
