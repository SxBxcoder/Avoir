/**
 * Avoir — Competitor Data Cache
 *
 * DynamoDB cache for Facebook Ad Library data.
 * Stores competitor intelligence by industry with a 24-hour TTL.
 *
 * Table: avoir-competitors
 *   PK: industry (string)     — "fashion", "tech", "saas", etc.
 *   SK: cacheKey (string)     — "latest:{country}" for current data
 *                                (e.g. "latest:US", "latest:ALL")
 *
 * TTL attribute: `ttl` (epoch seconds) — DynamoDB auto-deletes stale entries.
 *
 * Backward compat: entries written before country-scoped keys used the bare
 * SK "latest". Reads fall back to that legacy item when the scoped key misses,
 * so a deploy doesn't wipe warm cache entries.
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { logger } from '@/lib/logger';
import type { CompetitorAd } from './competitors';

// ============================================================================
// TYPES
// ============================================================================

export interface CompetitorCacheEntry {
  /** Industry keyword (PK) */
  industry: string;
  /** Cache key — "latest:{country}" (SK) */
  cacheKey: string;
  /** Transformed competitor ads */
  ads: CompetitorAd[];
  /** Derived market gap suggestions */
  marketGaps: string[];
  /** Where the data came from */
  source: 'facebook' | 'mock';
  /** ISO timestamp of when data was fetched */
  fetchedAt: string;
  /** DynamoDB TTL — epoch seconds (24h from fetch) */
  ttl: number;
  /** The search terms used to fetch this data */
  searchTerms: string;
  /** Country filter used */
  country: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CACHE_KEY_PREFIX = 'latest';
/** SK used before country-scoped keys existed — kept for warm-cache fallback. */
const LEGACY_CACHE_KEY = 'latest';

/**
 * Cache key is scoped by country so a "fashion" fetch for the US never
 * serves as the answer for GB queries. pageIds-specific results are never
 * cached under these keys (see competitors.ts).
 */
function cacheKeyFor(country: string): string {
  return `${CACHE_KEY_PREFIX}:${country}`;
}

// ============================================================================
// READ — Get cached competitor data
// ============================================================================

/**
 * Fetches a single cache entry and enforces TTL locally.
 * DynamoDB TTL deletion is eventual (~24-48h delay), so expired items can
 * still be returned by GetItem — we must check `ttl` ourselves.
 */
async function readEntry(
  industry: string,
  cacheKey: string
): Promise<CompetitorCacheEntry | null> {
  const client = getDynamoClient();
  const result = await client.send(
    new GetCommand({
      TableName: TABLES.COMPETITORS,
      Key: { industry, cacheKey },
    })
  );

  if (!result.Item) return null;

  const entry = result.Item as CompetitorCacheEntry;

  if (entry.ttl && Date.now() / 1000 > entry.ttl) {
    logger.info('[competitor-cache]', 'Cache entry expired', { industry, cacheKey });
    return null;
  }

  return entry;
}

/**
 * Returns cached competitor data for an industry + country,
 * or null on cache miss / expiry / read failure.
 */
export async function getCachedCompetitorData(
  industry: string,
  country: string = 'ALL'
): Promise<CompetitorCacheEntry | null> {
  const normalized = normalizeIndustry(industry);
  try {
    const scoped = await readEntry(normalized, cacheKeyFor(country));
    if (scoped) return scoped;

    // Legacy fallback — entries written before country-scoped keys used the
    // bare SK "latest". Only serve them when the stored country matches the
    // request (or no market was requested), otherwise one market's data
    // would leak into another's query.
    const legacy = await readEntry(normalized, LEGACY_CACHE_KEY);
    if (legacy && (country === 'ALL' || !legacy.country || legacy.country === country)) {
      logger.info('[competitor-cache]', 'Serving legacy cache entry', { industry });
      return legacy;
    }

    return null;
  } catch (err) {
    logger.warn('[competitor-cache]', 'Failed to read cache', { industry, error: err as Error });
    return null;
  }
}

// ============================================================================
// WRITE — Save competitor data to cache
// ============================================================================

/**
 * Saves competitor data to the DynamoDB cache with a 24-hour TTL.
 */
export async function saveCompetitorData(
  industry: string,
  ads: CompetitorAd[],
  marketGaps: string[],
  source: 'facebook' | 'mock',
  searchTerms: string,
  country: string = 'ALL'
): Promise<void> {
  try {
    const client = getDynamoClient();
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + CACHE_TTL_SECONDS;

    const entry: CompetitorCacheEntry = {
      industry: normalizeIndustry(industry),
      cacheKey: cacheKeyFor(country),
      ads,
      marketGaps,
      source,
      fetchedAt: now.toISOString(),
      ttl,
      searchTerms,
      country,
    };

    await client.send(
      new PutCommand({
        TableName: TABLES.COMPETITORS,
        Item: entry,
      })
    );

    logger.info('[competitor-cache]', 'Saved competitor data', {
      industry: entry.industry,
      cacheKey: entry.cacheKey,
      source,
      adCount: ads.length,
    });
  } catch (err) {
    logger.warn('[competitor-cache]', 'Failed to save cache', { industry, error: err as Error });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeIndustry(industry: string): string {
  return industry.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Returns the cache expiry time as an ISO string, or null if not cached.
 */
export function getCacheExpiry(entry: CompetitorCacheEntry): string {
  return new Date(entry.ttl * 1000).toISOString();
}

/**
 * Checks if a cache entry is still fresh (within 24h).
 */
export function isCacheFresh(entry: CompetitorCacheEntry): boolean {
  return Date.now() / 1000 < entry.ttl;
}
