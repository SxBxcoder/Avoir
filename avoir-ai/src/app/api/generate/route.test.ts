import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import type { UserSubscription } from '@/lib/stripe';

const {
  deductCredits,
  addCredits,
  checkRateLimit,
  isDemoMode,
  requireUser,
  authErrorResponse,
  createCampaign,
  fetchMock,
} = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  checkRateLimit: vi.fn(),
  isDemoMode: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  createCampaign: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/services/subscription', () => ({ addCredits, deductCredits }));
vi.mock('@/lib/db/cache', () => ({ checkRateLimit }));
vi.mock('@/lib/mockShield', () => ({ isDemoMode, MOCK_CAMPAIGNS: [] }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/db/teams', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db/campaigns', () => ({ createCampaign }));
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

function makeRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.token' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://lambda.test');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(requireUser).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, resetIn: 0 });
  deductCredits.mockReset();
  addCredits.mockReset();
  fetchMock.mockReset();
  createCampaign.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/generate quota enforcement', () => {
  it('returns 402 and never calls the paid Lambda when the credit reservation fails', async () => {
    deductCredits.mockResolvedValue({ success: false, subscription: subscription(0) });

    const res = await POST(makeRequest({ goal: 'Launch a product' }));

    expect(res.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('refunds the reserved credit when generation fails', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockRejectedValue(new Error('Simulated Lambda failure'));

    const res = await POST(makeRequest({ goal: 'Launch a product' }));

    expect(res.status).toBe(500);
    expect(deductCredits).toHaveBeenCalledWith('user-1', 1);
    expect(addCredits).toHaveBeenCalledWith('user-1', 1);
  });

  it('refunds the reserved credit when campaign persistence fails', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          body: JSON.stringify({
            plan: { hook: 'H', offer: 'O', cta: 'C' },
            captions: ['cap1'],
            tier: 'TIER_1_GEMINI',
            status: 'completed',
          }),
        }),
        { status: 200 }
      )
    );
    createCampaign.mockRejectedValue(new Error('Simulated DynamoDB failure'));

    const res = await POST(makeRequest({ goal: 'Launch a product' }));

    expect(res.status).toBe(500);
    // Generation succeeded but the campaign was never saved — the user must
    // not lose the credit.
    expect(addCredits).toHaveBeenCalledWith('user-1', 1);
  });

  it('does not reserve credits when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetIn: 42 });

    const res = await POST(makeRequest({ goal: 'Launch a product' }));

    expect(res.status).toBe(429);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reserves, generates, and persists a campaign on success', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          body: JSON.stringify({
            plan: { hook: 'H', offer: 'O', cta: 'C' },
            captions: ['cap1'],
            image_url: 'img.png',
            tier: 'TIER_1_GEMINI',
            status: 'completed',
          }),
        }),
        { status: 200 }
      )
    );
    createCampaign.mockResolvedValue({ campaignId: 'camp-123' });

    const res = await POST(makeRequest({ business: 'Acme', topic: 'Launch' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(deductCredits).toHaveBeenCalledWith('user-1', 1);
    expect(addCredits).not.toHaveBeenCalled();
    expect(createCampaign).toHaveBeenCalledWith('user-1', expect.objectContaining({ goal: expect.any(String) }));
    expect(body.hook).toBe('H');
    expect(body.campaignId).toBe('camp-123');
  });

  it('returns 400 and reserves nothing for an invalid or empty body', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('applies a timeout signal to the Lambda call so hung invocations refund', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ plan: {}, captions: [] }), { status: 200 }));
    createCampaign.mockResolvedValue({ campaignId: 'camp-123' });

    await POST(makeRequest({ goal: 'Launch a product' }));

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).signal).toBeDefined();
  });

  it('forwards the verified JWT userId to the Lambda, never a client-supplied one', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ plan: {}, captions: [] }), { status: 200 })
    );
    createCampaign.mockResolvedValue({ campaignId: 'camp-123' });

    await POST(makeRequest({ user_id: 'attacker-supplied', goal: 'Launch a product' }));

    const [url, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(url).toBe('http://lambda.test');
    expect(sent.user_id).toBe('user-1');
  });
});
