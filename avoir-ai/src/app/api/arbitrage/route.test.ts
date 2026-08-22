import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from './route';

const { fetchIndustryTrends, requireUser, authErrorResponse, logger } = vi.hoisted(() => ({
  fetchIndustryTrends: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/trends', () => ({ fetchIndustryTrends }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/logger', () => ({ logger }));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

function makeRequest(industry?: string): Request {
  const url = industry
    ? `http://localhost/api/arbitrage?industry=${encodeURIComponent(industry)}`
    : 'http://localhost/api/arbitrage';
  return new Request(url, {
    headers: { Authorization: 'Bearer valid.token' },
  });
}

function jsonResponse(body: unknown) {
  return Response.json(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: 'user-1' });
  authErrorResponse.mockReturnValue(null);
});

describe('GET /api/arbitrage', () => {
  it('returns 400 when industry is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('industry');
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  it('maps live trends into opportunities with source metadata', async () => {
    fetchIndustryTrends.mockResolvedValue({
      industry: 'fitness',
      topTrends: [
        { keyword: '12-3-30 workout', momentum: 'rising', searchVolume: '+250%', sentiment: 'positive', context: '' },
        { keyword: 'Creatine for women', momentum: 'peaking', searchVolume: '500K', sentiment: 'positive', context: '' },
      ],
      viralHooks: [],
      lastUpdated: '2026-08-21T00:00:00Z',
      source: 'serpapi',
    });

    const res = await GET(makeRequest('fitness'));
    expect(res.status).toBe(200);
    expect(fetchIndustryTrends).toHaveBeenCalledWith('fitness');

    const body = await res.json();
    expect(body.source).toBe('serpapi');
    expect(body.lastUpdated).toBe('2026-08-21T00:00:00Z');
    expect(body.opportunities).toHaveLength(2);
    expect(body.opportunities[0]).toMatchObject({
      topic: '12-3-30 workout',
      momentum: 70,
      competition: 70,
      predictedRoas: 4.8,
    });
  });

  it('returns empty opportunities with source none when backend has no data', async () => {
    fetchIndustryTrends.mockResolvedValue(null);

    const res = await GET(makeRequest('fitness'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.opportunities).toEqual([]);
    expect(body.source).toBe('none');
    expect(body.lastUpdated).toBeNull();
    expect(body.message).toMatch(/SERPAPI_KEY/);
  });

  it('returns 401 payload when auth fails', async () => {
    const unauthorized = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    authErrorResponse.mockReturnValue(unauthorized);
    requireUser.mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(makeRequest('fitness'));
    expect(res.status).toBe(401);
    expect(fetchIndustryTrends).not.toHaveBeenCalled();
  });

  it('returns 500 and logs when trends fetch throws', async () => {
    fetchIndustryTrends.mockRejectedValue(new Error('backend down'));

    const res = await GET(makeRequest('fitness'));
    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalled();

    const body = await res.json();
    expect(body.error).toBe('Failed to fetch arbitrage opportunities');
  });
});
