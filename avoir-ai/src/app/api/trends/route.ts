/**
 * Avoir — Real-Time Trends API
 * 
 * GET /api/trends?industry=fashion
 */

import { NextResponse } from 'next/server';
import { fetchIndustryTrends } from '@/lib/trends';
import { isDemoMode, MOCK_TRENDS } from '@/lib/mockShield';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ trends: MOCK_TRENDS });
  }

  try {
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
  } catch (error: any) {
    console.error('[Trends API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
