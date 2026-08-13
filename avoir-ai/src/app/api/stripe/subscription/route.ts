/**
 * Avoir — Subscription API Route (Enterprise Edition)
 * 
 * GET /api/stripe/subscription
 * 
 * Identity comes from the verified Cognito JWT (Authorization header).
 * Returns the current subscription state for a given user.
 * Backed by DynamoDB with Redis cache for lightning-fast reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSubscription } from '@/lib/services/subscription';
import { isDemoMode, MOCK_SUBSCRIPTION } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

// Force dynamic rendering — this route reads the request
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json(MOCK_SUBSCRIPTION);
  }

  try {
    // Identity comes from the verified Cognito JWT, not the query string.
    const { userId } = await requireUser(req);

    const sub = await getSubscription(userId);
    return NextResponse.json(sub);
  } catch (err: any) {
    const authErr = authErrorResponse(err);
    if (authErr) return authErr;
    console.error('[Subscription API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

