import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchAds, searchAdsByPageIds, AdLibraryError } from '@/lib/facebook/adsLibrary';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('TestAdLibraryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FACEBOOK_ACCESS_TOKEN = 'test-token';
  });

  it('returns null when no access token is configured', async () => {
    delete process.env.FACEBOOK_ACCESS_TOKEN;
    const result = await searchAds({
      search_terms: 'fashion',
      ad_reached_countries: ['US'],
    });
    expect(result).toBeNull();
  });

  it('makes a request to the correct Facebook API endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: '123', page_name: 'Test Brand' }] }),
    });

    await searchAds({
      search_terms: 'fashion',
      ad_reached_countries: ['US'],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.hostname).toBe('graph.facebook.com');
    expect(url.searchParams.get('search_terms')).toBe('fashion');
    expect(url.searchParams.get('access_token')).toBe('test-token');
  });

  it('includes all requested fields in the query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await searchAds({
      search_terms: 'tech',
      ad_reached_countries: ['ALL'],
    });

    const url = new URL(mockFetch.mock.calls[0][0]);
    const fields = url.searchParams.get('fields') || '';
    expect(fields).toContain('id');
    expect(fields).toContain('ad_creative_body');
    expect(fields).toContain('page_name');
    expect(fields).toContain('ad_snapshot_url');
  });

  it('retries on rate limit (613) with exponential backoff', async () => {
    vi.useFakeTimers();

    // First two calls: rate limited, third: success
    mockFetch
      .mockResolvedValueOnce({ status: 613, ok: false, text: async () => 'rate limited' })
      .mockResolvedValueOnce({ status: 613, ok: false, text: async () => 'rate limited' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '1' }] }) });

    const promise = searchAds(
      { search_terms: 'test', ad_reached_countries: ['ALL'] },
      { maxRetries: 3 }
    );

    // Advance past the backoff delays
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result?.data).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('throws AdLibraryError after exhausting retries', async () => {
    mockFetch.mockResolvedValue({
      status: 613,
      ok: false,
      text: async () => 'rate limited',
    });

    await expect(
      searchAds(
        { search_terms: 'test', ad_reached_countries: ['ALL'] },
        { maxRetries: 2 }
      )
    ).rejects.toThrow(AdLibraryError);
  });

  it('throws AdLibraryError on non-retryable HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      status: 400,
      ok: false,
      text: async () => 'bad request',
    });

    await expect(
      searchAds({
        search_terms: 'test',
        ad_reached_countries: ['ALL'],
      })
    ).rejects.toThrow(AdLibraryError);
  });

  it('passes search_page_ids for page-based searches', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await searchAdsByPageIds(['123', '456'], 'US');

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('search_page_ids')).toBe(JSON.stringify(['123', '456']));
  });

  it('limits page IDs to 10', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const manyIds = Array.from({ length: 15 }, (_, i) => `page-${i}`);
    await searchAdsByPageIds(manyIds);

    const url = new URL(mockFetch.mock.calls[0][0]);
    const ids = JSON.parse(url.searchParams.get('search_page_ids') || '[]');
    expect(ids).toHaveLength(10);
  });

  it('includes optional filter parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await searchAds({
      search_terms: 'saas',
      ad_reached_countries: ['GB'],
      ad_active_status: 'ACTIVE',
      media_type: 'VIDEO',
      publisher_platforms: ['INSTAGRAM'],
      limit: 100,
    });

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('ad_active_status')).toBe('ACTIVE');
    expect(url.searchParams.get('media_type')).toBe('VIDEO');
    expect(url.searchParams.get('limit')).toBe('100');
  });
});
