/**
 * Avoir — Competitor Data Cache
 *
 * DynamoDB cache for Facebook Ad Library data.
 * Stores competitor intelligence by industry with a 24-hour TTL.
 *
 * Table: avoir-competitors
 *   PK: industry (string)     — "fashion", "tech", "saas", etc.
 *   SK: cacheKey (string)     — "latest" for current data
 *
 * TTL attribute: `ttl` (epoch seconds) — DynamoDB auto-deletes stale entries.
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
  /** Cache key — usually "latest" (SK) */
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
const CACHE_KEY = 'latest';

// ============================================================================
// READ — Get cached competitor data
// ============================================================================

/**
 * Returns cached competitor data for an industry, or null if cache miss/expired.
 */
export async function getCachedCompetitorData(
  industry: string
): Promise<CompetitorCacheEntry | null> {
  try {
    const client = getDynamoClient();
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.COMPETITORS,
        Key: {
          industry: normalizeIndustry(industry),
          cacheKey: CACHE_KEY,
        },
      })
    );

    if (!result.Item) return null;

    const entry = result.Item as CompetitorCacheEntry;

    // Double-check TTL (DynamoDB TTL deletion is eventual, ~24-48h delay)
    if (entry.ttl && Date.now() / 1000 > entry.ttl) {
      logger.info('[competitor-cache]', 'Cache entry expired', { industry });
      return null;
    }

    return entry;
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
      cacheKey: CACHE_KEY,
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
