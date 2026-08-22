/**
 * Avoir — Live Arbitrage Feed API
 *
 * GET /api/arbitrage?industry=fashion
 *
 * Derives arbitrage opportunities from the live trend cascade
 * (SerpAPI → YouTube → Apify → Gemini). No mock data — returns whatever
 * the backend returns, including an empty opportunity list.
 */

import { NextResponse } from 'next/server';
import { fetchIndustryTrends } from '@/lib/trends';
import { mapTrendsToOpportunities } from '@/lib/arbitrage';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    await requireUser(req);

    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');

    if (!industry) {
      return NextResponse.json(
        { error: 'Missing required parameter: industry' },
        { status: 400 }
      );
    }

    const trends = await fetchIndustryTrends(industry);
    const opportunities = mapTrendsToOpportunities(trends, industry);

    if (opportunities.length === 0) {
      return NextResponse.json({
        opportunities: [],
        source: 'none',
        lastUpdated: null,
        message: 'No arbitrage opportunities available. Configure SERPAPI_KEY, YOUTUBE_API_KEY, or APIFY_API_TOKEN in backend/.env for real data.',
      });
    }

    return NextResponse.json({
      opportunities,
      source: trends?.source ?? 'unknown',
      lastUpdated: trends?.lastUpdated ?? null,
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('arbitrage', 'GET failed', { err: error });
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage opportunities' },
      { status: 500 }
    );
  }
}
