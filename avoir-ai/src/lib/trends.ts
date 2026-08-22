/**
 * Avoir — Real-Time Trend Injection Engine
 *
 * Orchestrates trend data from multiple sources with cascading fallback:
 *   1. Check DynamoDB cache (avoir-trends, 48h TTL)
 *   2. If cache miss → fetch from Python backend cascade
 *      (SerpAPI Google Trends → YouTube → Apify TikTok → Gemini)
 *   3. If Python backend down → enhanced mock data
 *   4. Cache the result for next time
 *
 * Data flow to LLM:
 *   trends.ts → synthesizeTrendContext() → bedrock.ts prompt injection
 */

import { getCachedTrendData, saveTrendData } from '@/lib/db/trendCache';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES (kept compatible with existing TrendRadar.tsx)
// ============================================================================

export interface TrendTopic {
  keyword: string;
  momentum: 'rising' | 'peaking' | 'falling';
  searchVolume: string;
  sentiment: 'positive' | 'neutral' | 'mixed';
  context: string;
}

export interface IndustryTrends {
  industry: string;
  topTrends: TrendTopic[];
  viralHooks: string[];
  lastUpdated: string;
  /** Which cascade tier produced this data (serpapi|youtube|apify|gemini) or cache/mock fallback. */
  source: 'serpapi' | 'pytrends' | 'reddit' | 'youtube' | 'apify' | 'gemini' | 'cache' | 'mock';
  /** When the cache expires (if cached) */
  cachedUntil?: string;
}

export interface TrendFetchOptions {
  /** Country filter (ISO code) */
  country?: string;
  /** Bypass cache and force fresh fetch */
  fresh?: boolean;
}

// ============================================================================
// PYTHON BACKEND CLIENT
// ============================================================================

// Points at the main FastAPI backend (backend/server.py) which exposes
// GET /api/trends backed by the SerpAPI → YouTube → Apify → Gemini cascade.
const PYTHON_BACKEND_URL = process.env.TRENDS_BACKEND_URL || 'http://localhost:8000';
const BACKEND_TIMEOUT = parseInt(process.env.TRENDS_BACKEND_TIMEOUT || '12000', 10);

/**
 * Fetch trend data from the Python backend trend cascade.
 * Returns null if backend is unreachable or returns an error.
 */
async function fetchFromBackend(
  industry: string,
  country: string = 'us',
  fresh: boolean = false
): Promise<IndustryTrends | null> {
  try {
    const params = new URLSearchParams({ industry, country });
    if (fresh) params.set('fresh', 'true');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

    const response = await fetch(`${PYTHON_BACKEND_URL}/api/trends?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('trends', 'Python backend returned error', { status: response.status, industry });
      return null;
    }

    const data = await response.json();
    // Backend shape: { status: "success", trends: { industry, topTrends, ... } }
    const raw = data?.trends;
    if (!raw || !Array.isArray(raw.topTrends)) return null;

    // Normalize the Python backend response to our TypeScript interface
    return {
      industry: raw.industry || industry,
      topTrends: (raw.topTrends as Record<string, string>[]).map((t) => ({
        keyword: t.keyword || '',
        momentum: (t.momentum || 'peaking') as TrendTopic['momentum'],
        searchVolume: t.searchVolume || t.search_volume || 'N/A',
        sentiment: (t.sentiment || 'neutral') as TrendTopic['sentiment'],
        context: t.context || '',
      })),
      viralHooks: raw.viralHooks || [],
      lastUpdated: raw.lastUpdated || new Date().toISOString(),
      source: raw.source || 'serpapi',
      cachedUntil: raw.cachedUntil,
    };
  } catch (error) {
    // Backend is down or timed out — this is expected in local dev
    if ((error as Error).name === 'AbortError') {
      logger.warn('trends', 'Python backend timed out', { industry });
    } else {
      logger.debug('trends', 'Python backend unreachable', { error: error as Error, industry });
    }
    return null;
  }
}

// ============================================================================
// MOCK DATA (fallback when backend unavailable)
// ============================================================================

const MOCK_TRENDS_DB: Record<string, IndustryTrends> = {
  fashion: {
    industry: 'fashion',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'sustainable luxury', momentum: 'rising', searchVolume: '+140%', sentiment: 'positive', context: 'Gen-Z moving away from fast fashion towards investment pieces.' },
      { keyword: 'Y2K revival', momentum: 'peaking', searchVolume: '2.4M', sentiment: 'mixed', context: 'Early 2000s aesthetics still dominating TikTok GRWM videos.' },
      { keyword: 'quiet outdoor', momentum: 'rising', searchVolume: '+85%', sentiment: 'positive', context: 'Gorpcore merging with quiet luxury.' },
    ],
    viralHooks: ['POV: You finally found the perfect...', 'Why everyone is ditching...', 'Unboxing the viral...'],
    source: 'mock',
  },
  tech: {
    industry: 'tech',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'AI productivity', momentum: 'peaking', searchVolume: '5.1M', sentiment: 'positive', context: 'Professionals seeking tools to automate repetitive tasks.' },
      { keyword: 'digital detox', momentum: 'rising', searchVolume: '+210%', sentiment: 'mixed', context: 'Pushback against screen time; demand for offline-first tools.' },
      { keyword: 'spatial computing', momentum: 'rising', searchVolume: '+300%', sentiment: 'neutral', context: 'Apple Vision Pro hype driving interest in mixed reality.' },
    ],
    viralHooks: ['The AI tool that saved me 10 hours...', 'Stop doing this manually...', 'Is this the end of...'],
    source: 'mock',
  },
  finance: {
    industry: 'finance',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'loud budgeting', momentum: 'peaking', searchVolume: '+450%', sentiment: 'positive', context: 'Being vocal about saving money instead of quiet luxury.' },
      { keyword: 'micro-investing', momentum: 'rising', searchVolume: '1.2M', sentiment: 'positive', context: 'Gen-Z investing spare change.' },
      { keyword: 'side hustle burnout', momentum: 'rising', searchVolume: '+120%', sentiment: 'mixed', context: 'Shift towards passive income over active secondary jobs.' },
    ],
    viralHooks: ['How I saved $10k by loud budgeting...', 'The truth about passive income...', "What your bank isn't telling you..."],
    source: 'mock',
  },
};

function getMockTrends(industry: string): IndustryTrends {
  const normalized = industry.toLowerCase().trim();
  const match = Object.keys(MOCK_TRENDS_DB).find((key) => normalized.includes(key));

  if (match) {
    return { ...MOCK_TRENDS_DB[match], source: 'mock', lastUpdated: new Date().toISOString() };
  }

  return {
    industry: 'general_commerce',
    lastUpdated: new Date().toISOString(),
    topTrends: [
      { keyword: 'creator economy 2.0', momentum: 'rising', searchVolume: '+90%', sentiment: 'positive', context: 'Shift from ad revenue to direct digital product sales.' },
      { keyword: 'authentic lo-fi', momentum: 'peaking', searchVolume: '+150%', sentiment: 'positive', context: 'Users ignoring highly polished ads in favor of raw, UGC-style content.' },
    ],
    viralHooks: ['Nobody is talking about this...', 'I tried the viral...', 'The secret to...'],
    source: 'mock',
  };
}

// ============================================================================
// ORCHESTRATION (Main entry point)
// ============================================================================

/**
 * Fetch industry trends with cascading fallback:
 * Cache → Python Backend → Mock Data
 */
export async function fetchIndustryTrends(
  industry: string,
  options: TrendFetchOptions = {}
): Promise<IndustryTrends | null> {
  const normalized = industry.toLowerCase().trim();
  const country = options.country || 'us';

  // 1. Check cache (unless force-refresh)
  if (!options.fresh) {
    const cached = await getCachedTrendData(normalized, country);
    if (cached) {
      return {
        industry: cached.industry || normalized,
        topTrends: (cached.topTrends || []) as TrendTopic[],
        viralHooks: cached.viralHooks || [],
        lastUpdated: cached.lastUpdated,
        source: 'cache',
        cachedUntil: cached.cachedUntil,
      };
    }
  }

  // 2. Fetch from Python backend
  const backendData = await fetchFromBackend(normalized, country, options.fresh);
  // Ignore empty cascade results (e.g. backend running without API keys,
  // source: "none") — never cache them, fall through to mock instead.
  if (backendData && backendData.topTrends.length > 0) {
    // Cache the result
    await saveTrendData(
      normalized,
      {
        industry: backendData.industry,
        topTrends: backendData.topTrends,
        viralHooks: backendData.viralHooks,
        lastUpdated: backendData.lastUpdated,
        source: backendData.source,
      },
      backendData.source,
      country
    );

    return backendData;
  }

  // 3. Mock fallback
  const mock = getMockTrends(normalized);
  logger.info('trends', 'Using mock data', { industry: normalized });
  return mock;
}

// ============================================================================
// CONTEXT FORMATTING (for LLM prompt injection)
// ============================================================================

/**
 * Format trend data into a string for LLM prompt injection.
 * Preserves the existing interface used by stream/route.ts.
 */
export function synthesizeTrendContext(trends: IndustryTrends): string {
  if (!trends || !trends.topTrends.length) return '';

  const sourceTag = {
    serpapi: '[LIVE · SerpAPI]',
    pytrends: '[LIVE · Google Trends]',
    reddit: '[LIVE · Reddit]',
    youtube: '[LIVE · YouTube]',
    apify: '[LIVE · TikTok/Apify]',
    gemini: '[AI · Gemini]',
    cache: '[CACHED]',
    mock: '[DEMO]',
  }[trends.source] || '[UNKNOWN]';

  const trendBullets = trends.topTrends
    .filter((t) => t.momentum === 'rising' || t.momentum === 'peaking')
    .map((t) => `- **${t.keyword.toUpperCase()}**: ${t.context} (Search Volume: ${t.searchVolume})`)
    .join('\n');

  const hookBullets = trends.viralHooks
    .map((h) => `- "${h}"`)
    .join('\n');

  return `REAL-TIME CULTURAL TRENDS ${sourceTag}:
${trendBullets}

CURRENT VIRAL HOOK FORMATS IN THIS INDUSTRY:
${hookBullets}

INSTRUCTION: Weave one of these trends or formats into your campaign naturally. Do not force it, but make the copy feel "of the moment".`;
}
