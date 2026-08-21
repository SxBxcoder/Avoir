import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  getCachedCompetitorData,
  saveCompetitorData,
  getCacheExpiry,
  isCacheFresh,
  type CompetitorCacheEntry,
} from '../competitorCache';

// The DynamoDB client is the only I/O boundary — command classes are inert
// data holders, so we stub the client with an in-memory item store and drive
// reads/writes through it.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: () => ({ send: sendMock }),
  TABLES: { COMPETITORS: 'avoir-competitors' },
}));

let items: Map<string, Record<string, unknown>>;
let failOn: 'get' | 'put' | null;

function keyOf(tableName?: string, key?: Record<string, unknown>): string {
  return `${tableName}:${key?.industry}:${key?.cacheKey}`;
}

function fakeSend(command: unknown): Promise<unknown> {
  const { input } = command as {
    input?: { TableName?: string; Key?: Record<string, unknown>; Item?: Record<string, unknown> };
  };

  if (command instanceof GetCommand) {
    if (failOn === 'get') return Promise.reject(new Error('Simulated DynamoDB failure'));
    const row = items.get(keyOf(input?.TableName, input?.Key));
    return Promise.resolve({ Item: row ?? undefined });
  }

  if (command instanceof PutCommand) {
    if (failOn === 'put') return Promise.reject(new Error('Simulated DynamoDB failure'));
    const item = input?.Item as Record<string, unknown>;
    items.set(keyOf(input?.TableName, { industry: item.industry, cacheKey: item.cacheKey }), item);
    return Promise.resolve({});
  }

  return Promise.resolve({});
}

function makeEntry(overrides: Partial<CompetitorCacheEntry> = {}): CompetitorCacheEntry {
  return {
    industry: 'fashion',
    cacheKey: 'latest:ALL',
    ads: [],
    marketGaps: [],
    source: 'facebook',
    fetchedAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 3600,
    searchTerms: 'fashion',
    country: 'ALL',
    ...overrides,
  };
}

beforeEach(() => {
  items = new Map();
  failOn = null;
  sendMock.mockClear();
  sendMock.mockImplementation(fakeSend);
});

describe('getCachedCompetitorData', () => {
  it('returns a fresh scoped entry on hit', async () => {
    const entry = makeEntry({ cacheKey: 'latest:US', country: 'US' });
    items.set('avoir-competitors:fashion:latest:US', entry);

    const result = await getCachedCompetitorData('Fashion', 'US');

    expect(result).toEqual(entry);
    // First (and only) read targets the country-scoped key.
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].input.Key).toEqual({
      industry: 'fashion',
      cacheKey: 'latest:US',
    });
  });

  it('normalizes the industry before reading', async () => {
    items.set('avoir-competitors:street_wear:latest:ALL', makeEntry({ industry: 'street_wear' }));

    const result = await getCachedCompetitorData('  Street Wear ', 'ALL');

    expect(result?.industry).toBe('street_wear');
  });

  it('returns null on complete miss', async () => {
    const result = await getCachedCompetitorData('fashion', 'GB');
    expect(result).toBeNull();
  });

  it('treats expired entries as misses (TTL deletion is eventual)', async () => {
    items.set(
      'avoir-competitors:fashion:latest:ALL',
      makeEntry({ ttl: Math.floor(Date.now() / 1000) - 10 })
    );

    const result = await getCachedCompetitorData('fashion');

    expect(result).toBeNull();
  });

  it('falls back to a matching legacy "latest" entry when scoped key misses', async () => {
    items.set(
      'avoir-competitors:fashion:latest',
      makeEntry({ cacheKey: 'latest', country: 'US' })
    );

    const result = await getCachedCompetitorData('fashion', 'US');

    expect(result).not.toBeNull();
    expect(result?.cacheKey).toBe('latest');
  });

  it('serves legacy entries for ALL queries regardless of stored country', async () => {
    items.set(
      'avoir-competitors:fashion:latest',
      makeEntry({ cacheKey: 'latest', country: 'US' })
    );

    const result = await getCachedCompetitorData('fashion', 'ALL');

    expect(result).not.toBeNull();
  });

  it('refuses legacy entries whose stored country differs from the request', async () => {
    items.set(
      'avoir-competitors:fashion:latest',
      makeEntry({ cacheKey: 'latest', country: 'US' })
    );

    const result = await getCachedCompetitorData('fashion', 'GB');

    expect(result).toBeNull();
  });

  it('returns null instead of throwing when DynamoDB read fails', async () => {
    failOn = 'get';

    const result = await getCachedCompetitorData('fashion');

    expect(result).toBeNull();
  });
});

describe('saveCompetitorData', () => {
  it('writes under the country-scoped key with a 24h TTL', async () => {
    await saveCompetitorData('Fashion', [], [], 'facebook', 'fashion', 'US');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.TableName).toBe('avoir-competitors');
    expect(cmd.input.Item.cacheKey).toBe('latest:US');
    expect(cmd.input.Item.industry).toBe('fashion');
    expect(cmd.input.Item.country).toBe('US');
    expect(cmd.input.Item.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000) + 23 * 60 * 60);
    expect(cmd.input.Item.ttl).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
  });

  it('defaults the country scope to ALL', async () => {
    await saveCompetitorData('tech', [], [], 'mock', 'tech');

    expect(sendMock.mock.calls[0][0].input.Item.cacheKey).toBe('latest:ALL');
  });

  it('round-trips through getCachedCompetitorData', async () => {
    await saveCompetitorData('saas', [{ id: 'ad-1' } as never], ['gap'], 'facebook', 'saas', 'GB');

    const cached = await getCachedCompetitorData('SAAS', 'GB');

    expect(cached?.ads).toHaveLength(1);
    expect(cached?.marketGaps).toEqual(['gap']);
  });

  it('swallows write failures instead of breaking the caller', async () => {
    failOn = 'put';

    await expect(
      saveCompetitorData('fashion', [], [], 'facebook', 'fashion')
    ).resolves.toBeUndefined();
  });
});

describe('cache helpers', () => {
  it('isCacheFresh reflects TTL state', () => {
    expect(isCacheFresh(makeEntry())).toBe(true);
    expect(isCacheFresh(makeEntry({ ttl: Math.floor(Date.now() / 1000) - 1 }))).toBe(false);
  });

  it('getCacheExpiry converts epoch seconds to ISO', () => {
    const expiry = getCacheExpiry(makeEntry({ ttl: 1700000000 }));
    expect(expiry).toBe(new Date(1700000000 * 1000).toISOString());
  });
});
