/**
 * Avoir — Push Subscription API
 *
 * POST  /api/push/subscribe — Save a push subscription for the authenticated user
 * DELETE /api/push/subscribe — Remove a push subscription (unsubscribe)
 *
 * If a teamId is provided in the body, membership is verified before saving.
 * Users cannot associate their subscription with a team they don't belong to.
 */

import { NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { saveSubscription, deleteSubscription, deleteAllUserSubscriptions } from '@/lib/db/pushSubscriptions';
import type { PushSubscriptionRecord } from '@/lib/push/types';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

// ============================================================================
// TEAM MEMBERSHIP VERIFICATION
// ============================================================================

async function verifyTeamMembership(userId: string, teamId: string): Promise<boolean> {
  // Fast path: Redis cache
  try {
    const { Redis } = await import('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const redis = new Redis({ url, token });
      const cached = await redis.get(`team:member:${teamId}:${userId}`);
      if (cached) return true;
    }
  } catch { /* Redis unavailable */ }

  // Fallback: DynamoDB
  try {
    const { getDynamoClient, TABLES } = await import('@/lib/db/dynamodb');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const client = getDynamoClient();
    const result = await client.send(
      new GetCommand({ TableName: TABLES.TEAM_MEMBERS, Key: { teamId, userId } })
    );
    return !!result.Item?.role;
  } catch { /* DynamoDB unavailable */ }

  return false;
}

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

    // Verify team membership before associating subscription with a team
    let verifiedTeamId: string | undefined;
    if (teamId) {
      if (typeof teamId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid teamId' },
          { status: 400 }
        );
      }
      const isMember = await verifyTeamMembership(userId, teamId);
      if (!isMember) {
        return NextResponse.json(
          { error: 'You are not a member of this team.' },
          { status: 403 }
        );
      }
      verifiedTeamId = teamId;
    }

    if (isDemoMode()) {
      return NextResponse.json({
        ok: true,
        subscription: {
          userId: 'demo-user',
          endpoint,
          keys,
          createdAt: new Date().toISOString(),
          teamId: verifiedTeamId,
        },
      });
    }

    const subscription: PushSubscriptionRecord = {
      userId,
      endpoint,
      keys,
      createdAt: new Date().toISOString(),
      teamId: verifiedTeamId,
      userAgent: req.headers.get('user-agent') || undefined,
    };

    await saveSubscription(subscription);

    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    const mapped = authErrorResponse(error);
    if (mapped) return mapped;
    logger.error('[push/subscribe]', 'POST handler failed', { error: error as Error });
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
    logger.error('[push/subscribe]', 'DELETE handler failed', { error: error as Error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
