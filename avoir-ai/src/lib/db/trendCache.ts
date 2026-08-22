/**
 * Avoir — Trend Data Cache (DynamoDB)
 *
 * Caches trend data fetched from the Python backend (SerpAPI / pytrends / Reddit)
 * to avoid redundant external API calls. TTL is 48 hours — trends move slower
 * than competitor ads.
 *
 * Table: avoir-trends
 *   PK: industry (string)
 *   SK: cacheKey (string — "default" or "country:{code}")
 *   TTL: expiresAt (number, epoch seconds)
 *   Attributes: trends (serialized IndustryTrends), source, fetchedAt
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from '@/lib/db/dynamodb';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface CachedTrendData {
  industry: string;
  cacheKey: string;
  trends: SerializedIndustryTrends;
  source: string;
  fetchedAt: string;
  expiresAt: number; // epoch seconds (DynamoDB TTL)
}

interface SerializedIndustryTrends {
  industry: string;
  topTrends: SerializedTrendTopic[];
  viralHooks: string[];
  lastUpdated: string;
  source: string;
  cachedUntil?: string;
}

interface SerializedTrendTopic {
  keyword: string;
  momentum: string;
  searchVolume: string;
  sentiment: string;
  context: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const CACHE_TTL_HOURS = parseInt(process.env.TREND_CACHE_TTL || '48', 10);
const TABLE_NAME = TABLES.TRENDS;

// ============================================================================
// READ
// ============================================================================

/**
 * Fetch cached trend data from DynamoDB.
 * Returns null if cache miss or expired.
 */
export async function getCachedTrendData(
  industry: string,
  country?: string
): Promise<SerializedIndustryTrends | null> {
  const cacheKey = country && country !== 'ALL' ? `country:${country}` : 'default';

  try {
    const client = getDynamoClient();
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { industry, cacheKey },
      })
    );

    if (!result.Item) {
      return null;
    }

    const item = result.Item as CachedTrendData;

    // Check TTL expiry (belt-and-suspenders — DynamoDB auto-deletes, but we check too)
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (item.expiresAt && item.expiresAt < nowEpoch) {
      logger.debug('trend_cache', 'Cache expired', { industry, cacheKey });
      return null;
    }

    logger.debug('trend_cache', 'Cache hit', { industry, cacheKey, source: item.source });
    return item.trends;
  } catch (error) {
    logger.warn('trend_cache', 'Cache read failed — proceeding without cache', {
      error: error as Error,
      industry,
    });
    return null;
  }
}

// ============================================================================
// WRITE
// ============================================================================

/**
 * Save trend data to DynamoDB cache with configurable TTL.
 */
export async function saveTrendData(
  industry: string,
  trends: SerializedIndustryTrends,
  source: string,
  country?: string
): Promise<void> {
  const cacheKey = country && country !== 'ALL' ? `country:${country}` : 'default';
  const nowEpoch = Math.floor(Date.now() / 1000);
  const expiresAt = nowEpoch + CACHE_TTL_HOURS * 3600;

  // Add cachedUntil to the trends object for client consumption
  const trendsWithCachedUntil: SerializedIndustryTrends = {
    ...trends,
    cachedUntil: new Date(expiresAt * 1000).toISOString(),
  };

  const item: CachedTrendData = {
    industry,
    cacheKey,
    trends: trendsWithCachedUntil,
    source,
    fetchedAt: new Date().toISOString(),
    expiresAt,
  };

  try {
    const client = getDynamoClient();
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
    logger.debug('trend_cache', 'Cache saved', { industry, cacheKey, expiresAt: new Date(expiresAt * 1000).toISOString() });
  } catch (error) {
    // Cache write failure is non-fatal — log and continue
    logger.warn('trend_cache', 'Cache write failed', { error: error as Error, industry });
  }
}
