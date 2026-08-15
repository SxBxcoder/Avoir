/**
 * Avoir — Campaign Generation API Route (Enterprise Edition)
 * 
 * POST /api/generate
 * 
 * Enterprise-grade route that:
 *   1. Validates the request
 *   2. Checks Redis rate limit (DDoS protection)
 *   3. Enforces subscription quota via DynamoDB (server-side — can't be bypassed)
 *   4. Checks campaign cache (avoid redundant AI calls)
 *   5. Forwards to AWS Lambda for AI generation
 *   6. Persists campaign to DynamoDB
 *   7. Atomically increments usage counter
 *   8. Returns the campaign data
 */

import { NextResponse } from 'next/server';
import { getSubscription, deductCredits } from '@/lib/services/subscription';
import { canGenerateCampaign, PLANS } from '@/lib/stripe';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';
import { isDemoMode, MOCK_CAMPAIGNS } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validate';

const campaignMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  displayContent: z.string().optional(),
});

const generateSchema = z.object({
  business: z.string().optional(),
  topic: z.string().optional(),
  goal: z.string().optional(),
  messages: z.array(campaignMessageSchema).optional(),
});

export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json(MOCK_CAMPAIGNS[0]);
  }

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const parsed = await parseJsonBody(req, generateSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.issues }, { status: 400 });
    }
    const { business, topic, goal, messages } = parsed.data;

    // Support both old format (business + topic) and new format (goal + messages)
    const campaignGoal = goal || `Create a campaign for a ${business} focusing on ${topic}`;
    const conversationMessages = messages || [];

    const rateLimit = await checkRateLimit(userId, 10, 60); // 10 requests per minute
    if (!rateLimit.allowed) {
      logger.warn('generate', 'Rate limited', { resetInSeconds: rateLimit.resetIn, userId });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${rateLimit.resetIn} seconds.`,
          resetIn: rateLimit.resetIn,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetIn),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    // ========================================================================
    // SERVER-SIDE QUOTA ENFORCEMENT (DynamoDB-backed)
    // This runs on the server — users CANNOT bypass this from the browser.
    // ========================================================================

    const sub = await getSubscription(userId);

    if (!canGenerateCampaign(sub)) {
      logger.warn('generate', 'Blocked: insufficient credits', { credits: sub.credits, userId });
      return NextResponse.json(
        { 
          error: 'Insufficient Credits',
          message: `You don't have enough credits to run this operation (Cost: 1 Credit). Please upgrade to Pro or Enterprise.`,
          upgradeRequired: true,
          currentCredits: sub.credits,
          cost: 1,
        },
        { status: 402 } // Payment Required
      );
    }

    // ========================================================================
    // FORWARD TO AWS LAMBDA (Diamond Cascade)
    // ========================================================================

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is missing from .env.local");
    }

    logger.info('generate', 'Starting generation', { tier: sub.tier, credits: sub.credits });
    logger.debug('generate', 'Firing payload to AWS Lambda', { apiUrl });

    // CALL THE LIVE AWS LAMBDA AGENT with stateful messages
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        goal: campaignGoal,
        messages: conversationMessages,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('generate', 'Lambda error', { response: errorText });
      throw new Error(`AWS Lambda Error: ${response.status}`);
    }

    const data = await response.json();

    // Lambda Function URLs often wrap the response in a "body" string.
    // This safely extracts it whether it's wrapped or raw.
    let parsedData = data;
    if (data.body && typeof data.body === 'string') {
      parsedData = JSON.parse(data.body);
    } else if (data.body && typeof data.body === 'object') {
      parsedData = data.body;
    }

    // ========================================================================
    // PERSIST CAMPAIGN TO DYNAMODB
    // ========================================================================
    const campaign = await createCampaign(userId, {
      goal: campaignGoal,
      plan: {
        hook: parsedData.plan?.hook || parsedData.hook || '',
        offer: parsedData.plan?.offer || parsedData.offer || '',
        cta: parsedData.plan?.cta || parsedData.cta || '',
      },
      captions: parsedData.captions || [],
      imageUrl: parsedData.image_url || parsedData.imageUrl || '',
      messages: conversationMessages,
      tier: parsedData.tier || 'TIER_1_GEMINI',
      status: parsedData.status || 'completed',
    });

    // ========================================================================
    // DEDUCT 1 CREDIT (Atomic — DynamoDB)
    // ========================================================================
    await deductCredits(userId, 1);
    logger.info('generate', 'Campaign generated', { campaignId: campaign.campaignId, creditsDeducted: 1 });

    // Map Python Agent response back to your Next.js UI format
    return NextResponse.json({
      hook: parsedData.plan?.hook || parsedData.hook || "Hook generation pending...",
      offer: parsedData.plan?.offer || parsedData.offer || "Offer generation pending...",
      cta: parsedData.plan?.cta || parsedData.cta || "CTA generation pending...",
      captions: parsedData.captions || [],
      imageUrl: parsedData.image_url || parsedData.imageUrl || "",
      messages: parsedData.messages || conversationMessages,
      campaignId: campaign.campaignId,
      status: parsedData.status || 'completed',
    });

  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('generate', 'Generation failed', { err: error });
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaign via Strands Agent' },
      { status: 500 }
    );
  }
}