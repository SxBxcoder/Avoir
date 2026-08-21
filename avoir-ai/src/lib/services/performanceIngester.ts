/**
 * Avoir — Performance Ingester
 *
 * Shared logic called by both Meta Ads and Google Ads webhook handlers.
 * Maps raw platform metrics to the internal PerformanceMetrics type,
 * writes to DynamoDB, and feeds the Campaign Memory Flywheel.
 *
 * Flow:
 *   platform payload → normalize metrics → match campaign → write performance → update intelligence
 */

import { reportPerformance, type Platform, type PerformanceMetrics, type CampaignSnapshot } from '@/lib/db/performance';
import { getCampaign } from '@/lib/db/campaigns';
import { matchCampaign, autoLinkExternalIds, type AdPlatform } from './campaignMatcher';
import { updateIntelligenceBrief } from '@/lib/db/intelligence';
import { touchLastSyncAt } from '@/lib/db/adAccounts';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface IngestResult {
  success: boolean;
  campaignId: string | null;
  matchType: 'exact_external_id' | 'ad_id' | 'fuzzy' | 'none';
  performanceRecordId: string | null;
  intelligenceUpdated: boolean;
}

export interface NormalizedMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerClick: number;
  roas: number;
  /** Platform-specific spend in dollars. */
  spend: number;
}

// ============================================================================
// METRIC NORMALIZATION
// ============================================================================

/** Normalize Meta Ads insights payload to standard metrics. */
export function normalizeMetaMetrics(raw: {
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  spend?: string | number;
  actions?: Array<{ action_type: string; value: string | number }>;
  purchase_roas?: Array<{ action_type: string; value: string | number }>;
}): NormalizedMetrics {
  const impressions = Number(raw.impressions) || 0;
  const clicks = Number(raw.clicks) || 0;
  const spend = Number(raw.spend) || 0;

  // Extract conversions from actions array
  const purchaseAction = raw.actions?.find(
    (a) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase'
  );
  const conversions = Number(purchaseAction?.value) || 0;

  // Extract ROAS from purchase_roas array
  const roasEntry = raw.purchase_roas?.find((r) => r.action_type === 'omni_purchase');
  const roas = Number(roasEntry?.value) || (spend > 0 && conversions > 0 ? conversions / spend : 0);

  const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
  const costPerClick = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;

  return { impressions, clicks, ctr, conversions, costPerClick, roas, spend };
}

/** Normalize Google Ads metrics payload to standard metrics. */
export function normalizeGoogleMetrics(raw: {
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  cost_micros?: string | number;
  conversions?: string | number;
  conversion_value?: string | number;
}): NormalizedMetrics {
  const impressions = Number(raw.impressions) || 0;
  const clicks = Number(raw.clicks) || 0;
  // Google Ads cost is in micros (1/1,000,000 of the currency unit)
  const spend = Number(raw.cost_micros) ? Number(raw.cost_micros) / 1_000_000 : 0;
  const conversions = Number(raw.conversions) || 0;
  const conversionValue = Number(raw.conversion_value) || 0;

  const ctr = Number(raw.ctr) ? Number(raw.ctr) * 100 : (impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0);
  const costPerClick = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;
  const roas = spend > 0 ? parseFloat((conversionValue / spend).toFixed(2)) : 0;

  return { impressions, clicks, ctr, conversions, costPerClick, roas, spend };
}

// ============================================================================
// INGEST — Main entry point
// ============================================================================

export async function ingestWebhookPerformance(params: {
  userId: string;
  platform: AdPlatform;
  platformCampaignId: string;
  adId?: string;
  adSetId?: string;
  metrics: NormalizedMetrics;
  platformAccountId?: string;
}): Promise<IngestResult> {
  const { userId, platform, platformCampaignId, adId, adSetId, metrics, platformAccountId } = params;

  // 1. Match external ad ID to internal campaign
  const match = await matchCampaign(userId, platform, platformCampaignId, adId);

  if (!match.matched || !match.campaign) {
    logger.warn('services.performanceIngester', 'Unmatched webhook — no campaign found', {
      userId,
      platform,
      platformCampaignId,
    });
    return { success: false, campaignId: null, matchType: 'none', performanceRecordId: null, intelligenceUpdated: false };
  }

  const campaign = match.campaign;
  const dbPlatform: Platform = platform === 'meta' ? 'facebook' : 'google_ads';

  // 2. Auto-link external IDs for future lookups
  if (match.matchType !== 'exact_external_id') {
    await autoLinkExternalIds(userId, campaign.campaignId, platform, platformCampaignId, adId, adSetId);
  }

  // 3. Write performance record
  const perfMetrics: PerformanceMetrics = {
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    ctr: metrics.ctr,
    engagementRate: metrics.ctr, // Closest proxy from ad data
    conversions: metrics.conversions,
    costPerClick: metrics.costPerClick,
    roas: metrics.roas,
  };

  const snapshot: CampaignSnapshot = {
    hook: campaign.plan.hook,
    offer: campaign.plan.offer,
    cta: campaign.plan.cta,
  };

  const record = await reportPerformance(
    userId,
    campaign.campaignId,
    dbPlatform,
    perfMetrics,
    snapshot,
    ['webhook'],
    'webhook'
  );

  // 4. Update campaign metadata
  const { updateCampaignExternalIds: updateExt } = await import('@/lib/db/campaigns');
  await updateExt(userId, campaign.campaignId, {
    ...(platform === 'meta' ? { metaCampaignId: platformCampaignId } : { googleCampaignId: platformCampaignId }),
    ...(adId ? { adId } : {}),
    ...(adSetId ? { adSetId } : {}),
  });

  // 5. Feed the intelligence flywheel
  let intelligenceUpdated = false;
  try {
    const isHighPerforming = metrics.roas >= 2.0 || metrics.ctr >= 2.0;
    const isLowPerforming = metrics.roas < 0.5 || metrics.ctr < 0.5;

    const formatTag = `${platform}:${dbPlatform}`;
    const hookTag = `hook:${campaign.plan.hook.slice(0, 50)}`;

    await updateIntelligenceBrief(userId, {
      ...(isHighPerforming ? { successfulFormats: [formatTag, hookTag] } : {}),
      ...(isLowPerforming ? { avoidedFormats: [formatTag, hookTag] } : {}),
      audienceInsights: metrics.roas >= 3.0
        ? [`High ROAS (${metrics.roas}x) on ${dbPlatform} — prioritize this platform`]
        : [],
    });
    intelligenceUpdated = true;
  } catch (err) {
    logger.error('services.performanceIngester', 'Intelligence update failed (non-fatal)', { err });
  }

  // 6. Touch last sync timestamp on the ad account
  if (platformAccountId) {
    await touchLastSyncAt(userId, platformAccountId).catch(() => {});
  }

  logger.info('services.performanceIngester', 'Webhook ingested successfully', {
    userId,
    platform,
    campaignId: campaign.campaignId,
    ctr: metrics.ctr,
    roas: metrics.roas,
  });

  return {
    success: true,
    campaignId: campaign.campaignId,
    matchType: match.matchType,
    performanceRecordId: record.campaignId,
    intelligenceUpdated,
  };
}
