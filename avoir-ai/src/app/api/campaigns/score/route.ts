import { NextRequest, NextResponse } from 'next/server';
import { updateCampaignScore } from '@/lib/db/campaigns';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const { userId, campaignId, isWinner } = await req.json();

    if (!userId || !campaignId || typeof isWinner !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const success = await updateCampaignScore(userId, campaignId, isWinner);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update campaign score' }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId, isWinner });
  } catch (err: any) {
    console.error('[Score API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
