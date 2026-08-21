/**
 * Avoir — Competitor Intelligence API
 *
 * GET /api/competitors — Fetch competitor intelligence for an industry
 *
 * Query params:
 *   industry (required) — Industry keyword
 *   country  (optional) — ISO country code or 'ALL' (default: 'ALL')
 *   pageIds  (optional) — Comma-separated Facebook page IDs for specific competitors
 *   fresh    (optional) — 'true' to bypass cache and force fresh fetch
 */

import { NextResponse } from 'next/server';
import { fetchCompetitorIntel } from '@/lib/db/competitors';
import { checkRateLimit } from '@/lib/db/cache';
import { isDemoMode, MOCK_COMPETITOR_INTEL } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      intel: MOCK_COMPETITOR_INTEL,
      source: 'mock',
    });
  }

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const { searchParams } = new URL(req.url);
    const industry = searchParams.get('industry');
    const country = searchParams.get('country') || 'ALL';
    const pageIdsRaw = searchParams.get('pageIds');
    const fresh = searchParams.get('fresh') === 'true';

    if (!industry) {
      return NextResponse.json(
        { error: 'Missing required parameter: industry' },
        { status: 400 }
      );
    }

    // Validate country (ISO 3166-1 alpha-2 or ALL)
    if (country !== 'ALL' && !/^[A-Z]{2}$/.test(country)) {
      return NextResponse.json(
        { error: 'Invalid country code. Use ISO 3166-1 alpha-2 (e.g., "US", "GB") or "ALL".' },
        { status: 400 }
      );
    }

    const pageIds = pageIdsRaw
      ? pageIdsRaw.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 10)
      : undefined;

    // Rate limit BEFORE any external Facebook Ad Library call. `fresh=true` and
    // `pageIds` bypass the DynamoDB cache, so without this cap a single
    // authenticated user could hammer Meta's API in a loop and exhaust our app
    // review limits (or get the Avoir app banned for abuse).
    const rateLimit = await checkRateLimit(userId, 10, 60); // 10 requests per minute
    if (!rateLimit.allowed) {
      logger.warn('competitors', 'Rate limited', { resetInSeconds: rateLimit.resetIn, userId });
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

    const intel = await fetchCompetitorIntel(industry, {
      country,
      pageIds,
      fresh,
    });

    if (!intel) {
      return NextResponse.json({
        intel: null,
        source: 'none',
        message: 'No competitor data found for this industry.',
      });
    }

    return NextResponse.json({
      intel,
      source: intel.source,
      cachedUntil: intel.cachedUntil || null,
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('competitors', 'GET failed', { error: error as Error });
    return NextResponse.json(
      { error: 'Failed to fetch competitor intel' },
      { status: 500 }
    );
  }
}
