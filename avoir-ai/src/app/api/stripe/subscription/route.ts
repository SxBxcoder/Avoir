/**
 * Avoir — Subscription API Route (Enterprise Edition)
 * 
 * GET /api/stripe/subscription?userId=xxx
 * 
 * Returns the current subscription state for a given user.
 * Backed by DynamoDB with Redis cache for lightning-fast reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSubscription } from '@/lib/services/subscription';
import { isDemoMode, MOCK_SUBSCRIPTION } from '@/lib/mockShield';

// Force dynamic rendering — this route reads query params
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json(MOCK_SUBSCRIPTION);
  }

  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const sub = await getSubscription(userId);
    return NextResponse.json(sub);
  } catch (err: any) {
    console.error('[Subscription API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

