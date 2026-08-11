import { describe, it, expect, beforeAll, beforeEach, vi, type Mock } from 'vitest';

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: vi.fn() },
}));

vi.mock('@/lib/mockShield', () => ({
  isDemoMode: vi.fn(() => false),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { headers });
}

describe('requireUser', () => {
  describe('without Cognito env config', () => {
    it('fails closed with an auth misconfiguration error', async () => {
      vi.stubEnv('NEXT_PUBLIC_COGNITO_USER_POOL_ID', '');
      vi.stubEnv('NEXT_PUBLIC_COGNITO_CLIENT_ID', '');
      const fresh = await import('./requireUser');
      await expect(
        fresh.requireUser(makeRequest({ Authorization: 'Bearer token' }))
      ).rejects.toThrow(/Auth misconfiguration/);
      vi.unstubAllEnvs();
    });
  });

  describe('with Cognito env config', () => {
    let requireUser: typeof import('./requireUser').requireUser;
    let requireUserEmail: typeof import('./requireUser').requireUserEmail;
    let authErrorResponse: typeof import('./requireUser').authErrorResponse;
    let UnauthorizedError: typeof import('./requireUser').UnauthorizedError;
    let isDemoMode: typeof import('@/lib/mockShield').isDemoMode;
    let verify: Mock;

    beforeAll(async () => {
      vi.resetModules();
      vi.stubEnv('NEXT_PUBLIC_COGNITO_USER_POOL_ID', 'us-east-1_test');
      vi.stubEnv('NEXT_PUBLIC_COGNITO_CLIENT_ID', 'test-client-id');

      const mod = await import('./requireUser');
      requireUser = mod.requireUser;
      requireUserEmail = mod.requireUserEmail;
      authErrorResponse = mod.authErrorResponse;
      UnauthorizedError = mod.UnauthorizedError;
      ({ isDemoMode } = await import('@/lib/mockShield'));

      const { CognitoJwtVerifier } = await import('aws-jwt-verify');
      const createMock = vi.mocked(CognitoJwtVerifier.create);
      createMock.mockReturnValue({ verify: vi.fn() } as never);

      // Trigger lazy verifier creation so we can control the verify mock.
      await requireUser(makeRequest({ Authorization: 'Bearer bootstrap' })).catch(() => {});
      verify = (createMock.mock.results[0].value as { verify: Mock }).verify;
    });

    beforeEach(() => {
      verify.mockReset();
      vi.mocked(isDemoMode).mockReturnValue(false);
    });

    it('returns a stable demo identity without touching the verifier in demo mode', async () => {
      vi.mocked(isDemoMode).mockReturnValue(true);
      const user = await requireUser(makeRequest());
      expect(user).toEqual({ userId: 'demo-user', email: undefined });
      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects with UnauthorizedError when the Authorization header is missing', async () => {
      await expect(requireUser(makeRequest())).rejects.toBeInstanceOf(UnauthorizedError);
      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects when the header is not a Bearer token', async () => {
      await expect(
        requireUser(makeRequest({ Authorization: 'Token abc123' }))
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects when the token fails verification', async () => {
      verify.mockRejectedValue(new Error('jwt invalid'));
      await expect(
        requireUser(makeRequest({ Authorization: 'Bearer garbage' }))
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('returns the Cognito sub as userId for a valid token', async () => {
      verify.mockResolvedValue({ sub: 'sub-abc123', email: 'user@example.com' });
      const user = await requireUser(makeRequest({ Authorization: 'Bearer valid.token.here' }));
      expect(user).toEqual({ userId: 'sub-abc123', email: 'user@example.com' });
    });

    it('maps UnauthorizedError to a 401 response via authErrorResponse', async () => {
      const res = authErrorResponse(new UnauthorizedError('nope'));
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
    });

    it('returns null from authErrorResponse for non-auth errors', async () => {
      expect(authErrorResponse(new Error('boom'))).toBeNull();
    });

    describe('requireUserEmail', () => {
      beforeEach(() => {
        verify.mockReset();
        vi.mocked(isDemoMode).mockReturnValue(false);
      });

      it('rejects with UnauthorizedError when the Authorization header is missing', async () => {
        await expect(requireUserEmail(makeRequest())).rejects.toBeInstanceOf(UnauthorizedError);
      });

      it('rejects when the email is not verified', async () => {
        verify.mockResolvedValue({ sub: 'sub-abc123', email: 'user@example.com', email_verified: false });
        await expect(
          requireUserEmail(makeRequest({ Authorization: 'Bearer token' }))
        ).rejects.toBeInstanceOf(UnauthorizedError);
      });

      it('rejects when the token has no email claim', async () => {
        verify.mockResolvedValue({ sub: 'sub-abc123' });
        await expect(
          requireUserEmail(makeRequest({ Authorization: 'Bearer token' }))
        ).rejects.toBeInstanceOf(UnauthorizedError);
      });

      it('rejects when the token fails verification', async () => {
        verify.mockRejectedValue(new Error('jwt invalid'));
        await expect(
          requireUserEmail(makeRequest({ Authorization: 'Bearer garbage' }))
        ).rejects.toBeInstanceOf(UnauthorizedError);
      });

      it('returns the verified email for a valid ID token', async () => {
        verify.mockResolvedValue({ sub: 'sub-abc123', email: 'user@example.com', email_verified: true });
        const user = await requireUserEmail(makeRequest({ Authorization: 'Bearer valid.id.token' }));
        expect(user).toEqual({ userId: 'sub-abc123', email: 'user@example.com' });
      });
    });
  });
});
