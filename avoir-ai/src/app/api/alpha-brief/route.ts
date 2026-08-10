/**
 * Avoir — Daily Alpha Brief API
 *
 * GET /api/alpha-brief
 *
 * Read path:
 *   1. Redis cache (pre-warmed daily by the Python cron Lambda, or by the
 *      first backend call of the day) — zero LLM latency.
 *   2. Fallback: Python backend GET /api/alpha-brief, then best-effort
 *      re-cache into Redis.
 *
 * Demo Mode: returns MOCK_ALPHA_BRIEF so demos need no external services.
 */

import { NextResponse } from 'next/server';
import { getCachedAlphaBrief, setCachedAlphaBrief } from '@/lib/db/cache';
import { isDemoMode, MOCK_ALPHA_BRIEF } from '@/lib/mockShield';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json(MOCK_ALPHA_BRIEF);
  }

  try {
    // 1. Redis cache first (fast path)
    const cached = await getCachedAlphaBrief();
    if (cached) {
      return NextResponse.json(cached);
    }

    // 2. Backend generator (slow path — only once per day)
    const res = await fetch(`${BACKEND_API_URL}/api/alpha-brief`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Backend alpha brief responded with ${res.status}`);
    }

    const data = await res.json();

    // 3. Best-effort re-cache so subsequent requests skip the backend
    await setCachedAlphaBrief(data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[AlphaBrief API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alpha brief' },
      { status: 500 }
    );
  }
}
