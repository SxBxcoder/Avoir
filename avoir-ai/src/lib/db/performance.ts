/**
 * Avoir — Performance Intelligence Repository
 * 
 * DynamoDB-backed campaign performance tracking with pattern analysis.
 * This is the core data flywheel — every metric reported makes the AI smarter.
 * 
 * Table: avoir-performance
 *   PK: userId (string)
 *   SK: campaignId (string)
 */

import { PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';

// ============================================================================
// TYPES
// ============================================================================

export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'google_ads' | 'email';

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  engagementRate: number;
  conversions: number;
  costPerClick: number;
  roas: number;
}

export interface CampaignSnapshot {
  hook: string;
  offer: string;
  cta: string;
  genome_type?: string;
}

export interface PerformanceRecord {
  userId: string;
  campaignId: string;
  platform: Platform;
  metrics: PerformanceMetrics;
  campaignSnapshot: CampaignSnapshot;
  reportedAt: string;
  tags: string[];
}

export interface PerformanceInsights {
  totalCampaignsAnalyzed: number;
  avgCTR: number;
  avgEngagementRate: number;
  bestPerformingPlatform: Platform | null;
  hookPatterns: { type: string; avgCTR: number }[];
  topInsight: string;
}

// ============================================================================
// WRITE — Report Campaign Performance
// ============================================================================

export async function reportPerformance(
  userId: string,
  campaignId: string,
  platform: Platform,
  metrics: PerformanceMetrics,
  snapshot: CampaignSnapshot,
  tags: string[] = []
): Promise<PerformanceRecord> {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  // Auto-calculate CTR if not provided
  if (!metrics.ctr && metrics.impressions > 0) {
    metrics.ctr = parseFloat(((metrics.clicks / metrics.impressions) * 100).toFixed(2));
  }

  // Auto-calculate engagement rate
  if (!metrics.engagementRate && metrics.impressions > 0) {
    metrics.engagementRate = parseFloat(((metrics.clicks / metrics.impressions) * 100).toFixed(2));
  }

  const record: PerformanceRecord = {
    userId,
    campaignId,
    platform,
    metrics,
    campaignSnapshot: snapshot,
    reportedAt: now,
    tags,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.PERFORMANCE,
        Item: record,
      })
    );
  } catch (err: any) {
    console.error(`[DB] Performance report failed: ${err.message}`);
  }

  return record;
}

// ============================================================================
// READ — Performance History
// ============================================================================

export async function getPerformanceHistory(
  userId: string,
  limit: number = 50
): Promise<PerformanceRecord[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.PERFORMANCE,
        KeyConditionExpression: '#uid = :uid',
        ExpressionAttributeNames: { '#uid': 'userId' },
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    return (result.Items as PerformanceRecord[]) || [];
  } catch (err: any) {
    console.error(`[DB] Performance history fetch failed: ${err.message}`);
    return [];
  }
}

// ============================================================================
// ANALYZE — Performance Insights (The Intelligence Engine)
// ============================================================================

export async function getPerformanceInsights(userId: string): Promise<PerformanceInsights | null> {
  const history = await getPerformanceHistory(userId, 100);

  if (history.length < 3) {
    return null; // Need at least 3 campaigns to generate meaningful insights
  }

  // Aggregate metrics
  const totalCampaigns = history.length;
  const avgCTR = parseFloat((history.reduce((sum, r) => sum + (r.metrics.ctr || 0), 0) / totalCampaigns).toFixed(2));
  const avgEngagement = parseFloat((history.reduce((sum, r) => sum + (r.metrics.engagementRate || 0), 0) / totalCampaigns).toFixed(2));

  // Find best platform
  const platformMap = new Map<Platform, { totalCTR: number; count: number }>();
  history.forEach(r => {
    const existing = platformMap.get(r.platform) || { totalCTR: 0, count: 0 };
    existing.totalCTR += r.metrics.ctr || 0;
    existing.count += 1;
    platformMap.set(r.platform, existing);
  });

  let bestPlatform: Platform | null = null;
  let bestPlatformAvgCTR = 0;
  platformMap.forEach((data, platform) => {
    const avg = data.totalCTR / data.count;
    if (avg > bestPlatformAvgCTR) {
      bestPlatformAvgCTR = avg;
      bestPlatform = platform;
    }
  });

  // Analyze hook patterns (classify by common patterns)
  const hookPatternMap = new Map<string, { totalCTR: number; count: number }>();
  history.forEach(r => {
    const hook = r.campaignSnapshot.hook.toLowerCase();
    let pattern = 'general';
    if (hook.includes('?') || hook.includes('what if') || hook.includes('did you know')) pattern = 'curiosity';
    else if (hook.includes('stop') || hook.includes('wait') || hook.includes('don\'t')) pattern = 'pattern_interrupt';
    else if (hook.includes('limited') || hook.includes('last') || hook.includes('hurry') || hook.includes('only')) pattern = 'urgency';
    else if (hook.includes('proven') || hook.includes('trusted') || hook.includes('expert') || hook.includes('#1')) pattern = 'authority';
    else if (hook.includes('free') || hook.includes('save') || hook.includes('%') || hook.includes('off')) pattern = 'value';
    else if (hook.includes('imagine') || hook.includes('transform') || hook.includes('dream') || hook.includes('future')) pattern = 'aspirational';

    const existing = hookPatternMap.get(pattern) || { totalCTR: 0, count: 0 };
    existing.totalCTR += r.metrics.ctr || 0;
    existing.count += 1;
    hookPatternMap.set(pattern, existing);
  });

  const hookPatterns = Array.from(hookPatternMap.entries())
    .map(([type, data]) => ({
      type,
      avgCTR: parseFloat((data.totalCTR / data.count).toFixed(2)),
    }))
    .sort((a, b) => b.avgCTR - a.avgCTR);

  // Generate top insight
  const bestHookType = hookPatterns[0]?.type || 'general';
  const worstHookType = hookPatterns[hookPatterns.length - 1]?.type || 'general';
  const topInsight = hookPatterns.length >= 2
    ? `${bestHookType.replace('_', ' ')} hooks average ${hookPatterns[0].avgCTR}% CTR — ${((hookPatterns[0].avgCTR / (hookPatterns[hookPatterns.length - 1].avgCTR || 1)) * 100 - 100).toFixed(0)}% better than ${worstHookType.replace('_', ' ')} hooks for your audience.`
    : `Your campaigns average ${avgCTR}% CTR across ${totalCampaigns} campaigns.`;

  return {
    totalCampaignsAnalyzed: totalCampaigns,
    avgCTR,
    avgEngagementRate: avgEngagement,
    bestPerformingPlatform: bestPlatform,
    hookPatterns,
    topInsight,
  };
}

// ============================================================================
// GET TOP PERFORMERS
// ============================================================================

export async function getTopPerformingCampaigns(
  userId: string,
  metric: keyof PerformanceMetrics = 'ctr',
  limit: number = 5
): Promise<PerformanceRecord[]> {
  const history = await getPerformanceHistory(userId, 100);
  return history
    .sort((a, b) => (b.metrics[metric] || 0) - (a.metrics[metric] || 0))
    .slice(0, limit);
}

// ============================================================================
// FORMAT INSIGHTS FOR LLM INJECTION
// ============================================================================

export function formatInsightsForPrompt(insights: PerformanceInsights): string {
  if (!insights || insights.totalCampaignsAnalyzed < 3) return '';

  const lines = [
    `PERFORMANCE INTELLIGENCE (learned from ${insights.totalCampaignsAnalyzed} campaigns):`,
    `- Your audience average CTR: ${insights.avgCTR}%`,
    `- Average engagement rate: ${insights.avgEngagementRate}%`,
  ];

  if (insights.bestPerformingPlatform) {
    lines.push(`- Best performing platform: ${insights.bestPerformingPlatform}`);
  }

  if (insights.hookPatterns.length >= 2) {
    lines.push(`- INSIGHT: ${insights.topInsight}`);
    lines.push(`- Best hook style: "${insights.hookPatterns[0].type}" (${insights.hookPatterns[0].avgCTR}% avg CTR)`);
    lines.push(`- Prioritize ${insights.hookPatterns[0].type} patterns in your hooks.`);
  }

  return lines.join('\n');
}
