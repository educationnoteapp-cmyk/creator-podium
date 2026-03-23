// lib/env.ts — Validates required environment variables at module import time.
//
// Import this at the top of any server-side file that needs env vars.
// If a required variable is missing, a clear error is thrown immediately
// (on first request to that route) rather than failing silently later.
//
// IMPORTANT: Only import this in server-side code (API routes, lib/*.ts).
// Never import it in client components — private env vars are not available
// in the browser bundle.

const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_CLIENT_ID',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_ADMIN_EMAIL',
] as const;

type EnvKey = typeof REQUIRED_SERVER_VARS[number];
type ValidatedEnv = Record<EnvKey, string>;

function validateEnv(): ValidatedEnv {
  const missing: string[] = [];

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Creator Podium] Missing required environment variables:\n` +
        missing.map((k) => `  • ${k}`).join('\n') +
        `\n\nCopy .env.local.example to .env.local and fill in the missing values.`
    );
  }

  return Object.fromEntries(
    REQUIRED_SERVER_VARS.map((k) => [k, process.env[k]!])
  ) as ValidatedEnv;
}

export const env: ValidatedEnv = validateEnv();
