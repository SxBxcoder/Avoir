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
import { z } from 'zod';
import { fetchCompetitorIntel } from '@/lib/db/competitors';
import { checkRateLimit } from '@/lib/db/cache';
import { isDemoMode, MOCK_COMPETITOR_INTEL } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ============================================================================
// ZOD VALIDATION
// ============================================================================

const competitorsQuerySchema = z.object({
  industry: z.string().min(1, 'Industry is required').max(100),
  country: z
    .string()
    .default('ALL')
    .refine((val) => val === 'ALL' || /^[A-Z]{2}$/.test(val), {
      message: 'Invalid country code. Use ISO 3166-1 alpha-2 (e.g., "US", "GB") or "ALL".',
    }),
  pageIds: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const ids = val.split(',').map((id) => id.trim()).filter(Boolean);
      return ids.length <= 10 && ids.every((id) => /^\d+$/.test(id));
    },
    { message: 'pageIds must be comma-separated numeric Facebook page IDs (max 10).' }
  ),
  fresh: z.enum(['true', 'false']).default('false'),
});

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      intel: MOCK_COMPETITOR_INTEL,
      source: 'mock',
    });
  }

  const startTime = Date.now();

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const { searchParams } = new URL(req.url);

    // Validate with Zod — replaces manual regex checks
    const parsed = competitorsQuerySchema.safeParse({
      industry: searchParams.get('industry'),
      country: searchParams.get('country') || 'ALL',
      pageIds: searchParams.get('pageIds') || undefined,
      fresh: searchParams.get('fresh') || 'false',
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const { industry, country, pageIds: pageIdsRaw, fresh: freshRaw } = parsed.data;
    const fresh = freshRaw === 'true';

    const pageIds = pageIdsRaw
      ? pageIdsRaw.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;

    // Rate limit BEFORE any external Facebook Ad Library call.
    const rateLimit = await checkRateLimit(userId, 10, 60);
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

    // Structured log: request received
    logger.info('competitors', 'Request received', {
      userId,
      industry,
      country,
      pageIds: pageIds?.length ?? 0,
      fresh,
    });

    const intel = await fetchCompetitorIntel(industry, {
      country,
      pageIds,
      fresh,
    });

    const durationMs = Date.now() - startTime;

    if (!intel) {
      logger.info('competitors', 'No data found', { industry, country, durationMs });
      return NextResponse.json({
        intel: null,
        source: 'none',
        message: 'No competitor data found for this industry.',
      });
    }

    // Structured log: request completed
    logger.info('competitors', 'Request completed', {
      industry,
      country,
      source: intel.source,
      adCount: intel.topAds.length,
      gapCount: intel.marketGaps.length,
      durationMs,
    });

    return NextResponse.json({
      intel,
      source: intel.source,
      cachedUntil: intel.cachedUntil || null,
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('competitors', 'GET failed', {
      error: error as Error,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: 'Failed to fetch competitor intel' },
      { status: 500 }
    );
  }
}
