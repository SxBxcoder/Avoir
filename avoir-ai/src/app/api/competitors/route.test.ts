import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextResponse } from 'next/server';

const {
  fetchCompetitorIntel,
  requireUser,
  authErrorResponse,
  isDemoMode,
  checkRateLimit,
} = vi.hoisted(() => ({
  fetchCompetitorIntel: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  isDemoMode: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/db/competitors', () => ({ fetchCompetitorIntel }));
vi.mock('@/lib/db/cache', () => ({ checkRateLimit }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/mockShield', () => ({
  isDemoMode,
  MOCK_COMPETITOR_INTEL: { industry: 'demo', topAds: [], marketGaps: [] },
}));

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/competitors${query}`);
}

beforeEach(() => {
  isDemoMode.mockReturnValue(false);
  requireUser.mockResolvedValue({ userId: 'user-1' });
  authErrorResponse.mockReturnValue(null);
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetIn: 0 });
});

describe('GET /api/competitors', () => {
  it('serves mock intel in demo mode without touching auth or DynamoDB', async () => {
    isDemoMode.mockReturnValue(true);

    const res = await GET(makeRequest('?industry=fashion'));
    const body = await res.json();

    expect(body.source).toBe('mock');
    expect(requireUser).not.toHaveBeenCalled();
    expect(fetchCompetitorIntel).not.toHaveBeenCalled();
  });

  it('returns 400 when industry is missing', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(400);
    expect(fetchCompetitorIntel).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-ISO country code', async () => {
    const res = await GET(makeRequest('?industry=fashion&country=USA'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ISO 3166-1');
  });

  it('returns 401 when identity verification fails', async () => {
    requireUser.mockRejectedValue(new Error('Unauthorized'));
    authErrorResponse.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(makeRequest('?industry=fashion'));

    expect(res.status).toBe(401);
    expect(fetchCompetitorIntel).not.toHaveBeenCalled();
  });

  it('returns 429 and skips the Facebook fetch when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 42 });

    const res = await GET(makeRequest('?industry=fashion&fresh=true'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(body.error).toContain('Rate limit');
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 10, 60);
    expect(fetchCompetitorIntel).not.toHaveBeenCalled();
  });

  it('rate limits per verified user, not per client input', async () => {
    fetchCompetitorIntel.mockResolvedValue(null);

    await GET(makeRequest('?industry=fashion'));

    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 10, 60);
  });

  it('fetches intel and forwards validated params', async () => {
    const intel = {
      industry: 'fashion',
      topAds: [{ id: 'ad-1' }],
      marketGaps: ['gap'],
      lastUpdated: new Date().toISOString(),
      source: 'facebook',
    };
    fetchCompetitorIntel.mockResolvedValue(intel);

    const res = await GET(
      makeRequest('?industry=fashion&country=US&pageIds=123,456,,789&fresh=true')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intel).toEqual(intel);
    expect(body.source).toBe('facebook');
    expect(fetchCompetitorIntel).toHaveBeenCalledWith('fashion', {
      country: 'US',
      pageIds: ['123', '456', '789'],
      fresh: true,
    });
  });

  it('reports source "none" when no intel exists', async () => {
    fetchCompetitorIntel.mockResolvedValue(null);

    const res = await GET(makeRequest('?industry=fashion'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intel).toBeNull();
    expect(body.source).toBe('none');
  });

  it('returns 500 on unexpected failures', async () => {
    fetchCompetitorIntel.mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('?industry=fashion'));

    expect(res.status).toBe(500);
  });
});
