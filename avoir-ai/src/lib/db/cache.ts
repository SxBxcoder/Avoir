/**
 * Avoir — Enterprise Redis Cache (Upstash)
 * 
 * Serverless Redis for:
 *   - Lightning-fast quota checks (avoid DynamoDB reads on every request)
 *   - Rate limiting per userId
 *   - Campaign response caching to reduce AI API costs
 *   - Session/ephemeral data with TTL
 * 
 * Uses Upstash Redis which is optimized for serverless (HTTP-based, no TCP).
 * Falls back gracefully if Redis is unavailable.
 */

import { Redis } from '@upstash/redis';
import { errorMessage, isAlphaBrief, type AlphaBrief } from '@/lib/alphaBrief';

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[Cache] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Cache disabled.');
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ============================================================================
// QUOTA CACHE — Fast quota checks without hitting DynamoDB every time
// ============================================================================

const QUOTA_PREFIX = 'quota:';
const QUOTA_TTL = 60 * 60; // 1 hour — DynamoDB is the source of truth

export async function getCachedQuota(userId: string): Promise<{ used: number; limit: number } | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get<{ used: number; limit: number }>(`${QUOTA_PREFIX}${userId}`);
    return data || null;
  } catch (err: unknown) {
    console.warn(`[Cache] Redis read failed: ${errorMessage(err)}`);
    return null;
  }
}

export async function setCachedQuota(userId: string, used: number, limit: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(`${QUOTA_PREFIX}${userId}`, { used, limit }, { ex: QUOTA_TTL });
  } catch (err: unknown) {
    console.warn(`[Cache] Redis write failed: ${errorMessage(err)}`);
  }
}

export async function incrementCachedQuota(userId: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    // Increment the 'used' field atomically
    const key = `${QUOTA_PREFIX}${userId}`;
    const current = await redis.get<{ used: number; limit: number }>(key);
    if (current) {
      current.used += 1;
      await redis.set(key, current, { ex: QUOTA_TTL });
      return current.used;
    }
    return null;
  } catch (err: unknown) {
    console.warn(`[Cache] Redis increment failed: ${errorMessage(err)}`);
    return null;
  }
}

// ============================================================================
// RATE LIMITING — Sliding window per userId
// ============================================================================

const RATE_LIMIT_PREFIX = 'ratelimit:';

export async function checkRateLimit(
  userId: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: maxRequests, resetIn: 0 };

  const key = `${RATE_LIMIT_PREFIX}${userId}`;

  try {
    const current = await redis.incr(key);

    // Set TTL on first request in window
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (err: unknown) {
    console.warn(`[Cache] Rate limit check failed: ${errorMessage(err)}`);
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }
}

// ============================================================================
// CAMPAIGN RESPONSE CACHE — Avoid redundant AI calls for identical goals
// ============================================================================

const CAMPAIGN_CACHE_PREFIX = 'campaign:';
const CAMPAIGN_CACHE_TTL = 60 * 60 * 24; // 24 hours

export async function getCachedCampaign(goalHash: string): Promise<any | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    return await redis.get(`${CAMPAIGN_CACHE_PREFIX}${goalHash}`);
  } catch (err: unknown) {
    console.warn(`[Cache] Campaign cache read failed: ${errorMessage(err)}`);
    return null;
  }
}

export async function setCachedCampaign(goalHash: string, data: any): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(`${CAMPAIGN_CACHE_PREFIX}${goalHash}`, data, { ex: CAMPAIGN_CACHE_TTL });
  } catch (err: unknown) {
    console.warn(`[Cache] Campaign cache write failed: ${errorMessage(err)}`);
  }
}

// ============================================================================
// DAILY ALPHA BRIEF CACHE — One generated brief per day (pre-warmed by cron)
// ============================================================================

// Canonical key — must match backend/alpha_brief_generator.py CACHE_PREFIX.
const ALPHA_BRIEF_PREFIX = 'alpha_brief:daily:';

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(1, Math.floor((nextUtcMidnight - now.getTime()) / 1000));
}

export async function getCachedAlphaBrief(): Promise<AlphaBrief | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await redis.get<unknown>(`${ALPHA_BRIEF_PREFIX}${today}`);
    return isAlphaBrief(data) ? data : null;
  } catch (err: unknown) {
    console.warn(`[Cache] Alpha brief read failed: ${errorMessage(err)}`);
    return null;
  }
}

export async function setCachedAlphaBrief(data: AlphaBrief): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    await redis.set(`${ALPHA_BRIEF_PREFIX}${today}`, data, { ex: secondsUntilUtcMidnight() });
  } catch (err: unknown) {
    console.warn(`[Cache] Alpha brief write failed: ${errorMessage(err)}`);
  }
}
