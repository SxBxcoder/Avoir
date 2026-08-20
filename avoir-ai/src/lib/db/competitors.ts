/**
 * Avoir — Competitor Intelligence
 *
 * Fetches real competitor ads from the Facebook Ad Library API,
 * caches results in DynamoDB (24h TTL), and falls back to enhanced
 * mock data when the API is unavailable.
 *
 * Data flow:
 *   1. Check DynamoDB cache (avoir-competitors)
 *   2. If cache miss → fetch from Facebook Ad Library
 *   3. Transform API response → CompetitorAd[]
 *   4. Derive market gaps from ad pattern analysis
 *   5. Write to DynamoDB cache
 *   6. Return CompetitorIntel
 *
 * If FACEBOOK_ACCESS_TOKEN is missing → return enhanced mock data.
 */

import { searchAds, searchAdsByPageIds, AdLibraryError } from '@/lib/facebook/adsLibrary';
import type { FacebookAd } from '@/lib/facebook/types';
import { getCachedCompetitorData, saveCompetitorData } from '@/lib/db/competitorCache';
import { logger } from '@/lib/logger';

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface CompetitorAd {
  id: string;
  brand: string;
  hook: string;
  engagement: string;
  runTime: string;
  detectedFormat: string;
  /** Facebook page ID (for attribution) */
  pageId?: string;
  /** Ad snapshot URL */
  snapshotUrl?: string;
  /** Platforms where the ad ran */
  platforms?: string[];
}

export interface CompetitorIntel {
  industry: string;
  topAds: CompetitorAd[];
  marketGaps: string[];
  lastUpdated: string;
  /** Where the data came from */
  source: 'facebook' | 'cache' | 'mock';
  /** When the cache expires (if cached) */
  cachedUntil?: string;
}

export interface CompetitorFetchOptions {
  /** Country filter (ISO code or 'ALL') */
  country?: string;
  /** Specific Facebook page IDs to search */
  pageIds?: string[];
  /** Bypass cache and force fresh fetch */
  fresh?: boolean;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Fetch competitor intelligence for an industry.
 * Orchestrates: cache → API → transform → analyze → cache → fallback.
 */
export async function fetchCompetitorIntel(
  industry: string,
  options: CompetitorFetchOptions = {}
): Promise<CompetitorIntel | null> {
  const normalized = normalizeIndustry(industry);
  const country = options.country || 'ALL';

  // 1. Check cache (unless force-refresh)
  if (!options.fresh) {
    const cached = await getCachedCompetitorData(normalized);
    if (cached) {
      return {
        industry: normalized,
        topAds: cached.ads,
        marketGaps: cached.marketGaps,
        lastUpdated: cached.fetchedAt,
        source: 'cache',
        cachedUntil: new Date(cached.ttl * 1000).toISOString(),
      };
    }
  }

  // 2. Fetch from Facebook Ad Library
  const hasToken = !!process.env.FACEBOOK_ACCESS_TOKEN;
  if (hasToken) {
    try {
      const ads = await fetchFromFacebook(industry, country, options.pageIds);
      if (ads.length > 0) {
        const marketGaps = analyzeMarketGaps(ads);

        // 3. Cache the results
        await saveCompetitorData(
          normalized,
          ads,
          marketGaps,
          'facebook',
          options.pageIds ? `pageIds:${options.pageIds.join(',')}` : industry,
          country
        );

        return {
          industry: normalized,
          topAds: ads,
          marketGaps,
          lastUpdated: new Date().toISOString(),
          source: 'facebook',
        };
      }
      // API returned no results — fall through to mocks
      logger.info('[competitors]', 'Facebook API returned no ads', { industry });
    } catch (err) {
      if (err instanceof AdLibraryError) {
        logger.warn('[competitors]', 'Facebook API error', { error: err.message, statusCode: err.statusCode });
      } else {
        logger.warn('[competitors]', 'Facebook API unexpected error', { error: err as Error });
      }
      // Fall through to mocks
    }
  }

  // 4. Fallback: enhanced mock data
  return getMockIntel(normalized);
}

// ============================================================================
// FACEBOOK API → DOMAIN TRANSFORM
// ============================================================================

/**
 * Fetch ads from Facebook Ad Library and transform to our domain model.
 */
async function fetchFromFacebook(
  industry: string,
  country: string,
  pageIds?: string[]
): Promise<CompetitorAd[]> {
  const searchTerms = truncateSearchTerms(industry, 100);

  let response;
  if (pageIds && pageIds.length > 0) {
    response = await searchAdsByPageIds(pageIds, country);
  } else {
    response = await searchAds({
      search_terms: searchTerms,
      ad_reached_countries: [country],
      ad_active_status: 'ACTIVE',
      limit: 50,
    });
  }

  if (!response?.data) return [];

  return response.data
    .filter((ad) => ad.ad_creative_body) // Skip ads with no copy
    .slice(0, 20) // Top 20 ads
    .map(transformAd);
}

/**
 * Transform a raw Facebook ad into our CompetitorAd domain model.
 */
function transformAd(ad: FacebookAd): CompetitorAd {
  const startTime = ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : new Date();
  const endTime = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : new Date();
  const daysRunning = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24)));

  const platforms = ad.publisher_platforms || [];
  const format = inferFormat(ad);
  const engagement = inferEngagement(daysRunning, platforms);

  return {
    id: `fb-${ad.id}`,
    brand: ad.page_name || 'Unknown Advertiser',
    hook: truncate(ad.ad_creative_body || '', 200),
    engagement,
    runTime: formatRunTime(daysRunning),
    detectedFormat: format,
    pageId: ad.page_id,
    snapshotUrl: ad.ad_snapshot_url,
    platforms,
  };
}

// ============================================================================
// ENGAGEMENT INFERENCE
// ============================================================================

/**
 * Infer ad quality from run time + platform spread.
 * Advertisers don't keep running ads that don't perform.
 */
function inferEngagement(daysRunning: number, platforms: string[]): string {
  const multiPlatform = platforms.length > 1;

  if (daysRunning >= 30 && multiPlatform) return 'Very High';
  if (daysRunning >= 30) return 'High';
  if (daysRunning >= 14) return 'High';
  if (daysRunning >= 7) return 'Medium';
  return 'Low';
}

/**
 * Infer the creative format from ad metadata.
 */
function inferFormat(ad: FacebookAd): string {
  const body = (ad.ad_creative_body || '').toLowerCase();
  const hasVideo = ad.ad_snapshot_url?.includes('video') || false;

  if (hasVideo) return 'Video';
  if (body.includes('?') && body.length < 100) return 'Question Hook';
  if (body.includes('🔥') || body.includes('💯') || body.includes('✨')) return 'Emoji-Driven';
  if (body.includes('limited time') || body.includes('hurry') || body.includes('last chance')) return 'Urgency';
  if (body.includes('free') || body.includes('no cost')) return 'Free Offer';
  if (body.length > 150) return 'Long-Form Copy';
  if (body.length < 50) return 'Short Punch';
  return 'Image + Text';
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRunTime(days: number): string {
  if (days >= 30) return `${days}+ days`;
  if (days === 1) return '1 day';
  return `${days} days`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function truncateSearchTerms(terms: string, maxLen: number): string {
  const trimmed = terms.toLowerCase().trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
}

function normalizeIndustry(industry: string): string {
  return industry.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
}

// ============================================================================
// MOCK DATA (fallback when API unavailable)
// ============================================================================

const MOCK_DATA: Record<string, CompetitorAd[]> = {
  fashion: [
    { id: 'mock-1', brand: 'H&M', hook: "Sustainable style that doesn't cost the earth.", engagement: 'High', runTime: '14 days', detectedFormat: 'Image + Text' },
    { id: 'mock-2', brand: 'Zara', hook: 'The Summer Collection has arrived.', engagement: 'Medium', runTime: '5 days', detectedFormat: 'Video' },
    { id: 'mock-3', brand: 'ASOS', hook: 'Your new wardrobe starts here.', engagement: 'High', runTime: '21 days', detectedFormat: 'Carousel' },
  ],
  tech: [
    { id: 'mock-4', brand: 'Notion', hook: 'Organize your life, your way.', engagement: 'Very High', runTime: '30+ days', detectedFormat: 'UGC Video' },
    { id: 'mock-5', brand: 'Monday.com', hook: 'The platform that manages everything.', engagement: 'High', runTime: '20 days', detectedFormat: 'Animation' },
    { id: 'mock-6', brand: 'Slack', hook: 'Where work happens.', engagement: 'High', runTime: '25 days', detectedFormat: 'Image + Text' },
  ],
  saas: [
    { id: 'mock-7', brand: 'HubSpot', hook: 'Grow better with CRM that scales.', engagement: 'Very High', runTime: '45 days', detectedFormat: 'Long-Form Copy' },
    { id: 'mock-8', brand: 'Stripe', hook: 'Financial infrastructure for the internet.', engagement: 'High', runTime: '60 days', detectedFormat: 'Short Punch' },
  ],
  ecommerce: [
    { id: 'mock-9', brand: 'Shopify', hook: 'Anyone, anywhere, can start a business.', engagement: 'Very High', runTime: '40 days', detectedFormat: 'UGC Video' },
    { id: 'mock-10', brand: 'WooCommerce', hook: 'The open-source ecommerce platform.', engagement: 'Medium', runTime: '15 days', detectedFormat: 'Image + Text' },
  ],
};

function getMockIntel(industry: string): CompetitorIntel {
  const match = Object.keys(MOCK_DATA).find((key) => industry.includes(key));
  const ads = match ? MOCK_DATA[match] : [
    { id: 'mock-generic', brand: 'Market Leader', hook: 'The product you didn\'t know you needed.', engagement: 'High', runTime: '10 days', detectedFormat: 'Image + Text' },
  ];

  return {
    industry,
    topAds: ads,
    marketGaps: analyzeMarketGaps(ads),
    lastUpdated: new Date().toISOString(),
    source: 'mock',
  };
}

// ============================================================================
// MARKET GAP ANALYSIS (exported for use by callers)
// ============================================================================

/**
 * Analyze competitor ads to identify market gaps and opportunities.
 * Rule-based analysis — no LLM calls.
 */
export function analyzeMarketGaps(ads: CompetitorAd[]): string[] {
  if (ads.length === 0) {
    return ['No competitor data available — be the first to define this space'];
  }

  const gaps: string[] = [];

  // 1. Format coverage — suggest missing formats
  const formats = new Set(ads.map((a) => a.detectedFormat));
  const allFormats = ['Video', 'UGC Video', 'Carousel', 'Animation', 'Image + Text', 'Long-Form Copy', 'Short Punch', 'Question Hook', 'Emoji-Driven', 'Urgency', 'Free Offer'];
  const missingFormats = allFormats.filter((f) => !formats.has(f));

  if (missingFormats.length > 0) {
    gaps.push(`Try ${missingFormats[0]} format — competitors aren't using it`);
  }
  if (missingFormats.length > 2) {
    gaps.push(`Explore ${missingFormats[2]} creative style for differentiation`);
  }

  // 2. Copy length analysis (moved up so it's always included)
  const avgLength = ads.reduce((sum, a) => sum + a.hook.length, 0) / ads.length;
  if (avgLength > 100) {
    gaps.push('Try ultra-short punchy copy — market is saturated with long text');
  } else {
    gaps.push('Go long-form with detailed storytelling — market only has short hooks');
  }

  // 3. Platform coverage
  const allPlatforms = new Set<string>();
  ads.forEach((a) => (a.platforms || []).forEach((p) => allPlatforms.add(p)));
  const missingPlatforms = ['INSTAGRAM', 'FACEBOOK', 'AUDIENCE_NETWORK'].filter((p) => !allPlatforms.has(p));
  if (missingPlatforms.length > 0) {
    gaps.push(`Expand to ${missingPlatforms[0].toLowerCase()} — underserved platform`);
  }

  // 4. Messaging gaps
  const hasUrgency = ads.some((a) => a.hook.toLowerCase().includes('limited') || a.hook.toLowerCase().includes('hurry'));
  const hasSocialProof = ads.some((a) => a.hook.toLowerCase().includes('million') || a.hook.toLowerCase().includes('trusted'));
  const hasFreeOffer = ads.some((a) => a.hook.toLowerCase().includes('free'));

  if (!hasUrgency) gaps.push('Add urgency-driven copy — no competitor uses time pressure');
  if (!hasSocialProof) gaps.push('Lead with social proof — no competitor shows traction numbers');
  if (!hasFreeOffer) gaps.push('Test a free trial or freemium hook — gap in the market');

  return gaps.slice(0, 5); // Max 5 gaps
}

// ============================================================================
// FORMAT COMPETITOR CONTEXT (for LLM prompt injection)
// ============================================================================

/**
 * Format competitor intelligence into a string for LLM prompt injection.
 * Preserves the existing interface used by stream/route.ts.
 */
export function formatCompetitorContext(intel: CompetitorIntel): string {
  if (!intel || intel.topAds.length === 0) return '';

  const sourceTag = intel.source === 'facebook' ? '[LIVE DATA]' : intel.source === 'cache' ? '[CACHED]' : '[DEMO]';
  const adsText = intel.topAds
    .map(
      (ad) =>
        `- **${ad.brand}**: "${ad.hook}" (${ad.detectedFormat}, ${ad.engagement} engagement, running ${ad.runTime})`
    )
    .join('\n');
  const gapsText = intel.marketGaps.map((gap) => `- ${gap}`).join('\n');

  return `COMPETITOR INTEL ${sourceTag}:
Current top-performing competitor ads in this space:
${adsText}

Market Gaps (Opportunities for differentiation):
${gapsText}

INSTRUCTION: Create a campaign that stands out from these competitors by leaning into the Market Gaps. Do not copy their hooks.`;
}
