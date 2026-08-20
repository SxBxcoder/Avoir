/**
 * Avoir ΓÇö Server-side identity guard.
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
// pool id / app client id), not secrets ΓÇö they are already shipped to the
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

let idTokenVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getIdTokenVerifier() {
  if (idTokenVerifier) return idTokenVerifier;
  if (!userPoolId || !clientId) {
    // Fail closed, same as getVerifier(): missing Cognito config is a
    // deployment error, never a silent "allow everyone".
    throw new Error(
      'Auth misconfiguration: NEXT_PUBLIC_COGNITO_USER_POOL_ID and ' +
        'NEXT_PUBLIC_COGNITO_CLIENT_ID are required when not in demo mode.'
    );
  }
  idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'id',
    clientId,
  });
  return idTokenVerifier;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

export interface AuthenticatedUserEmail {
  userId: string;
  email: string;
}

/**
 * Identity + verified-email guard for endpoints that need a trustworthy email
 * (Stripe customer lookup, legacy migration keys).
 *
 * Unlike requireUser() (access token, whose `email` claim is usually absent),
 * this verifies the Cognito ID token and requires `email_verified === true`.
 * The returned email is therefore authoritative and must never be overridden
 * by a client-supplied value from the request body.
 */
export async function requireUserEmail(req: Request): Promise<AuthenticatedUserEmail> {
  if (isDemoMode()) {
    // Defensive: real callers short-circuit on demo mode before reaching this.
    return { userId: 'demo-user', email: 'demo@avoir.ai' };
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  // getIdTokenVerifier() fails closed on missing env config (surfaces as 500,
  // never as a client 401). Deliberately kept outside the try/catch.
  const verifier = getIdTokenVerifier();

  try {
    const payload = await verifier.verify(token);
    const email = (payload as { email?: string }).email;
    if (!email || (payload as { email_verified?: boolean }).email_verified !== true) {
      throw new UnauthorizedError('Verified email claim is required');
    }
    return {
      userId: payload.sub as string,
      email,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired ID token');
  }
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
    // configured in "Access token" claims ΓÇö by default `email` lives only in
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
