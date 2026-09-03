/**
 * Avoir — Alpha Brief Health Check
 *
 * GET /api/alpha-brief/health — Verify Redis cache + Python backend connectivity
 *
 * Returns:
 *   - redis: 'ok' | 'error' | 'disabled'
 *   - backend: 'ok' | 'error' | 'unreachable'
 *   - latestBriefDate: date string of most recent cached brief, or null
 *   - timestamp: current ISO timestamp
 */

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET() {
  const result = {
    redis: 'disabled' as 'ok' | 'error' | 'disabled',
    backend: 'unreachable' as 'ok' | 'error' | 'unreachable',
    latestBriefDate: null as string | null,
    timestamp: new Date().toISOString(),
  };

  // 1. Check Redis connectivity
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const redis = new Redis({ url, token });
      const pong = await redis.ping();
      result.redis = pong === 'PONG' ? 'ok' : 'error';

      if (result.redis === 'ok') {
        // Find the latest cached brief by checking today + yesterday
        const today = new Date().toISOString().slice(0, 10);
        const val = await redis.get(`alpha_brief:daily:${today}`);
        if (val) {
          result.latestBriefDate = today;
        } else {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const prev = await redis.get(`alpha_brief:daily:${yesterday}`);
          if (prev) result.latestBriefDate = yesterday;
        }
      }
    } catch {
      result.redis = 'error';
    }
  }

  // 2. Check backend reachability (lightweight GET with short timeout)
  try {
    const res = await fetch(`${BACKEND_API_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    result.backend = res.ok ? 'ok' : 'error';
  } catch {
    result.backend = 'unreachable';
  }

  const healthy = result.redis !== 'error' && result.backend === 'ok';

  logger.info('alpha-brief-health', 'Health check', {
    redis: result.redis,
    backend: result.backend,
  });

  return NextResponse.json(result, { status: healthy ? 200 : 503 });
}
