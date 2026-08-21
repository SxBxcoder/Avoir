import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';

const {
  deductCredits,
  addCredits,
  isDemoMode,
  requireUser,
  authErrorResponse,
  getCampaign,
  fetchMock,
} = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  isDemoMode: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  getCampaign: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/db/users', () => ({ addCredits, deductCredits }));
vi.mock('@/lib/db/campaigns', () => ({ getCampaign }));
vi.mock('@/lib/mockShield', () => ({ isDemoMode }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

function makeRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.token' },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return { campaign_id: 'camp-1', platforms: ['instagram', 'tiktok'] };
}

beforeEach(() => {
  vi.stubEnv('ZAPIER_WEBHOOK_URL', 'https://hooks.zapier.test/hook');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(requireUser).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
  deductCredits.mockReset();
  addCredits.mockReset();
  fetchMock.mockReset();
  getCampaign.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function happyPath() {
  deductCredits.mockResolvedValue({ success: true });
  getCampaign.mockResolvedValue({
    campaignId: 'camp-1',
    goal: 'Launch',
    plan: { hook: 'H', offer: 'O', cta: 'C' },
    captions: ['cap1'],
    imageUrl: 'img.png',
  });
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
}

describe('POST /api/publish — Zapier webhook integration', () => {
  it('fires the configured webhook with campaign content and platform list', async () => {
    happyPath();

    const res = await POST(makeRequest(validBody()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.cost).toBe(5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.zapier.test/hook');
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body);
    expect(payload.campaign_id).toBe('camp-1');
    expect(payload.platforms).toEqual(['instagram', 'tiktok']);
    expect(payload.userId).toBe('user-1');
    expect(payload.campaign.plan).toEqual({ hook: 'H', offer: 'O', cta: 'C' });
    expect(payload.campaign.captions).toEqual(['cap1']);
  });

  it('returns 503 and never charges when ZAPIER_WEBHOOK_URL is unset', async () => {
    vi.stubEnv('ZAPIER_WEBHOOK_URL', '');

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(503);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 404 and never charges for a campaign the user does not own', async () => {
    getCampaign.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(404);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 402 and never fires the webhook when credits are insufficient', async () => {
    getCampaign.mockResolvedValue({ campaignId: 'camp-1' });
    deductCredits.mockResolvedValue({ success: false });

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
  });

  it('refunds credits and returns 502 when the webhook responds non-2xx', async () => {
    happyPath();
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(502);
    expect(deductCredits).toHaveBeenCalledWith('user-1', 5);
    expect(addCredits).toHaveBeenCalledWith('user-1', 5);
  });

  it('refunds credits and returns 502 when the webhook is unreachable', async () => {
    happyPath();
    fetchMock.mockRejectedValue(new Error('network down'));

    const res = await POST(makeRequest(validBody()));

    expect(res.status).toBe(502);
    expect(addCredits).toHaveBeenCalledWith('user-1', 5);
  });

  it('does not refund on the happy path', async () => {
    happyPath();

    await POST(makeRequest(validBody()));

    expect(addCredits).not.toHaveBeenCalled();
  });
});
