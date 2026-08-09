/**
 * Avoir — Auth Bridge
 *
 * Routes auth calls to the Mock Auth (offline localStorage demo) when
 * demo mode is enabled or no Cognito User Pool is configured, and to the
 * real AWS Amplify / Cognito implementation otherwise.
 *
 * Import auth functions from '@/lib/authBridge' instead of 'aws-amplify/auth'.
 */

import { isDemoMode } from '@/lib/mockShield';
import * as mockAuth from '@/lib/mockAuth';
import * as cognitoAuth from 'aws-amplify/auth';

const demoMode = isDemoMode();

// Fail closed: the mock auth backend must be explicitly enabled via
// NEXT_PUBLIC_DEMO_MODE=true. In any other build, a missing Cognito
// configuration is a deployment error — never silently fall back to
// browser-local mock auth, which any visitor could satisfy.
if (!demoMode && (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID)) {
  throw new Error(
    'Avoir auth misconfiguration: NEXT_PUBLIC_COGNITO_USER_POOL_ID and ' +
      'NEXT_PUBLIC_COGNITO_CLIENT_ID are required when NEXT_PUBLIC_DEMO_MODE is not "true". ' +
      'Set NEXT_PUBLIC_DEMO_MODE=true to run in local demo mode, or provide the Cognito identifiers.'
  );
}

const useMockAuth: boolean = demoMode;

// The mock is a demo shim: its runtime shapes match Cognito's but its TS
// signatures are intentionally looser. Treat it as the same module type so
// consumers get the real Cognito types.
const mock = mockAuth as unknown as typeof cognitoAuth;

function pick<T>(mock: T, real: T): T {
  return useMockAuth ? mock : real;
}

export const signIn = pick(mock.signIn, cognitoAuth.signIn);
export const signUp = pick(mock.signUp, cognitoAuth.signUp);
export const confirmSignUp = pick(mock.confirmSignUp, cognitoAuth.confirmSignUp);
export const signInWithRedirect = pick(mock.signInWithRedirect, cognitoAuth.signInWithRedirect);
export const signOut = pick(mock.signOut, cognitoAuth.signOut);
export const getCurrentUser = pick(mock.getCurrentUser, cognitoAuth.getCurrentUser);
export const fetchAuthSession = pick(mock.fetchAuthSession, cognitoAuth.fetchAuthSession);
export const fetchUserAttributes = pick(mock.fetchUserAttributes, cognitoAuth.fetchUserAttributes);
export const resetPassword = pick(mock.resetPassword, cognitoAuth.resetPassword);
export const confirmResetPassword = pick(mock.confirmResetPassword, cognitoAuth.confirmResetPassword);

/**
 * Demo-only helper: creates a real mock session for the recorded ?demo=true
 * flow. No-op outside demo mode — the mock is never reachable there.
 */
export async function demoSignIn(): Promise<void> {
  if (!useMockAuth) return;
  await mockAuth.demoSignIn();
}

export { useMockAuth };
