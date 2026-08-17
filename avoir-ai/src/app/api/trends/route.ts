/**
 * Avoir — Real-Time Trends API
 * 
 * GET /api/trends?industry=fashion
 * 
 * Identity comes from the verified Cognito JWT. The endpoint is
 * authenticated because it triggers paid external LLM/data fetches per call —
 * leaving it open would let anyone run up cost.
 */

import { NextResponse } from 'next/server';
import { fetchIndustryTrends } from '@/lib/trends';
import { isDemoMode, MOCK_TRENDS } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ trends: MOCK_TRENDS });
  }

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
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

    if (!trends) {
      return NextResponse.json({ trends: null, message: 'No trends found for this industry.' });
    }

    return NextResponse.json({ trends });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('trends', 'GET failed', { err: error });
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
