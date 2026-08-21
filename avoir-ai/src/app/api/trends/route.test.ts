import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextResponse } from 'next/server';

const {
  fetchIndustryTrends,
  requireUser,
  authErrorResponse,
  isDemoMode,
  checkRateLimit,
} = vi.hoisted(() => ({
  fetchIndustryTrends: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  isDemoMode: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/trends', () => ({ fetchIndustryTrends }));
vi.mock('@/lib/db/cache', () => ({ checkRateLimit }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/mockShield', () => ({
  isDemoMode,
  MOCK_TRENDS: { industry: 'demo', topTrends: [], viralHooks: [] },
}));

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/trends${query}`);
}

beforeEach(() => {
  isDemoMode.mockReturnValue(false);
  requireUser.mockResolvedValue({ userId: 'user-1' });
  authErrorResponse.mockReturnValue(null);
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetIn: 0 });
});

describe('GET /api/trends', () => {
  it('serves mock trends in demo mode without touching auth or DynamoDB', async () => {
    isDemoMode.mockReturnValue(true);

    const res = await GET(makeRequest('?industry=fashion'));
    const body = await res.json();

    expect(body.source).toBe('mock');
    expect(requireUser).not.toHaveBeenCalled();
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  it('returns 400 when industry is missing', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(400);
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  it('returns 401 when identity verification fails', async () => {
    requireUser.mockRejectedValue(new Error('Unauthorized'));
    authErrorResponse.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(makeRequest('?industry=fashion'));

    expect(res.status).toBe(401);
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  // Regression guard for PR #51: `fresh=true` bypasses the 48h DynamoDB cache,
  // so an unthrottled route would let one user drain SerpAPI paid credits.
  it('returns 429 and skips the SerpAPI fetch when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 42 });

    const res = await GET(makeRequest('?industry=fashion&fresh=true'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(body.error).toContain('Rate limit');
    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 10, 60);
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  it('rate limits per verified user, not per client input', async () => {
    fetchIndustryTrends.mockResolvedValue(null);

    await GET(makeRequest('?industry=fashion'));

    expect(checkRateLimit).toHaveBeenCalledWith('user-1', 10, 60);
  });

  it('fetches trends and forwards validated params including fresh', async () => {
    const trends = {
      industry: 'fashion',
      topTrends: [{ keyword: 'quiet luxury', momentum: 'rising' }],
      viralHooks: ['hook'],
      lastUpdated: new Date().toISOString(),
      source: 'serpapi',
      cachedUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    };
    fetchIndustryTrends.mockResolvedValue(trends);

    const res = await GET(makeRequest('?industry=fashion&country=gb&fresh=true'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trends).toEqual(trends);
    expect(body.source).toBe('serpapi');
    expect(body.cachedUntil).toBe(trends.cachedUntil);
    expect(fetchIndustryTrends).toHaveBeenCalledWith('fashion', {
      country: 'gb',
      fresh: true,
    });
  });

  it('defaults country to "us" when not supplied', async () => {
    fetchIndustryTrends.mockResolvedValue(null);

    await GET(makeRequest('?industry=fashion'));

    expect(fetchIndustryTrends).toHaveBeenCalledWith('fashion', {
      country: 'us',
      fresh: false,
    });
  });

  it('reports null trends when no data exists', async () => {
    fetchIndustryTrends.mockResolvedValue(null);

    const res = await GET(makeRequest('?industry=fashion'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trends).toBeNull();
    expect(body.message).toContain('SERPAPI_KEY');
  });

  it('returns 500 on unexpected failures', async () => {
    fetchIndustryTrends.mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('?industry=fashion'));

    expect(res.status).toBe(500);
  });
});
