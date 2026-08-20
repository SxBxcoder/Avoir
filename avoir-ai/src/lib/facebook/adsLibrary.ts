/**
 * Avoir — Facebook Ad Library API Client
 *
 * Thin HTTP client for the Meta Graph API ads_archive endpoint.
 * Handles authentication, rate limiting (error 613), exponential backoff,
 * and request timeouts.
 *
 * Requires: process.env.FACEBOOK_ACCESS_TOKEN
 * Reference: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 */

import type {
  FacebookAdArchiveResponse,
  AdLibrarySearchParams,
  AdLibraryClientOptions,
} from './types';
import { logger } from '@/lib/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/ads_archive`;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const RATE_LIMIT_STATUS = 613;
const BACKOFF_BASE_MS = 1_000;

// ============================================================================
// CLIENT
// ============================================================================

/**
 * Search the Facebook Ad Library for ads matching the given parameters.
 *
 * Returns the raw API response. Callers are responsible for transforming
 * the results into our domain types (CompetitorAd).
 *
 * @throws {AdLibraryError} on non-retryable failures
 * @returns null if no token is configured (graceful degradation)
 */
export async function searchAds(
  params: AdLibrarySearchParams,
  options: AdLibraryClientOptions = {}
): Promise<FacebookAdArchiveResponse | null> {
  const accessToken = options.accessToken || process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    logger.warn('[ads-library]', 'No FACEBOOK_ACCESS_TOKEN configured — skipping API call');
    return null;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  const url = buildUrl(accessToken, params);

  return fetchWithRetry(url, timeoutMs, maxRetries);
}

/**
 * Search for ads from specific Facebook Page IDs.
 * Convenience wrapper around searchAds().
 */
export async function searchAdsByPageIds(
  pageIds: string[],
  country: string = 'ALL',
  options: AdLibraryClientOptions = {}
): Promise<FacebookAdArchiveResponse | null> {
  // Facebook allows max 10 page IDs per query
  const chunked = pageIds.slice(0, 10);

  return searchAds(
    {
      search_terms: '',
      ad_reached_countries: [country],
      search_page_ids: chunked,
      ad_active_status: 'ACTIVE',
      limit: 50,
    },
    options
  );
}

// ============================================================================
// URL BUILDER
// ============================================================================

function buildUrl(accessToken: string, params: AdLibrarySearchParams): string {
  const url = new URL(BASE_URL);

  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('ad_reached_countries', JSON.stringify(params.ad_reached_countries));
  url.searchParams.set('search_terms', params.search_terms);

  if (params.ad_active_status) {
    url.searchParams.set('ad_active_status', params.ad_active_status);
  }
  if (params.media_type) {
    url.searchParams.set('media_type', params.media_type);
  }
  if (params.publisher_platforms && params.publisher_platforms.length > 0) {
    url.searchParams.set('publisher_platforms', JSON.stringify(params.publisher_platforms));
  }
  if (params.search_page_ids && params.search_page_ids.length > 0) {
    url.searchParams.set('search_page_ids', JSON.stringify(params.search_page_ids));
  }
  if (params.limit) {
    url.searchParams.set('limit', String(params.limit));
  }
  if (params.after) {
    url.searchParams.set('after', params.after);
  }

  // Fields we need — keeps the response payload lean
  url.searchParams.set(
    'fields',
    [
      'id',
      'ad_creative_body',
      'ad_snapshot_url',
      'page_name',
      'page_id',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'publisher_platforms',
      'ad_creative_link_title',
      'ad_creative_link_caption',
    ].join(',')
  );

  return url.toString();
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

async function fetchWithRetry(
  url: string,
  timeoutMs: number,
  maxRetries: number,
  attempt: number = 0
): Promise<FacebookAdArchiveResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });

    clearTimeout(timer);

    // Rate limited — retry with backoff
    if (res.status === 429 || res.status === RATE_LIMIT_STATUS) {
      if (attempt < maxRetries) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        logger.warn('[ads-library]', `Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`);
        await sleep(delay);
        return fetchWithRetry(url, timeoutMs, maxRetries, attempt + 1);
      }
      throw new AdLibraryError(
        `Rate limited after ${maxRetries} retries`,
        res.status
      );
    }

    // Non-OK response
    if (!res.ok) {
      const body = await res.text();
      throw new AdLibraryError(
        `Facebook API returned ${res.status}: ${body}`,
        res.status
      );
    }

    const json = (await res.json()) as FacebookAdArchiveResponse;
    return json;
  } catch (err) {
    clearTimeout(timer);

    if (err instanceof AdLibraryError) throw err;

    // AbortError = timeout
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (attempt < maxRetries) {
        logger.warn('[ads-library]', `Request timeout (attempt ${attempt + 1}/${maxRetries}), retrying`);
        return fetchWithRetry(url, timeoutMs, maxRetries, attempt + 1);
      }
      throw new AdLibraryError(
        `Request timed out after ${maxRetries} retries`,
        408
      );
    }

    throw new AdLibraryError(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// CUSTOM ERROR
// ============================================================================

export class AdLibraryError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AdLibraryError';
    this.statusCode = statusCode;
  }
}
