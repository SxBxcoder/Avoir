/**
 * Prachar.ai — Streaming Campaign Generation API (SSE)
 * 
 * POST /api/generate/stream
 * 
 * Enterprise-grade streaming endpoint using Server-Sent Events (SSE):
 *   1. Rate limiting (Redis)
 *   2. Quota enforcement (DynamoDB)
 *   3. Streams progress events to the client in real-time
 *   4. Persists campaign on completion
 *   5. Increments usage counter
 * 
 * Event types:
 *   - status     → "Activating Diamond Cascade...", "Tier 1: Gemini firing..."
 *   - chunk      → Partial campaign data as it generates
 *   - campaign   → Final complete campaign object
 *   - error      → Error message
 *   - done       → Stream complete
 */

import { deductCredits } from '@/lib/db/users';
import { canGenerateCampaign, PLANS } from '@/lib/stripe';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';

// Status messages that stream to the UI for the "AI is Cooking" experience
const COOKING_MESSAGES = [
  { delay: 0, text: '🔥 Initializing Diamond Cascade Engine...' },
  { delay: 800, text: '⚡ Scanning global Gen-Z trend database...' },
  { delay: 1600, text: '🎯 Calibrating Authority Engine for maximum impact...' },
  { delay: 2400, text: '🧠 Tier 1: Gemini Flash — Generating raw strategy...' },
  { delay: 3200, text: '✍️ Crafting high-converting viral hooks...' },
  { delay: 4000, text: '🎨 Composing visual assets with AI Director...' },
  { delay: 5000, text: '⚔️ Running final quality cascade checks...' },
];

function createSSEStream(
  statusMessages: typeof COOKING_MESSAGES,
  campaignPromise: Promise<any>,
  userId: string,
  campaignGoal: string
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const send = (event: string, data: any) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // Stream cooking status messages
        for (const msg of statusMessages) {
          await new Promise((resolve) => setTimeout(resolve, msg.delay > 0 ? 600 : 0));
          send('status', { message: msg.text, timestamp: Date.now() });
        }

        // Wait for the actual AI response
        const data = await campaignPromise;

        // Parse Lambda response
        let parsedData = data;
        if (data.body && typeof data.body === 'string') {
          parsedData = JSON.parse(data.body);
        } else if (data.body && typeof data.body === 'object') {
          parsedData = data.body;
        }

        // Persist campaign to DynamoDB
        const campaign = await createCampaign(userId, {
          goal: campaignGoal,
          plan: {
            hook: parsedData.plan?.hook || parsedData.hook || '',
            offer: parsedData.plan?.offer || parsedData.offer || '',
            cta: parsedData.plan?.cta || parsedData.cta || '',
          },
          captions: parsedData.captions || [],
          imageUrl: parsedData.image_url || parsedData.imageUrl || '',
          messages: [],
          tier: parsedData.tier || 'TIER_1_GEMINI',
          status: 'completed',
        });

        // Deduct 1 credit for standard stream generation
        const deductionSuccess = await deductCredits(userId, 1);
        if (!deductionSuccess) {
            console.error(`[STREAM API] Failed to deduct credits for user ${userId}`);
            // Non-fatal, but we log it
        }

        send('status', { message: '✅ Campaign compiled. Deploying assets...', timestamp: Date.now() });

        // Send the final campaign
        send('campaign', {
          hook: parsedData.plan?.hook || parsedData.hook || '',
          offer: parsedData.plan?.offer || parsedData.offer || '',
          cta: parsedData.plan?.cta || parsedData.cta || '',
          captions: parsedData.captions || [],
          imageUrl: parsedData.image_url || parsedData.imageUrl || '',
          campaignId: campaign.campaignId,
          status: 'completed',
        });

        send('done', { success: true });
      } catch (error: any) {
        send('error', { message: error.message || 'Generation failed' });
        send('done', { success: false });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { business, topic, goal, messages } = body;
    const campaignGoal = goal || `Create a campaign for a ${business} focusing on ${topic}`;
    const conversationMessages = messages || [];
    const authHeader = req.headers.get('Authorization');
    const userId = body.userId || body.user_id || 'anonymous';

    // Rate limiting
    const rateLimit = await checkRateLimit(userId, 10, 60);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.resetIn) } }
      );
    }

    // Quota enforcement
    const sub = await getSubscription(userId);
    if (!canGenerateCampaign(sub)) {
      const plan = PLANS[sub.tier];
      return new Response(
        JSON.stringify({
          error: 'Campaign limit reached',
          message: `You've used all ${plan.campaignsPerMonth} campaigns. Upgrade to Pro for unlimited.`,
          upgradeRequired: true,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fire the Lambda call (don't await yet — we'll stream status while it runs)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is missing');

    const lambdaPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify({
        goal: campaignGoal,
        messages: conversationMessages,
        user_id: userId,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Lambda Error: ${res.status}`);
      return res.json();
    });

    console.log(`[Stream] 🚀 SSE stream started for ${userId} (${sub.tier})`);

    // Create the SSE stream
    const stream = createSSEStream(COOKING_MESSAGES, lambdaPromise, userId, campaignGoal);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error('[Stream] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
