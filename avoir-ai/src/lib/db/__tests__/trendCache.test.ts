import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: vi.fn(),
  TABLES: { TRENDS: 'avoir-trends' },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TestTrendCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on cache miss', async () => {
    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockResolvedValue({ Item: null });
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { getCachedTrendData } = await import('@/lib/db/trendCache');
    const result = await getCachedTrendData('fashion');
    expect(result).toBeNull();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'avoir-trends',
        Key: { industry: 'fashion', cacheKey: 'default' },
      })
    );
  });

  it('returns cached data on cache hit', async () => {
    const futureEpoch = Math.floor(Date.now() / 1000) + 86400; // 24h from now
    const mockItem = {
      industry: 'fashion',
      cacheKey: 'default',
      trends: {
        industry: 'fashion',
        topTrends: [{ keyword: 'test', momentum: 'rising', searchVolume: '100', sentiment: 'positive', context: 'test' }],
        viralHooks: ['hook'],
        lastUpdated: '2026-08-20T12:00:00Z',
        source: 'serpapi',
      },
      source: 'serpapi',
      fetchedAt: '2026-08-20T12:00:00Z',
      expiresAt: futureEpoch,
    };

    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockResolvedValue({ Item: mockItem });
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { getCachedTrendData } = await import('@/lib/db/trendCache');
    const result = await getCachedTrendData('fashion');
    expect(result).not.toBeNull();
    expect(result?.industry).toBe('fashion');
    expect(result?.topTrends).toHaveLength(1);
  });

  it('returns null for expired cache', async () => {
    const pastEpoch = Math.floor(Date.now() / 1000) - 100; // expired
    const mockItem = {
      industry: 'fashion',
      cacheKey: 'default',
      trends: { industry: 'fashion', topTrends: [], viralHooks: [], lastUpdated: '', source: 'serpapi' },
      source: 'serpapi',
      fetchedAt: '2026-08-20T12:00:00Z',
      expiresAt: pastEpoch,
    };

    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockResolvedValue({ Item: mockItem });
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { getCachedTrendData } = await import('@/lib/db/trendCache');
    const result = await getCachedTrendData('fashion');
    expect(result).toBeNull();
  });

  it('uses country-specific cache key', async () => {
    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockResolvedValue({ Item: null });
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { getCachedTrendData } = await import('@/lib/db/trendCache');
    await getCachedTrendData('fashion', 'GB');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: { industry: 'fashion', cacheKey: 'country:GB' },
      })
    );
  });

  it('returns null on DynamoDB read failure', async () => {
    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockRejectedValue(new Error('DynamoDB error'));
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { getCachedTrendData } = await import('@/lib/db/trendCache');
    const result = await getCachedTrendData('fashion');
    expect(result).toBeNull();
  });

  it('saves trend data to DynamoDB', async () => {
    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockResolvedValue({});
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { saveTrendData } = await import('@/lib/db/trendCache');
    const trends = {
      industry: 'tech',
      topTrends: [{ keyword: 'AI', momentum: 'rising', searchVolume: '5M', sentiment: 'positive', context: 'AI boom' }],
      viralHooks: ['hook'],
      lastUpdated: new Date().toISOString(),
      source: 'serpapi',
    };

    await saveTrendData('tech', trends, 'serpapi', 'US');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'avoir-trends',
        Item: expect.objectContaining({
          industry: 'tech',
          cacheKey: 'country:US',
          source: 'serpapi',
          expiresAt: expect.any(Number),
        }),
      })
    );
  });

  it('does not throw on DynamoDB write failure', async () => {
    const { getDynamoClient } = await import('@/lib/db/dynamodb');
    const mockSend = vi.fn().mockRejectedValue(new Error('DynamoDB write error'));
    vi.mocked(getDynamoClient).mockReturnValue({ send: mockSend } as never);

    const { saveTrendData } = await import('@/lib/db/trendCache');
    const trends = { industry: 'tech', topTrends: [], viralHooks: [], lastUpdated: '', source: 'mock' };

    // Should not throw
    await expect(saveTrendData('tech', trends, 'mock')).resolves.toBeUndefined();
  });
});
