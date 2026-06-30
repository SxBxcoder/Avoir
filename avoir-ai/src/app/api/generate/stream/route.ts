/**
 * Avoir — Streaming Campaign Generation API (SSE)
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

import { getSubscription, deductCredits } from '@/lib/services/subscription';
import { canGenerateCampaign, PLANS } from '@/lib/stripe';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';
import { generateGenomeVariants } from '@/lib/bedrock';
import { getBrandDNA } from '@/lib/db/brandDna';
import { getPerformanceInsights, formatInsightsForPrompt } from '@/lib/db/performance';
import { getIntelligenceBrief, updateIntelligenceBrief, formatIntelligenceForPrompt } from '@/lib/db/intelligence';
import { fetchCompetitorIntel, formatCompetitorContext } from '@/lib/db/competitors';
import { fetchIndustryTrends, synthesizeTrendContext } from '@/lib/trends';

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
  runner: (send: (event: string, data: any) => void) => Promise<any>,
  userId: string,
  campaignGoal: string,
  genomeMode: boolean = false
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
        let messageIdx = 0;
        const msgInterval = setInterval(() => {
          if (messageIdx < statusMessages.length) {
            send('status', { message: statusMessages[messageIdx].text, timestamp: Date.now() });
            messageIdx++;
          } else {
            clearInterval(msgInterval);
          }
        }, 800);

        // Run the dynamic generation workflow
        const data = await runner(send);
        clearInterval(msgInterval);

        // Parse Lambda response
        let parsedData = data;
        if (data.body && typeof data.body === 'string') {
          parsedData = JSON.parse(data.body);
        } else if (data.body && typeof data.body === 'object') {
          parsedData = data.body;
        }

        // Persist campaign to DynamoDB (if not genome)
        let campaignId = 'genome_session';
        if (!genomeMode) {
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
          campaignId = campaign.campaignId;
        }

        // Deduct credits and update intelligence brief
        const cost = genomeMode ? 2 : 1;
        const deductionSuccess = await deductCredits(userId, cost);
        if (!deductionSuccess) {
            console.error(`[STREAM API] Failed to deduct ${cost} credits for user ${userId}`);
        }
        await updateIntelligenceBrief(userId, { totalCampaignsGenerated: genomeMode ? 3 : 1 });

        send('status', { message: '✅ Campaign compiled. Deploying assets...', timestamp: Date.now() });

        if (genomeMode) {
          const normalizedVariants = (parsedData.variants || []).map((v: any) => {
            if (!v.plan) {
              return {
                ...v,
                plan: {
                  hook: v.hook || '',
                  offer: v.offer || '',
                  cta: v.cta || '',
                  reasoning: v.reasoning || null
                }
              };
            }
            return v;
          });

          send('genome', {
            variants: normalizedVariants,
            status: 'completed',
          });
        } else {
          // Send the final campaign
          send('campaign', {
            hook: parsedData.plan?.hook || parsedData.hook || '',
            offer: parsedData.plan?.offer || parsedData.offer || '',
            cta: parsedData.plan?.cta || parsedData.cta || '',
            reasoning: parsedData.plan?.reasoning || parsedData.reasoning || null,
            captions: parsedData.captions || [],
            imageUrl: parsedData.image_url || parsedData.imageUrl || '',
            campaignId: campaignId,
            status: 'completed',
          });
        }

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

import { isDemoMode, createMockSSEStream } from '@/lib/mockShield';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Demo Mock Shield
    if (isDemoMode()) {
      const isGenomeMode = body.genome_mode === true;
      console.log(`[Stream] 🛡️ DEMO SHIELD ACTIVE. Returning curated SSE mock stream. GenomeMode: ${isGenomeMode}`);
      const stream = createMockSSEStream(isGenomeMode);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const { business, topic, goal, messages, genome_mode, pastWinningContext } = body;
    const campaignGoal = goal || `Create a campaign for a ${business} focusing on ${topic}`;
    const conversationMessages = messages || [];
    const authHeader = req.headers.get('Authorization');
    const userId = body.userId || body.user_id || 'anonymous';
    const isGenomeMode = genome_mode === true;

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
    const requiredCredits = isGenomeMode ? 2 : 1;
    
    if (sub.tier === 'free' && sub.credits < requiredCredits) {
      const plan = PLANS[sub.tier];
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          message: isGenomeMode 
            ? `Genome mode requires 2 credits. You have ${sub.credits}. Upgrade to Pro.`
            : `You've used all your free campaigns. Upgrade to Pro.`,
          upgradeRequired: true,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Brand DNA
    const dna = await getBrandDNA(userId);
    let brandContext = undefined;
    if (dna) {
      brandContext = `Brand: ${dna.brandName}\nIndustry: ${dna.industry}\nAudience: ${dna.targetAudience}\nTone: ${dna.toneOfVoice}\nValues: ${dna.coreValues}\nUSP: ${dna.uniqueSellingProposition}`;
    }

    // Fetch Performance Intelligence (the moat)
    const perfInsights = await getPerformanceInsights(userId);
    let performanceContext: string | undefined = perfInsights ? formatInsightsForPrompt(perfInsights) : '';

    // Fetch Intelligence Brief (the memory flywheel)
    const intelBrief = await getIntelligenceBrief(userId);
    if (intelBrief) {
      performanceContext += '\n\n' + formatIntelligenceForPrompt(intelBrief);
    }
    // Fetch Cultural Trends & Competitor Intel
    const industry = business || dna?.industry || 'general';
    const [trends, compIntel] = await Promise.all([
      fetchIndustryTrends(industry),
      fetchCompetitorIntel(industry)
    ]);
    
    if (compIntel) {
      performanceContext += '\n\n' + formatCompetitorContext(compIntel);
    }
    
    if (pastWinningContext) {
      performanceContext += `\n\n[CRITICAL DIRECTIVE - CAMPAIGN MEMORY FLYWHEEL]: The user has previously marked the following strategies as highly successful ("Winners") for their brand. You MUST analyze the psychological triggers, tone, and framing of these winners, and construct your new Hook and Offer using similar winning principles:\n${pastWinningContext}\n`;
    }
    
    performanceContext = performanceContext.trim() || undefined;

    const trendContext = trends ? synthesizeTrendContext(trends) : undefined;

    // Create the SSE stream runner
    const runner = async (send: (event: string, data: any) => void) => {
      if (isGenomeMode) {
        return generateGenomeVariants(campaignGoal, industry, brandContext, performanceContext, trendContext);
      }

      // Step 1: Initial Draft
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is missing');
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
        },
        body: JSON.stringify({
          goal: campaignGoal,
          messages: conversationMessages,
          user_id: userId,
          brand_context: brandContext,
        }),
      });
      if (!res.ok) throw new Error(`Lambda Error: ${res.status}`);
      let draft = await res.json();
      if (draft.body) draft = typeof draft.body === 'string' ? JSON.parse(draft.body) : draft.body;

      // Step 2: Synthetic Focus Group Backtesting (The Hedge Fund for Attention)
      send('status', { message: '🌌 Spawning Synthetic Focus Group...', timestamp: Date.now() });
      send('simulation_start', { timestamp: Date.now() });

      // Import dynamically to avoid circular dependencies if any
      const { runSyntheticFocusGroup } = await import('@/lib/bedrock');
      
      const simulationData = await runSyntheticFocusGroup(draft);
      
      // Step 3: Broadcast Simulation Results
      send('simulation_result', {
        simulation: simulationData.simulation,
        predicted_score: simulationData.predicted_score
      });
      
      send('status', { message: '🎯 Backtesting complete. Compiling final validated assets...', timestamp: Date.now() });

      // Replace draft with the validated campaign from the focus group
      draft.plan = {
        hook: simulationData.revised_campaign?.hook || draft.plan?.hook,
        offer: simulationData.revised_campaign?.offer || draft.plan?.offer,
        cta: simulationData.revised_campaign?.cta || draft.plan?.cta,
        reasoning: {
            ...(simulationData.revised_campaign?.reasoning || draft.plan?.reasoning),
            confidence_score: simulationData.predicted_score || 95
        }
      };
      
      return draft;
    };

    console.log(`[Stream] 🚀 SSE stream started for ${userId} (${sub.tier}), GenomeMode: ${isGenomeMode}`);

    // Create the SSE stream
    const stream = createSSEStream(COOKING_MESSAGES, runner, userId, campaignGoal, isGenomeMode);

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
