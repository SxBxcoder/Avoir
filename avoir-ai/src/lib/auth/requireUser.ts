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
import { isDemoMode } from '@/lib/mockShield';

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

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
    return { userId: 'demo-user', email: 'demo@avoir.ai' };
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  try {
    const payload = await getVerifier().verify(token);
    return {
      userId: payload.sub as string,
      email: (payload as { email?: string }).email,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
