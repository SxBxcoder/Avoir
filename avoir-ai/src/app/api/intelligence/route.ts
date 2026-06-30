/**
 * Avoir — Intelligence API
 * 
 * GET /api/intelligence?userId=...
 */

import { NextResponse } from 'next/server';
import { getIntelligenceBrief } from '@/lib/db/intelligence';
import { isDemoMode, MOCK_INTELLIGENCE } from '@/lib/mockShield';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ brief: MOCK_INTELLIGENCE });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    const brief = await getIntelligenceBrief(userId);

    // If no brief exists yet, return a default BRONZE state
    return NextResponse.json({
      brief: brief || {
        userId,
        level: 'BRONZE',
        totalCampaignsGenerated: 0,
        successfulFormats: [],
        avoidedFormats: [],
        audienceInsights: [],
        lastUpdated: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    console.error('[Intelligence API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch intelligence brief' },
      { status: 500 }
    );
  }
}
