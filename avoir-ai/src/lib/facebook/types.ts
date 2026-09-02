/**
 * Avoir — Facebook Ad Library API Types
 *
 * TypeScript types for the Facebook Graph API ads_archive endpoint.
 * Reference: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 *
 * These types model the raw API response. Our domain types (CompetitorAd,
 * CompetitorIntel) live in src/lib/db/competitors.ts and are derived from these.
 */

// ============================================================================
// RAW API RESPONSE
// ============================================================================

export interface FacebookAdArchiveResponse {
  data: FacebookAd[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface FacebookAd {
  /** Library ID of the ad */
  id: string;
  /** Ad text / creative body */
  ad_creative_body?: string;
  /** URL to view the ad snapshot in the Ad Library */
  ad_snapshot_url?: string;
  /** Name of the Facebook Page that ran the ad */
  page_name?: string;
  /** Facebook Page ID of the advertiser */
  page_id?: string;
  /** ISO timestamp — when delivery started */
  ad_delivery_start_time?: string;
  /** ISO timestamp — when delivery stopped (null if still active) */
  ad_delivery_stop_time?: string | null;
  /** Platforms where the ad was delivered */
  publisher_platforms?: string[];
  /** The ad's call-to-action type */
  ad_creative_link_title?: string;
  /** The ad's link caption */
  ad_creative_link_caption?: string;
  /** The ad's link description (below the title) */
  ad_creative_link_description?: string;
  /** The ad's call-to-action button label */
  ad_creative_link_call_to_action?: string;
  /** Languages the ad was delivered in */
  languages?: string[];
  /** URL to the page's profile picture */
  page_profile_picture_url?: string;
  /** Special ad category (e.g. EMPLOYMENT, HOUSING, CREDIT) */
  ad_saved_workflow_id?: string;
}

// ============================================================================
// API SEARCH PARAMETERS
// ============================================================================

export interface AdLibrarySearchParams {
  /** Search terms (max 100 chars) */
  search_terms: string;
  /** Country codes or 'ALL' — required */
  ad_reached_countries: string[];
  /** Filter by ad status */
  ad_active_status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  /** Filter by media type */
  media_type?: 'ALL' | 'IMAGE' | 'VIDEO' | 'MEME' | 'NONE';
  /** Filter by platform */
  publisher_platforms?: string[];
  /** Search by specific Facebook page IDs (max 10) */
  search_page_ids?: string[];
  /** Max results per page (default 25, max 2000) */
  limit?: number;
  /** Pagination cursor */
  after?: string;
}

// ============================================================================
// CLIENT OPTIONS
// ============================================================================

export interface AdLibraryClientOptions {
  /** Facebook access token (from env if not provided) */
  accessToken?: string;
  /** Request timeout in ms (default 10000) */
  timeoutMs?: number;
  /** Max retries on rate limit (default 3) */
  maxRetries?: number;
  /** Max pages to fetch for paginated requests (default 3, max 5) */
  maxPages?: number;
}

// ============================================================================
// RATE LIMIT ERROR
// ============================================================================

export interface FacebookRateLimitError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
}

// ============================================================================
// PLATFORM NORMALIZATION
// ============================================================================

/** Known Facebook publisher platform identifiers */
export type FacebookPlatform =
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'AUDIENCE_NETWORK'
  | 'MESSENGER'
  | 'WHATSAPP'
  | 'THREADS';
