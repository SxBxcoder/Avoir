'use client';

/**
 * Avoir — Auth Provider
 *
 * Single source of truth for authentication state across the entire app.
 * Pages consume auth via `useAuth()` instead of each page re-implementing
 * `getCurrentUser` / `fetchAuthSession` / redirect logic.
 *
 * The underlying implementation (real AWS Cognito vs local mock) is resolved
 * by `authBridge` based on the environment — the provider never knows which
 * one is active, keeping the app portable between demo and production.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { configureAuth } from '@/lib/auth';
import {
  getCurrentUser,
  fetchAuthSession,
  signIn as bridgeSignIn,
  signOut as bridgeSignOut,
  demoSignIn,
  useMockAuth,
} from '@/lib/authBridge';
import type { AuthUser } from './types';

type AuthContextValue = {
  /** The signed-in user, or null when logged out. */
  user: AuthUser | null;
  /** Resolved email (from ID token claims when available). */
  email: string | null;
  /** Raw access token for API Authorization headers. */
  accessToken: string | null;
  /** Raw ID token for endpoints that verify the verified-email claim. */
  idToken: string | null;
  /** True while the initial session restore is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the current session from the auth backend. */
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const current = await getCurrentUser();

      let resolvedEmail = current.signInDetails?.loginId || current.username || null;
      let resolvedToken: string | null = null;
      let resolvedIdToken: string | null = null;

      try {
        const session = await fetchAuthSession();
        const idTokenEmail = session.tokens?.idToken?.payload?.email as string | undefined;
        if (idTokenEmail) resolvedEmail = idTokenEmail;
        resolvedToken = session.tokens?.accessToken?.toString() || null;
        resolvedIdToken = session.tokens?.idToken?.toString() || null;
      } catch {
        // Token retrieval can fail independently (e.g. token rotation) while
        // the user session is still valid — keep the user signed in.
      }

      setUser({
        userId: current.userId,
        username: current.username,
        email: resolvedEmail,
        signInDetails: current.signInDetails,
      });
      setEmail(resolvedEmail);
      setAccessToken(resolvedToken);
      setIdToken(resolvedIdToken);

      // One-time legacy migration (email-keyed → sub-keyed DynamoDB rows).
      // Fire-and-forget: safe to retry on every session refresh. The email is
      // derived server-side from the verified ID token, so the body is empty.
      if (resolvedIdToken) {
        fetch('/api/auth/link-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resolvedIdToken}`,
          },
        }).catch(() => {
          // Non-blocking; the migration retries on the next refresh.
        });
      }
      return true;
    } catch {
      setUser(null);
      setEmail(null);
      setAccessToken(null);
      setIdToken(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    configureAuth();
  }, []);

  useEffect(() => {
    const isDemoRequest =
      useMockAuth &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === 'true';

    // The recorded demo flow (?demo=true) needs an authenticated session to
    // pass the route guards. In demo mode, create a real mock session so the
    // provider — not a page-level bypass — is the source of truth.
    const boot = async () => {
      if (isDemoRequest) {
        try {
          await getCurrentUser();
        } catch {
          await demoSignIn();
        }
      }
      await refresh();
    };
    boot();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      await bridgeSignIn({ username, password });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await bridgeSignOut();
    } catch {
      // Always clear local state even if the backend sign-out call fails.
    }
    setUser(null);
    setEmail(null);
    setAccessToken(null);
    setIdToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      email,
      accessToken,
      idToken,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refresh,
    }),
    [user, email, accessToken, idToken, isLoading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }
  return ctx;
}
