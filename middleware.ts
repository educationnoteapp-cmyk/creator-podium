import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// ── Security headers applied to every response ──────────────────────────────
// Kept here (not in next.config.js) so middleware can apply them dynamically.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options':            'DENY',
  'X-Content-Type-Options':     'nosniff',
  'Referrer-Policy':            'strict-origin-when-cross-origin',
  'Permissions-Policy':         'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.openai.com",
  ].join('; '),
};

function applySecurityHeaders(res: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
}

// Protected paths — redirect to /login when unauthenticated.
const PROTECTED_PREFIXES = ['/studio', '/dashboard', '/settings', '/saved', '/onboarding', '/admin'];

// Podium page pattern: a single lowercase-slug segment (e.g. /mrbeast, /streamer-xyz).
// Used for page-level rate limiting (60 req/min/IP).
const PODIUM_PAGE_RE = /^\/[a-z0-9][a-z0-9-]*$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // ── Rate limit public podium pages ────────────────────────────────────────
  if (PODIUM_PAGE_RE.test(pathname)) {
    const rl = await rateLimit(`page:${ip}`, 60, 10_000);
    if (!rl.success) {
      const res = new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After':  String(rl.retryAfter),
          'Content-Type': 'text/plain',
        },
      });
      applySecurityHeaders(res);
      return res;
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // ── Fast path for non-protected routes ───────────────────────────────────
  // Skip supabase client init — only needed to verify/refresh auth sessions.
  if (!isProtected) {
    const res = NextResponse.next({ request: { headers: request.headers } });
    applySecurityHeaders(res);
    return res;
  }

  // ── Protected route: check session + refresh cookie ──────────────────────
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const redirectRes = NextResponse.redirect(new URL('/login', request.url));
    applySecurityHeaders(redirectRes);
    return redirectRes;
  }

  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    // Protected routes
    '/studio/:path*',
    '/dashboard/:path*',
    '/settings',
    '/saved',
    '/onboarding',
    '/admin/:path*',
    // All page routes (excludes Next.js internals and API routes)
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
  ],
};
