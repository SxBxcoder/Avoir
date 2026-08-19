'use client';

/**
 * Avoir — Route Guards
 *
 * Client-side route protection built on the AuthProvider.
 *
 *   <RequireAuth>  — only renders children for signed-in users; redirects
 *                    guests to /login?next=<path> so they return here after
 *                    authenticating.
 *   <GuestOnly>    — only renders children for guests; redirects signed-in
 *                    users back to the app (e.g. login/register pages).
 *
 * Note: localStorage-backed sessions can't be validated on the server, so
 * these guards are the correct layer here. Server-side protection would
 * require a cookie-based session (out of scope for the current stack).
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

/**
 * Resolves a `next` query param to a safe internal route.
 *
 * Guards against open redirects: only same-origin paths (single leading `/`,
 * no `//`, no `/\`, no scheme) are allowed. Anything else falls back to `/`.
 */
export function getSafeRedirectPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-border border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Authenticating…</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      router.replace(getSafeRedirectPath(params.get('next')));
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
