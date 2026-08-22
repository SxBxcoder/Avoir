/**
 * Avoir — Real-Time Trends API
 *
 * GET /api/trends — Fetch real-time trend data for an industry
 *
 * Query params:
 *   industry (required) — Industry keyword
 *   country  (optional) — ISO country code (default: 'us')
 *   fresh    (optional) — 'true' to bypass cache
 */

import { NextResponse } from 'next/server';
import { fetchIndustryTrends } from '@/lib/trends';
import { checkRateLimit } from '@/lib/db/cache';
import { isDemoMode, MOCK_TRENDS } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      trends: MOCK_TRENDS,
      source: 'mock',
    });
  }

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');
    const country = searchParams.get('country') || 'us';
    const fresh = searchParams.get('fresh') === 'true';

    if (!industry) {
      return NextResponse.json(
        { error: 'Missing required parameter: industry' },
        { status: 400 }
      );
    }

    // Rate limit BEFORE any external SerpAPI call. `fresh=true` bypasses the
    // DynamoDB cache, so without this cap a single authenticated user could
    // hammer the Python backend in a loop and exhaust our SerpAPI paid credits.
    const rateLimit = await checkRateLimit(userId, 10, 60); // 10 requests per minute
    if (!rateLimit.allowed) {
      logger.warn('trends', 'Rate limited', { resetInSeconds: rateLimit.resetIn, userId });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${rateLimit.resetIn} seconds.`,
          resetIn: rateLimit.resetIn,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetIn),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    const trends = await fetchIndustryTrends(industry, {
      country,
      fresh,
    });

    if (!trends || !trends.topTrends.length) {
      return NextResponse.json({
        trends: null,
        message: 'No trends available. Configure SERPAPI_KEY in backend/.env for real data.',
      });
    }

    return NextResponse.json({
      trends,
      source: trends.source,
      cachedUntil: trends.cachedUntil || null,
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('trends', 'GET failed', { error: error as Error });
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
