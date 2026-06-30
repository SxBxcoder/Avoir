/**
 * Avoir — Campaign History API
 * 
 * GET /api/campaigns?userId=xxx&limit=20
 * 
 * Returns paginated campaign history for a user.
 * Campaigns are sorted newest-first from DynamoDB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCampaigns, getCampaign, deleteCampaign } from '@/lib/db/campaigns';
import { isDemoMode, MOCK_CAMPAIGNS } from '@/lib/mockShield';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      campaigns: MOCK_CAMPAIGNS,
      hasMore: false,
      count: MOCK_CAMPAIGNS.length,
    });
  }

  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const campaignId = req.nextUrl.searchParams.get('campaignId');

    // Single campaign lookup
    if (campaignId) {
      const campaign = await getCampaign(userId, campaignId);
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      return NextResponse.json(campaign);
    }

    // List campaigns (paginated)
    const result = await listCampaigns(userId, limit);
    return NextResponse.json({
      campaigns: result.campaigns,
      hasMore: !!result.lastKey,
      count: result.campaigns.length,
    });
  } catch (err: any) {
    console.error('[Campaigns API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({ success: true });
  }

  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const campaignId = req.nextUrl.searchParams.get('campaignId');

    if (!userId || !campaignId) {
      return NextResponse.json({ error: 'Missing userId or campaignId' }, { status: 400 });
    }

    const success = await deleteCampaign(userId, campaignId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Campaigns API] Delete Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
