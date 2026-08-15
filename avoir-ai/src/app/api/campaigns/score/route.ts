import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignScore } from '@/lib/db/campaigns';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const scoreSchema = z.object({
  campaignId: z.string().min(1),
  isWinner: z.boolean(),
});

export async function PUT(req: NextRequest) {
  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const parsed = await parseJsonBody(req, scoreSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const { campaignId, isWinner } = parsed.data;

    const success = await updateCampaignScore(userId, campaignId, isWinner);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update campaign score' }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId, isWinner });
  } catch (err: any) {
    const authErr = authErrorResponse(err);
    if (authErr) return authErr;
    logger.error('score', 'Failed to update score', { err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
