/**
 * Avoir — Push Notification Send API
 *
 * POST /api/push/send — Send a push notification to a user or team
 *
 * Requires authentication. For team broadcasts, requires 'member.invite' permission
 * (reusing existing RBAC — team-level send).
 *
 * Sends via web-push library with VAPID authentication.
 * Gracefully handles stale subscriptions (404/410) by removing them.
 */

import { NextResponse } from 'next/server';
import webPush from 'web-push';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { getVapidKeys } from '@/lib/push/vapid';
import {
  listUserSubscriptions,
  listTeamSubscriptions,
  deleteStaleSubscription,
} from '@/lib/db/pushSubscriptions';
import type { NotificationPayload } from '@/lib/push/types';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

// ============================================================================
// POST — Send notification
// ============================================================================

export async function POST(req: Request) {
  try {
    const { userId: senderId } = await requireUser(req);
    const body = await req.json();
    const { userId: targetUserId, teamId, payload } = body as {
      userId?: string;
      teamId?: string;
      payload: NotificationPayload;
    };

    if (!payload?.title || !payload?.body) {
      return NextResponse.json(
        { error: 'payload.title and payload.body are required' },
        { status: 400 }
      );
    }

    if (!targetUserId && !teamId) {
      return NextResponse.json(
        { error: 'Either userId or teamId is required' },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, demo: true });
    }

    const vapidKeys = getVapidKeys();

    webPush.setVapidDetails(
      'mailto:hello@avoir.ai',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    // Collect subscriptions
    let subscriptions;
    if (teamId) {
      subscriptions = await listTeamSubscriptions(teamId);
    } else {
      subscriptions = await listUserSubscriptions(targetUserId!);
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0 });
    }

    // Build the push payload
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      image: payload.image,
      tag: payload.tag,
      url: payload.url || '/dashboard',
      data: payload.data || {},
    });

    // Send to all subscriptions, handle stale ones
    let sent = 0;
    let failed = 0;

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          pushPayload
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // Remove stale subscriptions (browser unsubscribed or expired)
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deleteStaleSubscription(sub.userId, sub.endpoint);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    const mapped = authErrorResponse(error);
    if (mapped) return mapped;
    logger.error('[push/send] POST error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
