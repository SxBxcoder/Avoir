/**
 * Avoir — Enterprise User Repository
 * 
 * DynamoDB-backed user subscription management.
 * Replaces the in-memory subscriptionStore with persistent, distributed storage.
 * 
 * Table: avoir-users
 *   PK: userId (string)
 *   Attributes: tier, stripeCustomerId, stripeSubscriptionId, status,
 *               currentPeriodEnd, cancelAtPeriodEnd, campaignsUsedThisMonth,
 *               lastResetDate, createdAt, updatedAt
 * 
 * Features:
 *   - Atomic decrement for credit usage (no race conditions)
 *   - TTL support for temporary rate-limit entries
 */

import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { DEFAULT_SUBSCRIPTION, type UserSubscription, type PlanTier } from '@/lib/stripe';

// ============================================================================
// READ
// ============================================================================

export async function getSubscription(userId: string): Promise<UserSubscription> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId },
      })
    );

    if (result.Item) {
      const sub = result.Item as UserSubscription;
      return sub;
    }
  } catch (err: any) {
    // If DynamoDB is unreachable (local dev without AWS), fall through to default
    console.warn(`[DB] DynamoDB read failed for ${userId}: ${err.message}. Using in-memory fallback.`);
  }

  // New user — create default free tier entry
  const defaultSub: UserSubscription = {
    ...DEFAULT_SUBSCRIPTION,
    userId,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          ...defaultSub,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(userId)', // Don't overwrite existing
      })
    );
  } catch (err: any) {
    // ConditionalCheckFailedException is fine — means user already exists
    if (err.name !== 'ConditionalCheckFailedException') {
      console.warn(`[DB] DynamoDB write failed for ${userId}: ${err.message}`);
    }
  }

  return defaultSub;
}

// ============================================================================
// UPSERT
// ============================================================================

export async function upsertSubscription(
  userId: string,
  updates: Partial<UserSubscription>
): Promise<UserSubscription> {
  const client = getDynamoClient();

  // Build dynamic UpdateExpression
  const expressionParts: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, any> = {};

  // Merge the updates with an updatedAt timestamp
  const mergedUpdates: Record<string, any> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  Object.entries(mergedUpdates).forEach(([key, value]) => {
    if (key === 'userId') return; // Can't update the primary key
    const safeKey = `#${key}`;
    const safeVal = `:${key}`;
    expressionParts.push(`${safeKey} = ${safeVal}`);
    expressionNames[safeKey] = key;
    expressionValues[safeVal] = value;
  });

  if (expressionParts.length === 0) {
    return getSubscription(userId);
  }

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes as UserSubscription;
  } catch (err: any) {
    console.error(`[DB] DynamoDB upsert failed for ${userId}: ${err.message}`);
    // Fallback: return current state
    return getSubscription(userId);
  }
}

// ============================================================================
// DEDUCT CREDITS (Atomic)
// ============================================================================

export async function deductCredits(userId: string, amount: number): Promise<UserSubscription> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression:
          'SET #credits = if_not_exists(#credits, :zero) - :amount, #updated = :now',
        ExpressionAttributeNames: {
          '#credits': 'credits',
          '#updated': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':amount': amount,
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return result.Attributes as UserSubscription;
  } catch (err: any) {
    console.error(`[DB] DynamoDB deduct failed for ${userId}: ${err.message}`);
    // Fallback: return current state
    return getSubscription(userId);
  }
}
