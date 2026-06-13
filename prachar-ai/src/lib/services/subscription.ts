/**
 * Prachar.ai — Subscription Service
 * 
 * Shared service layer used by subscription route, generate route, and webhook.
 * Encapsulates DynamoDB + Redis cache operations for subscriptions.
 * 
 * This exists as a separate module because Next.js App Router 
 * forbids non-handler exports from route.ts files.
 */

import {
  getSubscription as dbGetSubscription,
  upsertSubscription as dbUpsertSubscription,
  incrementCampaignCount as dbIncrementCampaignCount,
} from '@/lib/db';
import {
  setCachedQuota,
  incrementCachedQuota,
} from '@/lib/db/cache';
import { PLANS, type UserSubscription } from '@/lib/stripe';

/**
 * Get subscription for a user.
 * Reads from DynamoDB with auto-reset for new billing periods.
 */
export async function getSubscription(userId: string): Promise<UserSubscription> {
  return dbGetSubscription(userId);
}

/**
 * Upsert subscription data.
 * Writes to DynamoDB and updates Redis cache.
 */
export async function upsertSubscription(
  userId: string,
  updates: Partial<UserSubscription>
): Promise<UserSubscription> {
  const result = await dbUpsertSubscription(userId, updates);

  // Update cache with new quota
  const plan = PLANS[result.tier];
  await setCachedQuota(userId, result.campaignsUsedThisMonth, plan.campaignsPerMonth);

  return result;
}

/**
 * Increment campaign count atomically.
 * Updates both DynamoDB (source of truth) and Redis cache.
 */
export async function incrementCampaignCount(userId: string): Promise<UserSubscription> {
  const result = await dbIncrementCampaignCount(userId);

  // Update cache
  await incrementCachedQuota(userId);

  return result;
}
