/**
 * Avoir — Push Notification Status API
 *
 * GET /api/push/status — Check the push subscription status for the authenticated user
 *
 * Returns the number of active subscriptions and the browser permission state.
 */

import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { countUserSubscriptions, listUserSubscriptions } from '@/lib/db/pushSubscriptions';
import { isDemoMode } from '@/lib/mockShield';
import type { PushStatusResponse } from '@/lib/push/types';

// ============================================================================
// GET — Check status
// ============================================================================

export async function GET(req: Request) {
  try {
    const { userId } = await requireUser(req);

    if (isDemoMode()) {
      const response: PushStatusResponse = {
        subscribed: true,
        permission: 'granted',
        subscriptionCount: 1,
      };
      return NextResponse.json(response);
    }

    const count = await countUserSubscriptions(userId);
    const subs = await listUserSubscriptions(userId);

    // If we have subscriptions stored but the user's browser says denied/default,
    // the subscriptions are stale (user cleared browser data).
    const response: PushStatusResponse = {
      subscribed: count > 0,
      permission: 'default',
      subscriptionCount: count,
    };

    // We don't store permission server-side (it's browser-only), but we
    // can infer: if subscriptions exist, permission was granted at some point.
    if (count > 0) {
      response.permission = 'granted';
    }

    return NextResponse.json(response);
  } catch (error) {
    const mapped = authErrorResponse(error);
    if (mapped) return mapped;
    console.error('[push/status] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
