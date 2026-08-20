/**
 * Avoir — Team-Scoped Rate Limiter
 *
 * Rate limits API requests per-team using a sliding window counter
 * stored in Upstash Redis. Falls back to a permissive in-memory limiter
 * when Redis is unavailable (local dev).
 *
 * Rate limits by plan:
 *   Free:      60 requests/min per team
 *   Starter:   120 requests/min per team
 *   Pro:       300 requests/min per team
 *   Enterprise: 1000 requests/min per team
 */

import { logger } from '@/lib/logger';

interface RateLimitConfig {
  teamId: string;
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
  windowMs?: number;
  maxRequests?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 60,
  starter: 120,
  pro: 300,
  enterprise: 1000,
};

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

// ============================================================================
// IN-MEMORY FALLBACK (for local dev without Redis)
// ============================================================================

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs, limit: maxRequests };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, limit: maxRequests };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt, limit: maxRequests };
}

// ============================================================================
// REDIS SLIDING WINDOW
// ============================================================================

async function redisRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const { Redis } = await import('@upstash/redis');
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return memoryRateLimit(key, maxRequests, windowMs);
  }

  const redis = new Redis({ url, token });
  const now = Date.now();
  const windowStart = now - windowMs;

  // Sliding window with sorted sets
  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart); // Remove expired entries
  pipe.zadd(key, { score: now, member: `${now}-${Math.random().toString(36).slice(2)}` });
  pipe.zcard(key); // Count requests in window
  pipe.pexpire(key, windowMs); // Set TTL on the key

  const results = await pipe.exec();
  const requestCount = (results[2] as number) || 0;
  const resetAt = now + windowMs;

  // Clean up in-memory store periodically
  if (memoryStore.size > 10000) {
    for (const [k, v] of Array.from(memoryStore.entries())) {
      if (now > v.resetAt) memoryStore.delete(k);
    }
  }

  if (requestCount > maxRequests) {
    return { allowed: false, remaining: 0, resetAt, limit: maxRequests };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - requestCount),
    resetAt,
    limit: maxRequests,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check rate limit for a team request.
 *
 * @returns RateLimitResult with `allowed`, `remaining`, `resetAt`, `limit`
 *
 * Usage in route handlers:
 *   const result = await checkTeamRateLimit({ teamId: ctx.teamId, plan: 'pro' });
 *   if (!result.allowed) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded' },
 *       {
 *         status: 429,
 *         headers: {
 *           'X-RateLimit-Limit': String(result.limit),
 *           'X-RateLimit-Remaining': '0',
 *           'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
 *           'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
 *         },
 *       }
 *     );
 *   }
 */
export async function checkTeamRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { teamId, plan = 'free', windowMs = DEFAULT_WINDOW_MS } = config;
  const maxRequests = config.maxRequests || PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const key = `ratelimit:team:${teamId}:${Math.floor(Date.now() / windowMs)}`;

  try {
    return await redisRateLimit(key, maxRequests, windowMs);
  } catch (err) {
    logger.warn('rateLimit', 'Redis rate limit failed, falling back to memory', { teamId, err });
    return memoryRateLimit(key, maxRequests, windowMs);
  }
}

/**
 * Apply rate limit headers to a NextResponse.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Helper: create a 429 response with standard rate limit headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders(result),
        'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    }
  );
}
