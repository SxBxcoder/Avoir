import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignScore } from '@/lib/db/campaigns';
import { isDemoMode } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  // Demo Mock Shield: never write scores to DynamoDB under the shared demo
  // identity — mock data would otherwise be persisted for every viewer.
  if (isDemoMode()) {
    return NextResponse.json({ success: true });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { campaignId, isWinner } = body;

    if (typeof campaignId !== 'string' || !campaignId || typeof isWinner !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const success = await updateCampaignScore(userId, campaignId, isWinner);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update campaign score' }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId, isWinner });
  } catch (err: any) {
    const authErr = authErrorResponse(err);
    if (authErr) return authErr;
    console.error('[Score API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
