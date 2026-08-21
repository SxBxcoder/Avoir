/**
 * Avoir — Real-Time Trends API
 *
 * GET /api/trends?industry=fashion
 *
 * Proxies to the Python backend (SerpAPI → YouTube → Gemini → empty).
 * No mock data — returns whatever the backend returns, including empty.
 */

import { NextResponse } from 'next/server';
import { fetchIndustryTrends } from '@/lib/trends';
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

    if (!trends || !trends.topTrends.length) {
      return NextResponse.json({
        trends: null,
        message: 'No trends available. Configure SERPAPI_KEY in backend/.env for real data.',
      });
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
