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
import { logger } from '@/lib/logger';

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
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    // Never leak internal error text (DynamoDB/AWS SDK messages) to the client.
    logger.error('intelligence', 'GET failed', { err: error });
    return NextResponse.json(
      { error: 'Failed to fetch intelligence brief' },
      { status: 500 }
    );
  }
}
