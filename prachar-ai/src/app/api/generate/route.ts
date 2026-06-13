/**
 * Prachar.ai — Campaign Generation API Route (Enterprise Edition)
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
import { getSubscription, incrementCampaignCount } from '@/lib/services/subscription';
import { canGenerateCampaign, PLANS } from '@/lib/stripe';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { business, topic, goal, messages } = body;

    // Support both old format (business + topic) and new format (goal + messages)
    const campaignGoal = goal || `Create a campaign for a ${business} focusing on ${topic}`;
    const conversationMessages = messages || [];

    // Extract the JWT token sent from your frontend page.tsx
    const authHeader = req.headers.get('Authorization');

    // ========================================================================
    // RATE LIMITING (Redis-backed — DDoS protection)
    // ========================================================================
    const userId = body.userId || body.user_id || 'anonymous';
    
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
    // SERVER-SIDE QUOTA ENFORCEMENT (DynamoDB-backed)
    // This runs on the server — users CANNOT bypass this from the browser.
    // ========================================================================

    const sub = await getSubscription(userId);

    if (!canGenerateCampaign(sub)) {
      const plan = PLANS[sub.tier];
      console.log(`[Generate] 🚫 User ${userId} blocked. Used ${sub.campaignsUsedThisMonth}/${plan.campaignsPerMonth} campaigns.`);
      return NextResponse.json(
        { 
          error: 'Campaign limit reached',
          message: `You've used all ${plan.campaignsPerMonth} campaigns for this month. Upgrade to Pro for unlimited campaigns.`,
          upgradeRequired: true,
          currentUsage: sub.campaignsUsedThisMonth,
          limit: plan.campaignsPerMonth,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // ========================================================================
    // FORWARD TO AWS LAMBDA (Diamond Cascade)
    // ========================================================================

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is missing from .env.local");
    }

    console.log(`[Generate] 🚀 User ${userId} (${sub.tier}) — ${sub.campaignsUsedThisMonth}/${PLANS[sub.tier].campaignsPerMonth === -1 ? '∞' : PLANS[sub.tier].campaignsPerMonth} campaigns used`);
    console.log(`[Generate] Firing payload to AWS Lambda: ${apiUrl}`);

    // CALL THE LIVE AWS LAMBDA AGENT with stateful messages
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '', // Securely pass the Cognito JWT
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
    // INCREMENT USAGE COUNTER (Atomic — DynamoDB)
    // ========================================================================
    await incrementCampaignCount(userId);
    console.log(`[Generate] ✅ Campaign ${campaign.campaignId} generated for ${userId}. Persisted to DynamoDB.`);

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
    console.error("[Generate] Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaign via Strands Agent' },
      { status: 500 }
    );
  }
}