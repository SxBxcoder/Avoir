/**
 * Avoir — Daily Alpha Brief API
 *
 * GET /api/alpha-brief
 *
 * Read path (stale-while-revalidate):
 *   1. Redis cache (pre-warmed daily by the Python cron Lambda, or by the
 *      first backend call of the day) — zero LLM latency.
 *   2. If cached data is stale (>20h old), serve it immediately but trigger
 *      a background revalidation so the next request gets fresh data.
 *   3. Fallback: Python backend GET /api/alpha-brief, then best-effort
 *      re-cache into Redis.
 *
 * Demo Mode: returns MOCK_ALPHA_BRIEF so demos need no external services.
 */

import { NextResponse } from 'next/server';
import {
  getCachedAlphaBrief,
  setCachedAlphaBrief,
  getAlphaBriefCachedAt,
} from '@/lib/db/cache';
import { isDemoMode, MOCK_ALPHA_BRIEF } from '@/lib/mockShield';
import { isAlphaBrief, type AlphaBrief } from '@/lib/alphaBrief';
import { logger } from '@/lib/logger';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

// Serve stale data after this many ms (20 hours — cache expires at UTC midnight)
const SWR_THRESHOLD_MS = 20 * 60 * 60 * 1000;

async function fetchAndCache(): Promise<AlphaBrief | null> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/alpha-brief`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Backend alpha brief responded with ${res.status}`);
    }

    const data: AlphaBrief = await res.json();
    if (!isAlphaBrief(data)) {
      throw new Error('Backend returned an invalid alpha brief shape');
    }

    await setCachedAlphaBrief(data);
    return data;
  } catch (error: unknown) {
    logger.error('alpha-brief', 'background revalidation failed', { err: error });
    return null;
  }
}

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json(MOCK_ALPHA_BRIEF);
  }

  try {
    // 1. Redis cache (fast path)
    const cached = await getCachedAlphaBrief();
    if (cached) {
      // 2. Stale-while-revalidate: if data is old, refresh in background
      const cachedAt = await getAlphaBriefCachedAt();
      if (!cachedAt || Date.now() - cachedAt > SWR_THRESHOLD_MS) {
        // Fire-and-forget — don't await, just trigger the refresh
        fetchAndCache();
      }
      return NextResponse.json(cached);
    }

    // 3. Cold miss — block on backend fetch
    const fresh = await fetchAndCache();
    if (fresh) {
      return NextResponse.json(fresh);
    }

    return NextResponse.json(
      { error: 'Failed to fetch alpha brief' },
      { status: 500 }
    );
  } catch (error: unknown) {
    logger.error('alpha-brief', 'GET failed', { err: error });
    return NextResponse.json(
      { error: 'Failed to fetch alpha brief' },
      { status: 500 }
    );
  }
}
