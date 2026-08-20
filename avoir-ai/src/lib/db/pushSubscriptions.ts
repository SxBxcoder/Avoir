/**
 * Avoir — Push Subscription DynamoDB Repository
 *
 * Stores browser push subscriptions keyed by userId + endpoint.
 * Used to send targeted push notifications to specific users or teams.
 *
 * Table: avoir-push-subscriptions
 *   PK: userId   (Cognito sub)
 *   SK: endpoint (push subscription endpoint URL)
 *
 * GSI: teamId-index — queries all subscriptions for a team (broadcast)
 */

import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import type { PushSubscriptionRecord } from '@/lib/push/types';
import { logger } from '@/lib/logger';

// ============================================================================
// CREATE / SAVE
// ============================================================================

/**
 * Saves or updates a push subscription for a user.
 * Upserts: if the endpoint already exists for this user, it overwrites keys.
 */
export async function saveSubscription(sub: PushSubscriptionRecord): Promise<void> {
  const client = getDynamoClient();

  await client.send(
    new PutCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      Item: {
        userId: sub.userId,
        endpoint: sub.endpoint,
        keys: sub.keys,
        createdAt: sub.createdAt,
        teamId: sub.teamId || undefined,
        userAgent: sub.userAgent || undefined,
      },
    })
  );

  logger.info('[push-subscriptions] Saved subscription', {
    userId: sub.userId,
    teamId: sub.teamId,
  });
}

// ============================================================================
// READ
// ============================================================================

/**
 * Fetches a specific subscription by userId + endpoint.
 */
export async function getSubscription(
  userId: string,
  endpoint: string
): Promise<PushSubscriptionRecord | null> {
  const client = getDynamoClient();

  const result = await client.send(
    new GetCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      Key: { userId, endpoint },
    })
  );

  if (!result.Item) return null;

  return {
    userId: result.Item.userId as string,
    endpoint: result.Item.endpoint as string,
    keys: result.Item.keys as { p256dh: string; auth: string },
    createdAt: result.Item.createdAt as string,
    teamId: result.Item.teamId as string | undefined,
    userAgent: result.Item.userAgent as string | undefined,
  };
}

/**
 * Lists all subscriptions for a user (multiple browsers/devices).
 */
export async function listUserSubscriptions(
  userId: string
): Promise<PushSubscriptionRecord[]> {
  const client = getDynamoClient();

  const result = await client.send(
    new QueryCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    })
  );

  return (result.Items || []).map((item) => ({
    userId: item.userId as string,
    endpoint: item.endpoint as string,
    keys: item.keys as { p256dh: string; auth: string },
    createdAt: item.createdAt as string,
    teamId: item.teamId as string | undefined,
    userAgent: item.userAgent as string | undefined,
  }));
}

/**
 * Lists all subscriptions for a team (broadcast to all team members).
 * Uses the teamId-index GSI.
 */
export async function listTeamSubscriptions(
  teamId: string
): Promise<PushSubscriptionRecord[]> {
  const client = getDynamoClient();

  const result = await client.send(
    new QueryCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      IndexName: 'teamId-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
    })
  );

  return (result.Items || []).map((item) => ({
    userId: item.userId as string,
    endpoint: item.endpoint as string,
    keys: item.keys as { p256dh: string; auth: string },
    createdAt: item.createdAt as string,
    teamId: item.teamId as string | undefined,
    userAgent: item.userAgent as string | undefined,
  }));
}

/**
 * Counts subscriptions for a user.
 */
export async function countUserSubscriptions(userId: string): Promise<number> {
  const client = getDynamoClient();

  const result = await client.send(
    new QueryCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Select: 'COUNT',
    })
  );

  return result.Count || 0;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Removes a specific push subscription (unsubscribe from one device).
 */
export async function deleteSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const client = getDynamoClient();

  await client.send(
    new DeleteCommand({
      TableName: TABLES.PUSH_SUBSCRIPTIONS,
      Key: { userId, endpoint },
    })
  );

  logger.info('[push-subscriptions] Deleted subscription', { userId });
}

/**
 * Removes all subscriptions for a user (unsubscribe from all devices).
 */
export async function deleteAllUserSubscriptions(userId: string): Promise<number> {
  const subs = await listUserSubscriptions(userId);
  const client = getDynamoClient();

  for (const sub of subs) {
    await client.send(
      new DeleteCommand({
        TableName: TABLES.PUSH_SUBSCRIPTIONS,
        Key: { userId, endpoint: sub.endpoint },
      })
    );
  }

  logger.info('[push-subscriptions] Deleted all subscriptions', {
    userId,
    count: subs.length,
  });

  return subs.length;
}

/**
 * Removes stale subscriptions that a browser has abandoned.
 * Called periodically or when a push fails with 404/410.
 */
export async function deleteStaleSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await deleteSubscription(userId, endpoint);
  logger.info('[push-subscriptions] Removed stale subscription', { userId });
}
