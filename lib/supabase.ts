import { createClient } from '@supabase/supabase-js';

// Public client — safe to use in browser / Server Components for read-only queries.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — uses the service role key. NEVER expose to the browser.
// Use only in API routes / server-side code.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
