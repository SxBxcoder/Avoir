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
  type Platform,
  type PerformanceMetrics,
  type CampaignSnapshot,
} from '@/lib/db/performance';
import { isDemoMode, MOCK_PERFORMANCE_HISTORY, MOCK_PERFORMANCE_INSIGHTS } from '@/lib/mockShield';

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
    const body = await req.json();
    const {
      userId,
      campaignId,
      platform,
      metrics,
      campaignSnapshot,
      tags,
    } = body;

    if (!userId || !campaignId || !platform || !metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, campaignId, platform, metrics' },
        { status: 400 }
      );
    }

    const record = await reportPerformance(
      userId,
      campaignId,
      platform as Platform,
      metrics as PerformanceMetrics,
      campaignSnapshot as CampaignSnapshot,
      tags || []
    );

    return NextResponse.json({
      status: 'success',
      record,
      message: 'Performance data recorded. Your AI is now smarter.',
    });
  } catch (error: any) {
    console.error('[Performance API] POST error:', error);
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
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') || 'history';

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

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
    console.error('[Performance API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
