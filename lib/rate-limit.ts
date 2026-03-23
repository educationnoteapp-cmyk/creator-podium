// lib/rate-limit.ts — Distributed sliding-window rate limiter via Upstash Redis.
//
// Uses @upstash/ratelimit with the "slidingWindow" algorithm so limits hold
// correctly across all serverless instances (no per-instance memory state).
//
// FAIL-OPEN: if Redis is unreachable or Upstash env vars are missing, the
// request is ALLOWED and a warning is logged. This prevents a Redis outage
// from taking down the app.
//
// Per-route limits (window = 10 seconds):
//   checkout:      5 requests / 10 s
//   moderate:     10 requests / 10 s
//   stripe-connect: 3 requests / 10 s
//   (page routes) 60 requests / 10 s  — middleware uses its own instance
//
// Usage (identical to the old in-memory version):
//   const result = rateLimit(`checkout:${ip}`, 5, 10_000);
//   if (!result.success) return 429 with Retry-After: result.retryAfter

import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

// ── Build a limiter lazily so the module doesn't throw at import time ────────
// If env vars are absent we use `null` and fall back to fail-open behaviour.

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Cache limiters keyed by "maxRequests:windowMs" so we re-use instances.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const cacheKey = `${maxRequests}:${windowMs}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
    analytics: false,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sliding-window rate limiter backed by Upstash Redis.
 *
 * @param key         Unique key per resource+identity (e.g. `checkout:1.2.3.4`)
 * @param maxRequests Maximum requests allowed within `windowMs`
 * @param windowMs    Window size in milliseconds (default: 10 s)
 * @returns `{ success: true }` or `{ success: false, retryAfter: seconds }`
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs = 10_000,
): Promise<{ success: true } | { success: false; retryAfter: number }> {
  const limiter = getLimiter(maxRequests, windowMs);

  if (!limiter) {
    // Upstash not configured — fail open
    console.warn('[rate-limit] Upstash not configured; allowing request (fail-open)');
    return { success: true };
  }

  try {
    const result = await limiter.limit(key);
    if (result.success) return { success: true };

    // reset is a Unix timestamp in ms when the window resets
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return { success: false, retryAfter };
  } catch (err) {
    // Redis unreachable — fail open to avoid blocking legitimate traffic
    console.warn('[rate-limit] Redis error; allowing request (fail-open):', err);
    return { success: true };
  }
}

/** Extract the best-effort client IP from a Next.js request. */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
