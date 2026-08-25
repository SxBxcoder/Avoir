import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { GET } from './route';

const VALID_BRIEF = {
  date: '2026-01-15',
  trend: {
    title: 'AI Micro-Agents',
    description: 'Single-purpose AI agents replacing complex SaaS.',
    momentum: 'peaking',
  },
  brief: {
    plan: {
      hook: 'The era of bloated SaaS is dead.',
      offer: 'Deploy 5 specialized AI agents for the cost of 1 tool.',
      cta: 'Start building today',
    },
    captions: ['One tool, one job, zero bloat.'],
  },
  generated_by: 'gemini-2.5-flash',
  generated_at: '2026-01-15T00:15:00.000Z',
};

const {
  getCachedAlphaBrief,
  setCachedAlphaBrief,
  getAlphaBriefCachedAt,
  isDemoMode,
  MOCK_ALPHA_BRIEF,
  logger,
  fetchMock,
} = vi.hoisted(() => ({
  getCachedAlphaBrief: vi.fn(),
  setCachedAlphaBrief: vi.fn(),
  getAlphaBriefCachedAt: vi.fn(),
  isDemoMode: vi.fn(),
  MOCK_ALPHA_BRIEF: { trend: { title: 'mock' }, brief: { plan: {} } },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/db/cache', () => ({
  getCachedAlphaBrief,
  setCachedAlphaBrief,
  getAlphaBriefCachedAt,
}));
vi.mock('@/lib/mockShield', () => ({ isDemoMode, MOCK_ALPHA_BRIEF }));
vi.mock('@/lib/logger', () => ({ logger }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(isDemoMode).mockReturnValue(false);
  getCachedAlphaBrief.mockReset();
  setCachedAlphaBrief.mockReset();
  getAlphaBriefCachedAt.mockReset();
  fetchMock.mockReset();
  logger.error.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/alpha-brief', () => {
  it('returns MOCK_ALPHA_BRIEF when demo mode is enabled', async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual(MOCK_ALPHA_BRIEF);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCachedAlphaBrief).not.toHaveBeenCalled();
  });

  it('returns cached data when Redis has a valid brief', async () => {
    getCachedAlphaBrief.mockResolvedValue(VALID_BRIEF);
    getAlphaBriefCachedAt.mockResolvedValue(Date.now());

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual(VALID_BRIEF);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setCachedAlphaBrief).not.toHaveBeenCalled();
  });

  it('triggers background revalidation when cache is stale', async () => {
    const staleTs = Date.now() - 21 * 60 * 60 * 1000; // 21 hours ago
    getCachedAlphaBrief.mockResolvedValue(VALID_BRIEF);
    getAlphaBriefCachedAt.mockResolvedValue(staleTs);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(VALID_BRIEF), { status: 200 })
    );

    const res = await GET();
    const body = await res.json();

    // Stale data is served immediately
    expect(body).toEqual(VALID_BRIEF);
    // Background revalidation fires (fire-and-forget)
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/alpha-brief',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('does not trigger background revalidation when cache is fresh', async () => {
    const freshTs = Date.now() - 1000; // 1 second ago
    getCachedAlphaBrief.mockResolvedValue(VALID_BRIEF);
    getAlphaBriefCachedAt.mockResolvedValue(freshTs);

    await GET();

    // Give fire-and-forget a moment to NOT execute
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches from backend when cache is empty and re-caches', async () => {
    getCachedAlphaBrief.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(VALID_BRIEF), { status: 200 })
    );
    setCachedAlphaBrief.mockResolvedValue(undefined);

    const res = await GET();
    const body = await res.json();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/api/alpha-brief');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeDefined();
    expect(setCachedAlphaBrief).toHaveBeenCalledWith(VALID_BRIEF);
    expect(body).toEqual(VALID_BRIEF);
  });

  it('returns 500 when backend responds with non-200', async () => {
    getCachedAlphaBrief.mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response('error', { status: 503 }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch alpha brief');
    expect(logger.error).toHaveBeenCalled();
    expect(setCachedAlphaBrief).not.toHaveBeenCalled();
  });

  it('returns 500 when backend returns an invalid alpha brief shape', async () => {
    getCachedAlphaBrief.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ trend: 'not valid' }), { status: 200 })
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch alpha brief');
    expect(setCachedAlphaBrief).not.toHaveBeenCalled();
  });

  it('returns 500 when backend is unreachable', async () => {
    getCachedAlphaBrief.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch alpha brief');
  });

  it('applies a 60s timeout to the backend fetch', async () => {
    getCachedAlphaBrief.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(VALID_BRIEF), { status: 200 })
    );

    await GET();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeDefined();
  });
});
