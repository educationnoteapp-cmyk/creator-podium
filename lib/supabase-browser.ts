import { createClient } from '@supabase/supabase-js';

// Browser-safe Supabase client for realtime subscriptions and client-side reads.
// Uses NEXT_PUBLIC_ env vars which are inlined at build time by Next.js.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
