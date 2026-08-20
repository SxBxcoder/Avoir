/**
 * Avoir — Push Subscription API
 *
 * POST  /api/push/subscribe — Save a push subscription for the authenticated user
 * DELETE /api/push/subscribe — Remove a push subscription (unsubscribe)
 */

import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { saveSubscription, deleteSubscription, deleteAllUserSubscriptions } from '@/lib/db/pushSubscriptions';
import type { PushSubscriptionRecord } from '@/lib/push/types';
import { isDemoMode } from '@/lib/mockShield';

// ============================================================================
// POST — Subscribe
// ============================================================================

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const body = await req.json();
    const { endpoint, keys, teamId } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, keys.p256dh, keys.auth' },
        { status: 400 }
      );
    }

    if (typeof endpoint !== 'string' || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
      return NextResponse.json(
        { error: 'Invalid field types — all fields must be strings' },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      return NextResponse.json({
        ok: true,
        subscription: {
          userId: 'demo-user',
          endpoint,
          keys,
          createdAt: new Date().toISOString(),
          teamId,
        },
      });
    }

    const subscription: PushSubscriptionRecord = {
      userId,
      endpoint,
      keys,
      createdAt: new Date().toISOString(),
      teamId: teamId || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    };

    await saveSubscription(subscription);

    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    const mapped = authErrorResponse(error);
    if (mapped) return mapped;
    console.error('[push/subscribe] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE — Unsubscribe
// ============================================================================

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const body = await req.json();
    const { endpoint, all } = body;

    if (isDemoMode()) {
      return NextResponse.json({ ok: true });
    }

    if (all === true) {
      const count = await deleteAllUserSubscriptions(userId);
      return NextResponse.json({ ok: true, deleted: count });
    }

    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "endpoint" field' },
        { status: 400 }
      );
    }

    await deleteSubscription(userId, endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = authErrorResponse(error);
    if (mapped) return mapped;
    console.error('[push/subscribe] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
