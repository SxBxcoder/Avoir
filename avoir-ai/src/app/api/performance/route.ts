/**
 * Avoir — Performance Intelligence API
 * 
 * POST /api/performance — Submit campaign performance metrics
 * GET  /api/performance — Retrieve performance history and insights
 */

import { NextResponse } from 'next/server';
import {
  reportPerformance,
  getPerformanceHistory,
  getPerformanceInsights,
  getTopPerformingCampaigns,
  type PerformanceMetrics,
} from '@/lib/db/performance';
import { isDemoMode, MOCK_PERFORMANCE_HISTORY, MOCK_PERFORMANCE_INSIGHTS } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

const performanceSchema = z.object({
  campaignId: z.string().min(1),
  platform: z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'google_ads', 'email']),
  metrics: z.object({
    impressions: z.number().min(0),
    clicks: z.number().min(0),
    ctr: z.number(),
    engagementRate: z.number(),
    conversions: z.number().min(0),
    costPerClick: z.number(),
    roas: z.number(),
  }),
  campaignSnapshot: z.object({
    hook: z.string(),
    offer: z.string(),
    cta: z.string(),
    genome_type: z.string().optional(),
  }),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      status: 'success',
      record: MOCK_PERFORMANCE_HISTORY[0],
      message: 'Performance data recorded. Your AI is now smarter.',
    });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const parsed = await parseJsonBody(req, performanceSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const { campaignId, platform, metrics, campaignSnapshot, tags } = parsed.data;

    const record = await reportPerformance(
      userId,
      campaignId,
      platform,
      metrics,
      campaignSnapshot,
      tags || []
    );

    return NextResponse.json({
      status: 'success',
      record,
      message: 'Performance data recorded. Your AI is now smarter.',
    });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('performance', 'POST failed', { err: error });
    return NextResponse.json(
      { error: error.message || 'Failed to record performance' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
      history: MOCK_PERFORMANCE_HISTORY,
      insights: MOCK_PERFORMANCE_INSIGHTS,
      totalReported: MOCK_PERFORMANCE_HISTORY.length,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'history';

    // Identity comes from the verified Cognito JWT, not the query string.
    const { userId } = await requireUser(req);

    if (action === 'insights') {
      const insights = await getPerformanceInsights(userId);
      return NextResponse.json({ insights });
    }

    if (action === 'top') {
      const metric = (searchParams.get('metric') || 'ctr') as keyof PerformanceMetrics;
      const limit = parseInt(searchParams.get('limit') || '5');
      const top = await getTopPerformingCampaigns(userId, metric, limit);
      return NextResponse.json({ top });
    }

    // Default: history
    const limit = parseInt(searchParams.get('limit') || '20');
    const history = await getPerformanceHistory(userId, limit);
    const insights = await getPerformanceInsights(userId);

    return NextResponse.json({
      history,
      insights,
      totalReported: history.length,
    });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('performance', 'GET failed', { err: error });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
