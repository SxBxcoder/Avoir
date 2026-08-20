/**
 * Avoir ΓÇö Auth Types & Error Taxonomy
 *
 * Shared types for the authentication layer. The error codes below mirror
 * the AWS Cognito (aws-amplify) exception names so UI error handling stays
 * consistent between the real Cognito backend and the local mock.
 */

export type AuthUser = {
  userId: string;
  username: string;
  email: string | null;
  signInDetails?: { loginId?: string };
};

export type AuthSession = {
  tokens: {
    accessToken: { toString(): string };
    idToken?: { payload?: Record<string, unknown> };
  };
};

export const AuthErrorCode = {
  /** Already signed in (autoSignIn or duplicate signIn). */
  AlreadySignedIn: 'UserAlreadyAuthenticatedException',
  UserNotFound: 'UserNotFoundException',
  UserNotConfirmed: 'UserNotConfirmedException',
  NotAuthorized: 'NotAuthorizedException',
  UsernameExists: 'UsernameExistsException',
  CodeMismatch: 'CodeMismatchException',
  ExpiredCode: 'ExpiredCodeException',
  InvalidPassword: 'InvalidPasswordException',
  InvalidParameter: 'InvalidParameterException',
  Unauthenticated: 'UserUnAuthenticatedException',
  LimitExceeded: 'LimitExceededException',
} as const;

export type AuthErrorCodeValue = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/** Mirrors the password rules enforced by the Cognito user pool. */
export const PASSWORD_POLICY = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialCharacters: true,
} as const;
