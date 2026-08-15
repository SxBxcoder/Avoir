import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import type { UserSubscription } from '@/lib/stripe';

const {
  getSubscription,
  deductCredits,
  addCredits,
  isDemoMode,
  createMockShadowCloneStream,
  requireUser,
  authErrorResponse,
  fetchMock,
} = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  isDemoMode: vi.fn(),
  createMockShadowCloneStream: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/services/subscription', () => ({ getSubscription, deductCredits, addCredits }));
vi.mock('@/lib/mockShield', () => ({ isDemoMode, createMockShadowCloneStream }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

function subscription(credits: number): UserSubscription {
  return {
    userId: 'user-1',
    tier: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    status: 'none',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    credits,
    campaignsUsedThisMonth: 0,
    lastResetDate: new Date().toISOString(),
  };
}

function makeRequest(): Request {
  return new Request('http://localhost/api/shadow-clone/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.token' },
    body: JSON.stringify({ goal: 'Shadow clone' }),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(requireUser).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
  vi.mocked(getSubscription).mockResolvedValue(subscription(100));

  getSubscription.mockClear();
  deductCredits.mockReset();
  addCredits.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/shadow-clone/generate credit reservation', () => {
  it('reserves 50 credits before calling the backend and refunds on backend refusal', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(50) });
    fetchMock.mockResolvedValue(
      new Response('not ok', { status: 503 })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(deductCredits).toHaveBeenCalledWith('user-1', 50);
    expect(addCredits).toHaveBeenCalledWith('user-1', 50);
  });

  it('returns 402 and never calls the backend when the atomic reservation fails', async () => {
    deductCredits.mockResolvedValue({ success: false, subscription: subscription(10) });

    const res = await POST(makeRequest());

    expect(res.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('does not reserve when the read-only pre-check shows insufficient credits', async () => {
    vi.mocked(getSubscription).mockResolvedValue(subscription(10));

    const res = await POST(makeRequest());

    expect(res.status).toBe(402);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
