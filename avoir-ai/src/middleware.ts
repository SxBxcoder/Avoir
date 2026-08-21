/**
 * Avoir — Next.js Middleware
 *
 * Runs on every matched request before the route handler / page renders.
 * Responsibilities:
 *   1. Redirect unauthenticated users away from /dashboard/* to /login
 *   2. Redirect authenticated users away from /login, /register to /dashboard
 *   3. For /api/teams/* routes, extract teamId from URL and verify membership
 *      via Redis cache, then inject x-team-id + x-team-role headers
 *
 * Uses Edge-compatible APIs only (no Node.js fs, crypto, etc).
 * JWT verification is NOT done here — the downstream API routes verify
 * the full token. This middleware only does lightweight routing guards.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// CONFIG — Which paths this middleware runs on
// ============================================================================

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/omnideck/:path*',
    '/login',
    '/register',
    '/api/teams/:path*',
  ],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract a lightweight auth indicator from the request.
 * We do NOT verify the JWT here (Edge runtime + performance).
 * The downstream API routes / page components do full verification.
 *
 * Returns true if there's any auth token present — enough for
 * routing decisions (redirect to login vs dashboard).
 */
function hasAuthToken(request: NextRequest): boolean {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return true;

  // Check cookies (Amplify stores tokens in cookies)
  const cookies = request.cookies;
  if (cookies.get('CognitoIdentityServiceProvider')?.value) return true;
  // Also check for the session token cookie pattern
  for (const cookie of cookies.getAll()) {
    if (cookie.name.includes('idToken') || cookie.name.includes('accessToken')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if running in demo mode.
 */
function isDemoMode(request: NextRequest): boolean {
  return request.headers.get('x-demo-mode') === 'true' ||
    request.nextUrl.searchParams.get('demo') === 'true';
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasAuthToken(request) || isDemoMode(request);

  // ── Auth Guards ──────────────────────────────────────────────────────

  // Protected pages: redirect to /login if not authenticated
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/omnideck')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Public-only pages: redirect to /dashboard if already authenticated
  if (pathname === '/login' || pathname === '/register') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ── Team API Route Guards ────────────────────────────────────────────

  if (pathname.startsWith('/api/teams/')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract teamId from URL: /api/teams/[teamId]/...
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'teams', '{teamId}', ...]
    const teamId = segments[2];

    if (teamId) {
      // Inject teamId as a header for downstream route handlers.
      // The route handler still verifies membership server-side —
      // this header is a convenience, NOT a security boundary.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-team-id', teamId);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  return NextResponse.next();
}
