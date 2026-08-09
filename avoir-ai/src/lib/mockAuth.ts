/**
 * Avoir — Mock Auth (Local Demo Mode)
 *
 * Offline drop-in replacement for `aws-amplify/auth`, used only when
 * NEXT_PUBLIC_DEMO_MODE=true or no Cognito pool is configured.
 *
 * It mirrors real Cognito semantics so the UI behaves identically:
 *   - Access token expiry (1h) with automatic refresh using a refresh token
 *     (30d) — just like Cognito.
 *   - Full password policy enforcement (same rules as the Cognito user pool).
 *   - Cognito-matching error names (UserNotFoundException, etc.) so existing
 *     page-level error handling keeps working.
 *   - Verification / reset codes: any 6 digits (e.g. 123456).
 *
 * Storage is browser-only (localStorage). This is a development tool, NOT a
 * secure backend — real credentials must always go through AWS Cognito.
 */

import { AuthErrorCode, PASSWORD_POLICY } from './auth/types';

const USERS_KEY = 'avoir_mock_users';
const SESSION_KEY = 'avoir_mock_session';

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — like a Cognito access token
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — like a Cognito refresh token
const CODE_PATTERN = /^\d{6}$/;

type StoredUser = {
  password: string;
  email: string;
  verified: boolean;
  brandName?: string;
};

type StoredSession = {
  userId: string;
  username: string;
  signInDetails: { loginId: string };
  accessExpiresAt: number;
  refreshExpiresAt: number;
};

class MockAuthError extends Error {
  name: string;

  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function read<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null') as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (isBrowser()) window.localStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string): void {
  if (isBrowser()) window.localStorage.removeItem(key);
}

function getUsers(): Record<string, StoredUser> {
  return read<Record<string, StoredUser>>(USERS_KEY) || {};
}

function setUsers(users: Record<string, StoredUser>): void {
  write(USERS_KEY, users);
}

function isPasswordValid(password: string): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    missing.push(`${PASSWORD_POLICY.minLength}+ characters`);
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) missing.push('a lowercase letter');
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) missing.push('an uppercase letter');
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) missing.push('a number');
  if (PASSWORD_POLICY.requireSpecialCharacters && !/[^A-Za-z0-9]/.test(password)) missing.push('a special character');
  return { ok: missing.length === 0, missing };
}

function assertPasswordPolicy(password: string): void {
  const { ok, missing } = isPasswordValid(password);
  if (!ok) {
    throw new MockAuthError(
      `Password must include: ${missing.join(', ')}.`,
      AuthErrorCode.InvalidPassword
    );
  }
}

function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MockAuthError('Invalid email address.', AuthErrorCode.InvalidParameter);
  }
}

function createSession(email: string): StoredSession {
  const now = Date.now();
  const session: StoredSession = {
    userId: `demo-${email}`,
    username: email,
    signInDetails: { loginId: email },
    accessExpiresAt: now + ACCESS_TOKEN_TTL_MS,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
  };
  write(SESSION_KEY, session);
  return session;
}

/**
 * Loads the session, transparently refreshing an expired access token using
 * the (simulated) refresh token — mirroring Cognito's behavior. Throws
 * Unauthenticated only when even the refresh token has expired.
 */
function loadSession(): StoredSession {
  const session = read<StoredSession>(SESSION_KEY);
  if (!session) {
    throw new MockAuthError('User is not signed in.', AuthErrorCode.Unauthenticated);
  }

  const now = Date.now();

  if (now > session.refreshExpiresAt) {
    remove(SESSION_KEY);
    throw new MockAuthError('Session expired. Please sign in again.', AuthErrorCode.Unauthenticated);
  }

  if (now > session.accessExpiresAt) {
    session.accessExpiresAt = now + ACCESS_TOKEN_TTL_MS;
    write(SESSION_KEY, session);
  }

  return session;
}

// ============================================================================
// Public API (matches aws-amplify/auth signatures)
// ============================================================================

export type MockSignUpInput = {
  username: string;
  password: string;
  options?: { userAttributes?: Record<string, string> };
};

export type MockSignUpOutput = {
  isSignUpComplete: boolean;
  nextStep: {
    signUpStep: 'CONFIRM_SIGN_UP';
    codeDeliveryDetails?: { destination: string };
  };
};

export type MockConfirmSignUpInput = {
  username: string;
  confirmationCode: string;
};

export type MockConfirmSignUpOutput = {
  isSignUpComplete: boolean;
  nextStep: { signUpStep: 'DONE' };
};

export type MockSignInInput = { username: string; password: string };

export type MockSignInOutput = {
  isSignedIn: boolean;
  nextStep: { signInStep: 'DONE' };
};

export type MockResetPasswordInput = { username: string };

export type MockResetPasswordOutput = {
  nextStep: {
    resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE';
    codeDeliveryDetails?: { destination: string };
  };
};

export type MockConfirmResetPasswordInput = {
  username: string;
  confirmationCode: string;
  newPassword: string;
};

export type MockConfirmResetPasswordOutput = {
  isPasswordReset: boolean;
  nextStep: { resetPasswordStep: 'DONE' };
};

/** Demo identity used by the recorded ?demo=true flow. */
export const DEMO_COMMANDER_EMAIL = 'commander@avoir.ai';

/** Creates a real mock session for the demo commander (demo mode only). */
export async function demoSignIn(): Promise<void> {
  const email = DEMO_COMMANDER_EMAIL;
  const users = getUsers();
  if (!users[email]) {
    users[email] = {
      password: 'DemoPass!123',
      email,
      verified: true,
      brandName: 'Avoir Demo Brand',
    };
    setUsers(users);
  }
  createSession(email);
}

export async function signUp({ username, password, options }: MockSignUpInput): Promise<MockSignUpOutput> {
  const email = (username || '').toLowerCase().trim();
  assertEmail(email);
  assertPasswordPolicy(password);

  const users = getUsers();
  if (users[email]) {
    throw new MockAuthError('An account with the given email already exists.', AuthErrorCode.UsernameExists);
  }

  users[email] = {
    password,
    email,
    verified: false,
    brandName: options?.userAttributes?.['custom:brand_name'],
  };
  setUsers(users);

  return {
    isSignUpComplete: false,
    nextStep: {
      signUpStep: 'CONFIRM_SIGN_UP',
      codeDeliveryDetails: { destination: email },
    },
  };
}

export async function confirmSignUp({ username, confirmationCode }: MockConfirmSignUpInput): Promise<MockConfirmSignUpOutput> {
  const email = (username || '').toLowerCase().trim();
  const users = getUsers();

  if (!users[email]) {
    throw new MockAuthError('User does not exist.', AuthErrorCode.UserNotFound);
  }
  if (!CODE_PATTERN.test(confirmationCode || '')) {
    throw new MockAuthError('Invalid verification code. In demo mode use any 6 digits (e.g. 123456).', AuthErrorCode.CodeMismatch);
  }

  users[email].verified = true;
  setUsers(users);

  return { isSignUpComplete: true, nextStep: { signUpStep: 'DONE' } };
}

export async function signIn({ username, password }: MockSignInInput): Promise<MockSignInOutput> {
  const email = (username || '').toLowerCase().trim();
  const users = getUsers();

  if (!users[email]) {
    throw new MockAuthError('User does not exist.', AuthErrorCode.UserNotFound);
  }
  if (!users[email].verified) {
    throw new MockAuthError(
      'User needs to be confirmed before signing in. In demo mode use any 6-digit code.',
      AuthErrorCode.UserNotConfirmed
    );
  }
  if (users[email].password !== password) {
    throw new MockAuthError('Incorrect username or password.', AuthErrorCode.NotAuthorized);
  }

  createSession(email);

  return { isSignedIn: true, nextStep: { signInStep: 'DONE' } };
}

export async function signInWithRedirect(): Promise<void> {
  await demoSignIn();
  if (isBrowser()) {
    window.location.href = '/';
  }
}

export async function signOut(): Promise<void> {
  remove(SESSION_KEY);
}

export async function getCurrentUser(): Promise<{ userId: string; username: string; signInDetails: { loginId: string } }> {
  const session = loadSession();
  return {
    userId: session.userId,
    username: session.username,
    signInDetails: session.signInDetails,
  };
}

export async function fetchAuthSession(): Promise<{
  tokens: {
    accessToken: { toString(): string };
    idToken: { payload: { sub: string; email: string } };
  };
}> {
  const session = loadSession();
  return {
    tokens: {
      accessToken: { toString: () => 'mock-access-token' },
      idToken: {
        payload: { sub: session.userId, email: session.signInDetails.loginId },
      },
    },
  };
}

export async function fetchUserAttributes(): Promise<{ email: string }> {
  const session = loadSession();
  return { email: session.signInDetails.loginId };
}

export async function resetPassword({ username }: MockResetPasswordInput): Promise<MockResetPasswordOutput> {
  const email = (username || '').toLowerCase().trim();
  const users = getUsers();

  if (!users[email]) {
    throw new MockAuthError('User does not exist.', AuthErrorCode.UserNotFound);
  }

  return {
    nextStep: {
      resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE',
      codeDeliveryDetails: { destination: email },
    },
  };
}

export async function confirmResetPassword({
  username,
  confirmationCode,
  newPassword,
}: MockConfirmResetPasswordInput): Promise<MockConfirmResetPasswordOutput> {
  const email = (username || '').toLowerCase().trim();
  const users = getUsers();

  if (!users[email]) {
    throw new MockAuthError('User does not exist.', AuthErrorCode.UserNotFound);
  }
  if (!CODE_PATTERN.test(confirmationCode || '')) {
    throw new MockAuthError('Invalid verification code. In demo mode use any 6 digits (e.g. 123456).', AuthErrorCode.CodeMismatch);
  }

  assertPasswordPolicy(newPassword);

  users[email].password = newPassword;
  setUsers(users);

  return { isPasswordReset: true, nextStep: { resetPasswordStep: 'DONE' } };
}
