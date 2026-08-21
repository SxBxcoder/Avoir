import { NextResponse } from 'next/server';
import { addCredits, deductCredits } from '@/lib/db/users';
import { getCampaign } from '@/lib/db/campaigns';
import { isDemoMode } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

const PUBLISH_COST = 5;
const WEBHOOK_TIMEOUT_MS = 10_000;

const publishSchema = z.object({
  campaign_id: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json({
        status: 'success',
        message: 'Successfully published! (Demo Mode)',
        cost: 0
    });
  }

  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(request);

    const parsed = await parseJsonBody(request, publishSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const { campaign_id, platforms: platformList } = parsed.data;

    logger.info('publish', 'Attempting to publish campaign', { campaignId: campaign_id, platforms: platformList });

    // Configuration gate BEFORE any charge: without a webhook target there is
    // nothing to publish to, so the request must fail cheaply.
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.error('publish', 'ZAPIER_WEBHOOK_URL is not configured');
      return NextResponse.json({
        error: 'Publishing is not configured',
        details: 'ZAPIER_WEBHOOK_URL must be set to a Zapier/Make webhook URL.',
      }, { status: 503 });
    }

    // Ownership + existence check BEFORE any charge: never publish (or bill
    // for) a campaign that does not belong to this user.
    const campaign = await getCampaign(userId, campaign_id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Deduct credits for publishing (atomic + conditional: only succeeds when
    // the balance covers the cost)
    const { success } = await deductCredits(userId, PUBLISH_COST);

    if (!success) {
      return NextResponse.json({
        error: 'Insufficient credits',
        details: `Publishing costs ${PUBLISH_COST} credits.`
      }, { status: 402 });
    }

    // Trigger the Zapier/Make webhook with everything an automation needs to
    // actually distribute the campaign.
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        body: JSON.stringify({
          campaign_id,
          platforms: platformList,
          userId,
          requestedAt: new Date().toISOString(),
          campaign: {
            goal: campaign.goal,
            plan: campaign.plan,
            captions: campaign.captions,
            imageUrl: campaign.imageUrl,
            language: campaign.language ?? null,
          },
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        logger.error('publish', 'Webhook target rejected publish', {
          status: response.status,
          response: responseText.slice(0, 500),
        });
        throw new Error(`Webhook responded ${response.status}`);
      }
    } catch (error) {
      // Refund — the user should not pay for a publish that never happened.
      try {
        await addCredits(userId, PUBLISH_COST);
      } catch (refundErr) {
        // Never mask the original webhook failure with a refund failure.
        logger.error('publish', 'Refund after failed publish also failed', { err: refundErr });
      }
      logger.error('publish', 'Webhook delivery failed, credits refunded', { err: error });
      return NextResponse.json({
        error: 'Publishing failed',
        details: 'The automation webhook could not be reached. Your credits have been refunded.',
      }, { status: 502 });
    }

    logger.info('publish', 'Campaign published', { creditsDeducted: PUBLISH_COST });

    return NextResponse.json({
        status: 'success',
        message: 'Successfully published!',
        cost: PUBLISH_COST
    });

  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('publish', 'Publishing failed', { err: error });
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
