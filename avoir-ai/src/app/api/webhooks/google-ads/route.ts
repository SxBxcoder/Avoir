/**
 * Avoir — Google Ads Webhook Handler
 *
 * POST /api/webhooks/google-ads
 *
 * Receives performance callbacks from Google Ads API.
 * Handles:
 *   - CHANGE_STATUS: campaign budget/conversion changes
 *   - CUSTOMER: account-level events
 *   - Campaign metrics: impressions, clicks, cost, conversions
 *
 * Security: Verifies HMAC-SHA256 signature using GOOGLE_ADS_WEBHOOK_SECRET.
 * Always returns 200 to prevent Google retry storms.
 *
 * Setup:
 *   1. Enable the Google Ads API in your Google Cloud project
 *   2. Obtain a developer token from Google Ads API Center
 *   3. Configure webhook callbacks in the Google Ads console
 *   4. Set GOOGLE_ADS_WEBHOOK_SECRET in .env
 */

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { findUserByPlatformAccount } from '@/lib/db/adAccounts';
import { ingestWebhookPerformance, normalizeGoogleMetrics } from '@/lib/services/performanceIngester';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

const webhookSecret = process.env.GOOGLE_ADS_WEBHOOK_SECRET || '';

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

function verifyGoogleSignature(body: string, signature: string | null): boolean {
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('webhook.google-ads', 'GOOGLE_ADS_WEBHOOK_SECRET not configured — skipping verification (dev only)');
      return true;
    }
    logger.error('webhook.google-ads', 'GOOGLE_ADS_WEBHOOK_SECRET not configured — rejecting in production');
    return false;
  }
  if (!signature) return false;

  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex');
  // Google sends hex-encoded HMAC
  return signature === expected;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const body = await req.text();
  const signature = req.headers.get('x-goog-signature');

  if (!verifyGoogleSignature(body, signature)) {
    logger.warn('webhook.google-ads', 'Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    logger.warn('webhook.google-ads', 'Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Google Ads webhook payloads vary by setup method.
  // Common structure: { resource: "campaign", alerts: [...], metrics: {...} }
  // Or from linked app callbacks: { customer_id, campaign_id, metrics: {...} }

  const customerId = payload.customer_id || payload.customerId;
  const campaignId = payload.campaign_id || payload.campaignId;

  if (!campaignId) {
    logger.warn('webhook.google-ads', 'No campaign_id in payload');
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Resolve the Avoir user
  const userId = customerId ? await findUserByPlatformAccount('google', customerId) : null;
  if (!userId) {
    logger.warn('webhook.google-ads', 'No linked user for customer', { customerId });
    return NextResponse.json({ ok: true, unmatched: true });
  }

  // Extract metrics — Google Ads uses different field names depending on the API version
  const metrics = payload.metrics || payload.data?.metrics || {};
  const normalized = normalizeGoogleMetrics({
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    ctr: metrics.ctr,
    cost_micros: metrics.cost_micros || metrics.costMicros,
    conversions: metrics.conversions,
    conversion_value: metrics.conversions_value || metrics.conversionValue,
  });

  // Ingest
  const result = await ingestWebhookPerformance({
    userId,
    platform: 'google',
    platformCampaignId: campaignId,
    adId: payload.ad_id || payload.adId,
    adSetId: payload.ad_group_id || payload.adGroupId,
    metrics: normalized,
    platformAccountId: customerId ? `google:${customerId}` : undefined,
  });

  logger.info('webhook.google-ads', 'Processed callback', {
    userId,
    campaignId: result.campaignId,
    matchType: result.matchType,
    ctr: normalized.ctr,
    roas: normalized.roas,
  });

  return NextResponse.json({ ok: true });
}
