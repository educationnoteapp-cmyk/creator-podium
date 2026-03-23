import { createClient, SupabaseClient } from '@supabase/supabase-js';

function makeClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

function lazySupabase(getUrl: () => string, getKey: () => string): SupabaseClient {
  let _client: SupabaseClient | undefined;
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (!_client) {
        _client = makeClient(getUrl(), getKey());
      }
      const val = (_client as unknown as Record<string, unknown>)[prop as string];
      if (typeof val === 'function') return (val as Function).bind(_client);
      return val;
    },
  });
}

// Public client — safe to use in browser / Server Components for read-only queries.
export const supabase = lazySupabase(
  () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — uses the service role key. NEVER expose to the browser.
// Use only in API routes / server-side code.
export const supabaseAdmin = lazySupabase(
  () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  () => process.env.SUPABASE_SERVICE_ROLE_KEY!
);
