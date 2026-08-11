import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignScore } from '@/lib/db/campaigns';
import { requireUser, UnauthorizedError } from '@/lib/auth/requireUser';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const { campaignId, isWinner } = await req.json();

    if (!campaignId || typeof isWinner !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const success = await updateCampaignScore(userId, campaignId, isWinner);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update campaign score' }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId, isWinner });
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Score API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
