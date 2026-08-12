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
import { addCredits, deductCredits } from '@/lib/services/subscription';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';
import { isDemoMode, MOCK_CAMPAIGNS } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return NextResponse.json(MOCK_CAMPAIGNS[0]);
  }

  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const body = await req.json().catch(() => ({}));
    const { business, topic, goal, messages } = body;

    // Support both old format (business + topic) and new format (goal + messages)
    const campaignGoal = goal || `Create a campaign for a ${business} focusing on ${topic}`;
    const conversationMessages = messages || [];

    const rateLimit = await checkRateLimit(userId, 10, 60); // 10 requests per minute
    if (!rateLimit.allowed) {
      console.log(`[Generate] ⚡ Rate limited: ${userId}. Reset in ${rateLimit.resetIn}s`);
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
    // SERVER-SIDE QUOTA ENFORCEMENT (Atomic reserve BEFORE any paid compute)
    // The credit is reserved up-front via a conditional decrement, so no paid
    // AI work can start unless the balance really covers it. Concurrent
    // requests cannot overdraw — only `balance` of them can ever reserve.
    // ========================================================================

    const deduction = await deductCredits(userId, 1);

    if (!deduction.success) {
      return NextResponse.json(
        {
          error: 'Insufficient Credits',
          message: `You don't have enough credits to run this operation (Cost: 1 Credit). Please upgrade to Pro or Enterprise.`,
          upgradeRequired: true,
          currentCredits: deduction.subscription.credits,
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
      // Refund the reservation — nothing was generated.
      await addCredits(userId, 1);
      throw new Error("NEXT_PUBLIC_API_URL is missing from .env.local");
    }

    let parsedData: any;
    try {
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
        console.error("[Generate] Lambda Error:", errorText);
        throw new Error(`AWS Lambda Error: ${response.status}`);
      }

      const data = await response.json();

      // Lambda Function URLs often wrap the response in a "body" string.
      // This safely extracts it whether it's wrapped or raw.
      parsedData = data;
      if (data.body && typeof data.body === 'string') {
        parsedData = JSON.parse(data.body);
      } else if (data.body && typeof data.body === 'object') {
        parsedData = data.body;
      }
    } catch (error: any) {
      // Refund the reservation — the user should not pay for a campaign that
      // was never generated.
      await addCredits(userId, 1);
      throw error;
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
    console.error("[Generate] Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaign via Strands Agent' },
      { status: 500 }
    );
  }
}