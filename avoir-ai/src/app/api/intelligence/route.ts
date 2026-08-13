/**
 * Avoir — Intelligence API
 * 
 * GET /api/intelligence
 * 
 * Identity comes from the verified Cognito JWT (Authorization header).
 */

import { NextResponse } from 'next/server';
import { getIntelligenceBrief } from '@/lib/db/intelligence';
import { isDemoMode, MOCK_INTELLIGENCE } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ brief: MOCK_INTELLIGENCE });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the query string.
    const { userId } = await requireUser(req);

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
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('[Intelligence API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch intelligence brief' },
      { status: 500 }
    );
  }
}
