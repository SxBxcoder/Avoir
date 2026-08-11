/**
 * Avoir — Server-side identity guard.
 *
 * Every API route must derive the acting user from the verified Cognito JWT,
 * never from a client-supplied `userId` in the body or query string. Trusting
 * client input for identity is the root cause of the IDOR in this codebase
 * (any caller could read / modify / spend another user's data).
 *
 * Returns `{ userId }` where `userId` is the Cognito `sub` claim.
 * Throws `UnauthorizedError` (401) when the token is missing or invalid.
 *
 * Demo mode: routes short-circuit to mock data before auth, so this guard is
 * only meaningful outside demo mode. It still returns a stable demo identity
 * so callers never have to special-case demo mode.
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/mockShield';

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Shared 401 mapping for route handlers.
 *
 * Every protected route's catch block should call this first and return early
 * on non-null, so no route can ever leak an internal error for a missing or
 * invalid token, or forget to map UnauthorizedError to a 401.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return null;
}

// NOTE: NEXT_PUBLIC_COGNITO_* values are Cognito *public identifiers* (user
// pool id / app client id), not secrets — they are already shipped to the
// browser by the Amplify SDK. They are read here on the server simply because
// the repo has no server-only env file. Prefer COGNITO_USER_POOL_ID /
// COGNITO_CLIENT_ID if you add one.
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (verifier) return verifier;
  if (!userPoolId || !clientId) {
    // Fail closed: missing Cognito config is a deployment error, never a
    // silent "allow everyone".
    throw new Error(
      'Auth misconfiguration: NEXT_PUBLIC_COGNITO_USER_POOL_ID and ' +
        'NEXT_PUBLIC_COGNITO_CLIENT_ID are required when not in demo mode.'
    );
  }
  verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId,
  });
  return verifier;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

export async function requireUser(req: Request): Promise<AuthenticatedUser> {
  if (isDemoMode()) {
    // email is deliberately undefined in demo mode: routes that fall back to a
    // client-supplied email (e.g. Stripe checkout) must NOT receive a fake one.
    return { userId: 'demo-user', email: undefined };
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  // getVerifier() fails closed on missing env config. It is deliberately kept
  // OUTSIDE the try/catch so a deployment misconfiguration surfaces as a 500
  // (and logs loudly) instead of being masked as a client 401.
  const verifier = getVerifier();

  try {
    const payload = await verifier.verify(token);
    // NOTE: Cognito access tokens only carry `email` if the app client has it
    // configured in "Access token" claims — by default `email` lives only in
    // the ID token. `payload.email` is therefore usually undefined, and any
    // route that needs an email (checkout) falls back to a client value. If
    // you want the JWT email to be authoritative, add an `email` custom
    // access-token claim in the Cognito console for this app client.
    return {
      userId: payload.sub as string,
      email: (payload as { email?: string }).email,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
