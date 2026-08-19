/**
 * Avoir — Meta Ads Webhook Handler
 *
 * POST /api/webhooks/meta-ads
 *
 * Receives performance callbacks from Meta (Facebook) Ads API.
 * Handles:
 *   - ads_insights: campaign-level performance data (CTR, ROAS, spend, conversions)
 *   - campaign delivery: status changes
 *
 * Security: Verifies X-Hub-Signature-256 HMAC signature using META_ADS_WEBHOOK_SECRET.
 * Always returns 200 to prevent Meta retry storms.
 *
 * Setup:
 *   1. Create a Meta App at https://developers.facebook.com
 *   2. Subscribe to the Ads Insights API webhook
 *   3. Set callback URL to https://your-domain/api/webhooks/meta-ads
 *   4. Generate a verify token and set META_ADS_WEBHOOK_SECRET in .env
 */

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { findUserByPlatformAccount } from '@/lib/db/adAccounts';
import { ingestWebhookPerformance, normalizeMetaMetrics } from '@/lib/services/performanceIngester';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

const webhookSecret = process.env.META_ADS_WEBHOOK_SECRET || '';

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

function verifyMetaSignature(body: string, signature: string | null): boolean {
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('webhook.meta-ads', 'META_ADS_WEBHOOK_SECRET not configured — skipping verification (dev only)');
      return true;
    }
    logger.error('webhook.meta-ads', 'META_ADS_WEBHOOK_SECRET not configured — rejecting in production');
    return false;
  }
  if (!signature) return false;

  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex');
  // Meta sends "sha256=<hex>" format
  const sent = signature.replace(/^sha256=/, '');
  return sent === expected;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: Request) {
  // Demo mode — accept and discard (no real Meta account to receive data)
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const body = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!verifyMetaSignature(body, signature)) {
    logger.warn('webhook.meta-ads', 'Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    logger.warn('webhook.meta-ads', 'Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Meta sends an array of entries
  const entries: any[] = payload.entry || [];

  for (const entry of entries) {
    const changes: any[] = entry.changes || [];

    for (const change of changes) {
      if (change.field !== 'ads_insights') continue;

      const value = change.value || {};
      const accountId = value.account_id || entry.id;
      const campaignId = value.campaign_id;
      const adsetId = value.adset_id;
      const adId = value.ad_id;

      if (!campaignId) {
        logger.warn('webhook.meta-ads', 'No campaign_id in ads_insights payload');
        continue;
      }

      // Resolve the Avoir user from the linked ad account
      const userId = accountId ? await findUserByPlatformAccount('meta', accountId) : null;
      if (!userId) {
        logger.warn('webhook.meta-ads', 'No linked user for account', { accountId });
        continue;
      }

      // Normalize metrics
      const metrics = normalizeMetaMetrics({
        impressions: value.impressions,
        clicks: value.clicks,
        ctr: value.ctr,
        spend: value.spend,
        actions: value.actions,
        purchase_roas: value.purchase_roas,
      });

      // Ingest
      const result = await ingestWebhookPerformance({
        userId,
        platform: 'meta',
        platformCampaignId: campaignId,
        adId,
        adSetId: adsetId,
        metrics,
        platformAccountId: accountId ? `meta:${accountId}` : undefined,
      });

      logger.info('webhook.meta-ads', 'Processed ads_insights', {
        userId,
        campaignId: result.campaignId,
        matchType: result.matchType,
        ctr: metrics.ctr,
        roas: metrics.roas,
      });
    }
  }

  // Always 200 — prevents Meta from retrying and hammering us
  return NextResponse.json({ ok: true });
}

// Meta also sends a GET for webhook verification (hub.verify_token)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || webhookSecret)) {
    logger.info('webhook.meta-ads', 'Webhook verification succeeded');
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
