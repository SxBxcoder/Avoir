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
import { logger } from '@/lib/logger';

function isConditionalCheckFailed(err: unknown): boolean {
  return err instanceof Error && err.name === 'ConditionalCheckFailedException';
}

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
  } catch (err: unknown) {
    // If DynamoDB is unreachable (local dev without AWS), fall through to default
    logger.warn('db.users', 'DynamoDB read failed, using default subscription', { userId, err });
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
  } catch (err: unknown) {
    // ConditionalCheckFailedException is fine — means user already exists
    if (!isConditionalCheckFailed(err)) {
      logger.warn('db.users', 'DynamoDB write failed', { userId, err });
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
  } catch (err: unknown) {
    logger.error('db.users', 'DynamoDB upsert failed', { userId, err });
    // Fallback: return current state
    return getSubscription(userId);
  }
}

// ============================================================================
// ADD CREDITS (Atomic) — used to refund a reservation when generation fails
// ============================================================================

export async function addCredits(userId: string, amount: number): Promise<UserSubscription> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression:
          'SET #credits = if_not_exists(#credits, :zero) + :amount, #updated = :now',
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
  } catch (err: unknown) {
    // Non-fatal: the caller falls back to the current balance on failure.
    logger.error('db.users', 'Credit refund failed', { userId, err });
    return getSubscription(userId);
  }
}

// ============================================================================
// DEDUCT CREDITS (Atomic + Conditional)
// ============================================================================

export interface CreditDeductionResult {
  /** Whether the balance had `amount` credits available and the decrement ran. */
  success: boolean;
  /** The subscription state after the attempt (unchanged when `success` is false). */
  subscription: UserSubscription;
}

export async function deductCredits(userId: string, amount: number): Promise<CreditDeductionResult> {
  return deductCreditsOnce(userId, amount, false);
}

async function deductCreditsOnce(
  userId: string,
  amount: number,
  retried: boolean
): Promise<CreditDeductionResult> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        // The ConditionExpression makes the decrement atomic: a concurrent
        // spend can never drive the balance below zero, and callers learn
        // whether the balance was actually available instead of blindly going
        // negative (previously any caller could overdraw and keep spending).
        UpdateExpression: 'SET #credits = #credits - :amount, #updated = :now',
        ConditionExpression: '#credits >= :amount',
        ExpressionAttributeNames: {
          '#credits': 'credits',
          '#updated': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':amount': amount,
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return {
      success: true,
      subscription: result.Attributes as UserSubscription,
    };
  } catch (err: unknown) {
    // ConditionalCheckFailedException is the expected "balance too low" outcome.
    if (isConditionalCheckFailed(err)) {
      const subscription = await getSubscription(userId);
      // A brand-new user has no DynamoDB row yet, so their first conditional
      // decrement fails and getSubscription just bootstrapped the default row
      // with the full free-tier balance. Retry the deduction once now that the
      // row exists; a genuinely insufficient balance still fails.
      if (!retried && subscription.credits >= amount) {
        return deductCreditsOnce(userId, amount, true);
      }
      return { success: false, subscription };
    }
    logger.error('db.users', 'DynamoDB deduct failed', { userId, err });
    // Fail closed: when we cannot prove the deduction, do not grant the spend.
    return { success: false, subscription: await getSubscription(userId) };
  }
}

