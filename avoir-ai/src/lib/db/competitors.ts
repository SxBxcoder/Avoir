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

import { searchAds, searchAdsByPageIds, searchAdsPaginated, AdLibraryError } from '@/lib/facebook/adsLibrary';
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
  /** Ad headline / link title */
  title?: string;
  /** Ad CTA button label (e.g. "Shop Now", "Learn More") */
  cta?: string;
  /** Page profile picture URL (brand logo) */
  brandLogo?: string;
  /** Languages the ad was delivered in */
  languages?: string[];
  /** Numeric engagement score 0-100 derived from run time + platform spread + format */
  engagementScore?: number;
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
  /** Serve stale cache and refresh in background (default true) */
  staleWhileRevalidate?: boolean;
}

// ============================================================================
// CONCURRENCY LIMITER
// ============================================================================

/**
 * Limits concurrent Facebook API calls to avoid hammering Meta's endpoints.
 * In serverless (Next.js API routes), each request runs in its own isolate,
 * so this is a per-process in-memory semaphore.
 */
const MAX_CONCURRENT_FB_CALLS = 2;
let activeFbCalls = 0;
const fbCallQueue: Array<() => void> = [];

function acquireFbSlot(): Promise<void> {
  if (activeFbCalls < MAX_CONCURRENT_FB_CALLS) {
    activeFbCalls++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    fbCallQueue.push(resolve);
  });
}

function releaseFbSlot(): void {
  activeFbCalls--;
  if (fbCallQueue.length > 0) {
    activeFbCalls++;
    const next = fbCallQueue.shift()!;
    next();
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Fetch competitor intelligence for an industry.
 * Orchestrates: cache → API → transform → analyze → cache → fallback.
 *
 * Supports stale-while-revalidate: if cache is expired but exists,
 * serve the stale data immediately and refresh in the background.
 */
export async function fetchCompetitorIntel(
  industry: string,
  options: CompetitorFetchOptions = {}
): Promise<CompetitorIntel | null> {
  const normalized = normalizeIndustry(industry);
  const country = options.country || 'ALL';
  const swr = options.staleWhileRevalidate !== false;

  // 1. Check cache (unless force-refresh)
  if (!options.fresh) {
    const cached = await getCachedCompetitorData(normalized, country);
    if (cached) {
      const intel: CompetitorIntel = {
        industry: normalized,
        topAds: cached.ads,
        marketGaps: cached.marketGaps,
        lastUpdated: cached.fetchedAt,
        source: 'cache',
        cachedUntil: new Date(cached.ttl * 1000).toISOString(),
      };

      // Stale-while-revalidate: if cache is near expiry or we're in SWR mode,
      // serve the stale data and trigger a background refresh.
      if (swr) {
        const cacheAge = Date.now() / 1000 - (Date.now() / 1000 - cached.ttl + 24 * 60 * 60);
        const isStale = cacheAge > 20 * 60 * 60; // >20h old (of 24h TTL)
        if (isStale && !options.pageIds?.length) {
          // Fire-and-forget background refresh
          refreshInBackground(normalized, country, industry).catch(() => {});
        }
      }

      return intel;
    }
  }

  // 2. Fetch from Facebook Ad Library (with concurrency limit)
  const hasToken = !!process.env.FACEBOOK_ACCESS_TOKEN;
  if (hasToken) {
    await acquireFbSlot();
    try {
      const ads = await fetchFromFacebook(industry, country, options.pageIds);
      if (ads.length > 0) {
        const marketGaps = analyzeMarketGaps(ads);

        // 3. Cache the results — but only industry-wide fetches.
        if (!options.pageIds || options.pageIds.length === 0) {
          await saveCompetitorData(
            normalized,
            ads,
            marketGaps,
            'facebook',
            industry,
            country
          );
        }

        return {
          industry: normalized,
          topAds: ads,
          marketGaps,
          lastUpdated: new Date().toISOString(),
          source: 'facebook',
        };
      }
      logger.info('[competitors]', 'Facebook API returned no ads', { industry });
    } catch (err) {
      if (err instanceof AdLibraryError) {
        logger.warn('[competitors]', 'Facebook API error', { error: err.message, statusCode: err.statusCode });
      } else {
        logger.warn('[competitors]', 'Facebook API unexpected error', { error: err as Error });
      }
    } finally {
      releaseFbSlot();
    }
  }

  // 4. Fallback: enhanced mock data
  return getMockIntel(normalized);
}

/**
 * Background refresh — fetches fresh data and updates the cache.
 * Errors are swallowed (fire-and-forget).
 */
async function refreshInBackground(
  normalizedIndustry: string,
  country: string,
  rawIndustry: string
): Promise<void> {
  await acquireFbSlot();
  try {
    const ads = await fetchFromFacebook(rawIndustry, country);
    if (ads.length > 0) {
      const marketGaps = analyzeMarketGaps(ads);
      await saveCompetitorData(normalizedIndustry, ads, marketGaps, 'facebook', rawIndustry, country);
      logger.info('[competitors]', 'Background refresh completed', { industry: normalizedIndustry });
    }
  } catch {
    // Background refresh failure is non-critical
  } finally {
    releaseFbSlot();
  }
}

// ============================================================================
// FACEBOOK API → DOMAIN TRANSFORM
// ============================================================================

/**
 * Fetch ads from Facebook Ad Library and transform to our domain model.
 * Industry-wide searches use pagination to capture more data;
 * page-id searches stay single-page (the user picked specific brands).
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
    response = await searchAdsPaginated(
      {
        search_terms: searchTerms,
        ad_reached_countries: [country],
        ad_active_status: 'ACTIVE',
        limit: 200,
      },
      { maxPages: 3 }
    );
  }

  if (!response?.data) return [];

  return response.data
    .filter((ad) => ad.ad_creative_body) // Skip ads with no copy
    .slice(0, 30) // Top 30 ads (increased from 20 with pagination)
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
  const engagementLabel = inferEngagement(daysRunning, platforms);
  const body = ad.ad_creative_body || '';
  const hasCta = !!ad.ad_creative_link_call_to_action;
  const engagementScore = computeEngagementScore(daysRunning, platforms, format, hasCta, body.length);

  return {
    id: `fb-${ad.id}`,
    brand: ad.page_name || 'Unknown Advertiser',
    hook: truncate(body, 200),
    engagement: engagementLabel,
    runTime: formatRunTime(daysRunning),
    detectedFormat: format,
    pageId: ad.page_id,
    snapshotUrl: ad.ad_snapshot_url,
    platforms,
    title: ad.ad_creative_link_title,
    cta: ad.ad_creative_link_call_to_action,
    brandLogo: ad.page_profile_picture_url,
    languages: ad.languages,
    engagementScore,
  };
}

// ============================================================================
// ENGAGEMENT INFERENCE
// ============================================================================

/**
 * Infer ad quality label from run time + platform spread.
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
 * Compute a numeric engagement score (0-100) from multiple signals.
 *
 * Scoring model:
 *   - Run time (0-40): Ads that survive longer perform better.
 *   - Platform spread (0-25): Multi-platform = proven cross-channel appeal.
 *   - Format bonus (0-20): Video/UGC formats outperform static.
 *   - CTA presence (0-10): Ads with explicit CTAs convert better.
 *   - Body length (0-5): Long-form copy signals investment.
 */
function computeEngagementScore(
  daysRunning: number,
  platforms: string[],
  format: string,
  hasCta: boolean,
  bodyLength: number
): number {
  // Run time score (0-40)
  let runScore: number;
  if (daysRunning >= 60) runScore = 40;
  else if (daysRunning >= 30) runScore = 32;
  else if (daysRunning >= 14) runScore = 22;
  else if (daysRunning >= 7) runScore = 14;
  else if (daysRunning >= 3) runScore = 8;
  else runScore = 3;

  // Platform spread score (0-25)
  const platformScore = Math.min(25, platforms.length * 8);

  // Format bonus (0-20)
  const formatScores: Record<string, number> = {
    'UGC Video': 20,
    Video: 18,
    Animation: 16,
    Carousel: 14,
    'Long-Form Copy': 12,
    'Image + Text': 10,
    'Short Punch': 8,
    'Question Hook': 10,
    'Emoji-Driven': 6,
    Urgency: 12,
    'Free Offer': 14,
  };
  const formatScore = formatScores[format] ?? 10;

  // CTA presence score (0-10)
  const ctaScore = hasCta ? 10 : 0;

  // Body length score (0-5) — longer copy signals more investment
  let lengthScore: number;
  if (bodyLength > 200) lengthScore = 5;
  else if (bodyLength > 100) lengthScore = 3;
  else if (bodyLength > 30) lengthScore = 2;
  else lengthScore = 1;

  return Math.min(100, runScore + platformScore + formatScore + ctaScore + lengthScore);
}

/**
 * Infer the creative format from ad metadata.
 */
function inferFormat(ad: FacebookAd): string {
  const body = (ad.ad_creative_body || '').toLowerCase();
  const title = (ad.ad_creative_link_title || '').toLowerCase();
  const cta = (ad.ad_creative_link_call_to_action || '').toLowerCase();
  const hasVideo = ad.ad_snapshot_url?.includes('video') || false;
  const hasImage = ad.ad_snapshot_url?.includes('image') || !hasVideo;

  if (hasVideo) return 'Video';
  if (body.includes('?') && body.length < 100) return 'Question Hook';
  if (body.includes('🔥') || body.includes('💯') || body.includes('✨')) return 'Emoji-Driven';
  if (body.includes('limited time') || body.includes('hurry') || body.includes('last chance')) return 'Urgency';
  if (body.includes('free') || body.includes('no cost')) return 'Free Offer';
  if (body.length > 150) return 'Long-Form Copy';
  if (body.length < 50) return 'Short Punch';
  if (hasImage && (title || cta)) return 'Image + Text';
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

/** Ad copy theme categories for clustering */
interface CopyTheme {
  name: string;
  keywords: string[];
  weight: number;
}

const COPY_THEMES: CopyTheme[] = [
  { name: 'Pain Point', keywords: ['problem', 'struggle', 'hate', 'tired of', 'sick of', 'stop', 'waste', 'burn'], weight: 1 },
  { name: 'Benefit', keywords: ['better', 'faster', 'easier', 'save', 'grow', 'boost', 'improve', 'increase'], weight: 1 },
  { name: 'Social Proof', keywords: ['million', 'trusted', 'join', 'customers', 'teams', 'companies', 'switched', 'chose'], weight: 1 },
  { name: 'Urgency', keywords: ['limited', 'hurry', 'last chance', 'today', 'now', 'ends', 'closing', 'expire'], weight: 1 },
  { name: 'Free/Offer', keywords: ['free', 'no cost', 'trial', 'discount', '% off', 'deal', 'save $'], weight: 1 },
  { name: 'Question Hook', keywords: ['?'], weight: 1 },
  { name: 'Number-Driven', keywords: ['\\d+x', '\\d+%', '\\$\\d+', '\\d+ min', '\\d+ sec', '\\d+ way'], weight: 1 },
  { name: 'Anti-Competitor', keywords: ['competitor', 'alternative', 'replace', 'switch', 'instead of', 'better than'], weight: 1 },
  { name: 'Fear/FOMO', keywords: ['missing', 'behind', 'falling behind', 'losing', 'left out', 'don\'t miss'], weight: 1 },
  { name: 'Curiosity', keywords: ['secret', 'nobody tells', 'hidden', 'trick', 'hack', 'unlock', 'reveal'], weight: 1 },
];

const ALL_FORMATS = ['Video', 'UGC Video', 'Carousel', 'Animation', 'Image + Text', 'Long-Form Copy', 'Short Punch', 'Question Hook', 'Emoji-Driven', 'Urgency', 'Free Offer'];

/**
 * Analyze competitor ads to identify market gaps and opportunities.
 * Production-grade analysis with copy clustering, uniqueness scoring,
 * and actionable insights.
 */
export function analyzeMarketGaps(ads: CompetitorAd[]): string[] {
  if (ads.length === 0) {
    return ['No competitor data available — be the first to define this space'];
  }

  const gaps: string[] = [];

  // ── 1. COPY THEME CLUSTERING ──────────────────────────────────────────
  // Classify each ad into themes, then find under-represented themes.
  const themeCounts = new Map<string, number>();
  COPY_THEMES.forEach((t) => themeCounts.set(t.name, 0));

  for (const ad of ads) {
    const body = ad.hook.toLowerCase();
    for (const theme of COPY_THEMES) {
      if (theme.keywords.some((kw) => body.includes(kw))) {
        themeCounts.set(theme.name, (themeCounts.get(theme.name) || 0) + 1);
      }
    }
  }

  const themeCoverage = Array.from(themeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const totalThemes = COPY_THEMES.length;
  const usedThemes = themeCoverage.filter(([, count]) => count > 0).length;

  // Find themes that no competitor uses
  const missingThemes = themeCoverage.filter(([, count]) => count === 0).map(([name]) => name);
  if (missingThemes.length > 0) {
    gaps.push(`Lead with ${missingThemes[0]} messaging — no competitor uses this angle`);
  }
  if (missingThemes.length > 1) {
    gaps.push(`Try ${missingThemes[1]} framing — completely untapped in this market`);
  }

  // ── 2. UNIQUENESS SCORING ─────────────────────────────────────────────
  // If all ads cluster on the same 1-2 themes, the market is undifferentiated.
  const topTheme = themeCoverage[0];
  if (topTheme && topTheme[1] > 0) {
    const concentration = topTheme[1] / ads.length;
    if (concentration > 0.6) {
      gaps.push(`Market is highly undifferentiated — ${Math.round(concentration * 100)}% of ads use "${topTheme[0]}" messaging. Be radically different.`);
    }
  }

  // If theme diversity is low, flag it
  if (usedThemes <= 2 && ads.length >= 3) {
    gaps.push('Competitors are all using the same messaging playbook — wide open for differentiation');
  }

  // ── 3. FORMAT COVERAGE ────────────────────────────────────────────────
  const formats = new Set(ads.map((a) => a.detectedFormat));
  const missingFormats = ALL_FORMATS.filter((f) => !formats.has(f));

  if (missingFormats.length > 0) {
    gaps.push(`Try ${missingFormats[0]} format — competitors aren't using it`);
  }
  if (missingFormats.length > 2) {
    gaps.push(`Explore ${missingFormats[2]} creative style for differentiation`);
  }

  // ── 4. COPY LENGTH ANALYSIS ───────────────────────────────────────────
  const avgLength = ads.reduce((sum, a) => sum + a.hook.length, 0) / ads.length;
  const lengthStdDev = Math.sqrt(
    ads.reduce((sum, a) => sum + Math.pow(a.hook.length - avgLength, 2), 0) / ads.length
  );

  if (avgLength > 120) {
    gaps.push('Try ultra-short punchy copy — market is saturated with long text');
  } else if (avgLength < 60) {
    gaps.push('Go long-form with detailed storytelling — market only has short hooks');
  }

  // If all ads are similar length, suggest variance
  if (lengthStdDev < 20 && ads.length >= 3) {
    gaps.push('All competitor ads are similar length — break the pattern with extreme variation');
  }

  // ── 5. PLATFORM COVERAGE ──────────────────────────────────────────────
  const allPlatforms = new Set<string>();
  ads.forEach((a) => (a.platforms || []).forEach((p) => allPlatforms.add(p)));
  const missingPlatforms = ['INSTAGRAM', 'FACEBOOK', 'AUDIENCE_NETWORK'].filter((p) => !allPlatforms.has(p));
  if (missingPlatforms.length > 0) {
    gaps.push(`Expand to ${missingPlatforms[0].toLowerCase()} — underserved platform`);
  }

  // ── 6. CTA ANALYSIS ───────────────────────────────────────────────────
  const ctaSet = new Set(ads.filter((a) => a.cta).map((a) => a.cta));
  const hasCtas = ctaSet.size > 0;
  if (!hasCtas) {
    gaps.push('Add a strong CTA — no competitor uses explicit call-to-action buttons');
  }

  // ── 7. ENGAGEMENT GAP ─────────────────────────────────────────────────
  const highEngagement = ads.filter((a) => a.engagement === 'Very High' || a.engagement === 'High');
  const lowEngagement = ads.filter((a) => a.engagement === 'Low');

  if (lowEngagement.length > highEngagement.length) {
    gaps.push('Many underperforming ads in this space — quality bar is low, easy to outperform');
  }

  // ── 8. MESSAGING GAPS ─────────────────────────────────────────────────
  const hasUrgency = ads.some((a) => a.hook.toLowerCase().includes('limited') || a.hook.toLowerCase().includes('hurry'));
  const hasSocialProof = ads.some((a) => a.hook.toLowerCase().includes('million') || a.hook.toLowerCase().includes('trusted'));
  const hasFreeOffer = ads.some((a) => a.hook.toLowerCase().includes('free'));
  const hasNumbers = ads.some((a) => /\d+x|\d+%|\$\d+/.test(a.hook));

  if (!hasUrgency) gaps.push('Add urgency-driven copy — no competitor uses time pressure');
  if (!hasSocialProof) gaps.push('Lead with social proof — no competitor shows traction numbers');
  if (!hasFreeOffer) gaps.push('Test a free trial or freemium hook — gap in the market');
  if (!hasNumbers && ads.length >= 3) gaps.push('Use specific numbers in copy — competitors rely on vague claims');

  return gaps.slice(0, 6);
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
        `- **${ad.brand}**: "${ad.hook}" (${ad.detectedFormat}, ${ad.engagement} engagement${ad.engagementScore != null ? ` [${ad.engagementScore}/100]` : ''}, running ${ad.runTime})${ad.cta ? ` [CTA: ${ad.cta}]` : ''}`
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
