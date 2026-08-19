/**
 * Avoir — Campaign Matcher
 *
 * Resolves external ad platform IDs (from Meta/Google webhook callbacks)
 * to internal Avoir campaign IDs. This is the bridge between the ad platforms
 * and the campaign memory flywheel.
 *
 * Lookup order:
 *   1. Exact match on externalIds.metaCampaignId / googleCampaignId
 *   2. Fallback: match by ad ID (adId) if the campaign was linked at ad level
 *   3. Return null if no match (unmatched webhooks are logged and dropped)
 */

import { findCampaignByExternalId, updateCampaignExternalIds, type Campaign } from '@/lib/db/campaigns';
import { logger } from '@/lib/logger';

export type AdPlatform = 'meta' | 'google';

export interface MatchResult {
  matched: boolean;
  campaign: Campaign | null;
  matchType: 'exact_external_id' | 'ad_id' | 'none';
}

/**
 * Attempts to match an external ad campaign ID to an internal Avoir campaign.
 *
 * @param userId   - The Avoir user who owns the campaign
 * @param platform - Which ad platform (meta | google)
 * @param externalCampaignId - The campaign ID from the webhook payload
 * @param adId     - Optional individual ad ID (more granular than campaign)
 */
export async function matchCampaign(
  userId: string,
  platform: AdPlatform,
  externalCampaignId: string,
  adId?: string
): Promise<MatchResult> {
  // 1. Try exact match on the campaign-level external ID
  const exactMatch = await findCampaignByExternalId(userId, platform, externalCampaignId);
  if (exactMatch) {
    logger.info('services.campaignMatcher', 'Exact match found', {
      userId,
      platform,
      externalCampaignId,
      campaignId: exactMatch.campaignId,
    });
    return { matched: true, campaign: exactMatch, matchType: 'exact_external_id' };
  }

  // 2. Try ad-level match if an adId was provided
  if (adId) {
    const adMatch = await findCampaignByExternalId(userId, platform, adId);
    if (adMatch) {
      logger.info('services.campaignMatcher', 'Ad-level match found', {
        userId,
        platform,
        adId,
        campaignId: adMatch.campaignId,
      });
      return { matched: true, campaign: adMatch, matchType: 'ad_id' };
    }
  }

  // 3. No match
  logger.warn('services.campaignMatcher', 'No match found for external ID', {
    userId,
    platform,
    externalCampaignId,
    adId,
  });
  return { matched: false, campaign: null, matchType: 'none' };
}

/**
 * Links external IDs to a matched campaign (auto-discovered from webhook).
 * Called after a successful match to persist the association for future lookups.
 */
export async function autoLinkExternalIds(
  userId: string,
  campaignId: string,
  platform: AdPlatform,
  externalCampaignId: string,
  adId?: string,
  adSetId?: string
): Promise<void> {
  const externalIds: NonNullable<Campaign['externalIds']> =
    platform === 'meta'
      ? { metaCampaignId: externalCampaignId, adId, adSetId }
      : { googleCampaignId: externalCampaignId, adId, adSetId };

  await updateCampaignExternalIds(userId, campaignId, externalIds);
}
