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
  deductCredits as dbDeductCredits,
} from '@/lib/db';
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
  return result;
}

/**
 * Deduct credits atomically.
 * Updates DynamoDB (source of truth).
 */
export async function deductCredits(userId: string, amount: number): Promise<UserSubscription> {
  return await dbDeductCredits(userId, amount);
}
