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

import { addCredits, deductCredits, getSubscription } from '@/lib/services/subscription';
import { createCampaign } from '@/lib/db/campaigns';
import { checkRateLimit } from '@/lib/db/cache';
import { generateGenomeVariants } from '@/lib/bedrock';
import { getBrandDNA } from '@/lib/db/brandDna';
import { getPerformanceInsights, formatInsightsForPrompt } from '@/lib/db/performance';
import { getIntelligenceBrief, updateIntelligenceBrief, formatIntelligenceForPrompt } from '@/lib/db/intelligence';
import { fetchCompetitorIntel, formatCompetitorContext } from '@/lib/db/competitors';
import { fetchIndustryTrends, synthesizeTrendContext } from '@/lib/trends';
import { parseCampaignRequest } from '@/lib/generation';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const streamSchema = z.object({
  business: z.string().optional(),
  topic: z.string().optional(),
  goal: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  genome_mode: z.boolean().optional(),
  pastWinningContext: z.string().optional(),
  language: z.string().optional(),
});

// Status messages that stream to the UI for the "AI is Cooking" experience
const COOKING_MESSAGES: Record<string, { delay: number; text: string }[]> = {
  en: [
    { delay: 0, text: '🔥 Initializing Diamond Cascade Engine...' },
    { delay: 800, text: '⚡ Scanning global Gen-Z trend database...' },
    { delay: 1600, text: '🎯 Calibrating Authority Engine for maximum impact...' },
    { delay: 2400, text: '🧠 Tier 1: Gemini Flash — Generating raw strategy...' },
    { delay: 3200, text: '✍️ Crafting high-converting viral hooks...' },
    { delay: 4000, text: '🎨 Composing visual assets with AI Director...' },
    { delay: 5000, text: '⚔️ Running final quality cascade checks...' },
  ],
  hi: [
    { delay: 0, text: '🔥 डायमंड कैस्केड इंजन शुरू हो रहा है...' },
    { delay: 800, text: '⚡ ग्लोबल ट्रेंड डेटाबेस स्कैन हो रहा है...' },
    { delay: 1600, text: '🎯 अधिकतम इम्पैक्ट के लिए कैलिब्रेट हो रहा है...' },
    { delay: 2400, text: '🧠 Tier 1: Gemini Flash — रणनीति बन रही है...' },
    { delay: 3200, text: '✍️ वायरल हुक क्राफ्ट हो रहे हैं...' },
    { delay: 4000, text: '🎨 विज़ुअल एसेट्स बन रहे हैं...' },
    { delay: 5000, text: '⚔️ फाइनल क्वालिटी चेक चल रहा है...' },
  ],
  'hi-en': [
    { delay: 0, text: '🔥 Diamond Cascade Engine start ho raha hai...' },
    { delay: 800, text: '⚡ Global trend database scan ho raha hai...' },
    { delay: 1600, text: '🎯 Maximum impact ke liye calibrate ho raha hai...' },
    { delay: 2400, text: '🧠 Tier 1: Gemini Flash — Strategy ban rahi hai...' },
    { delay: 3200, text: '✍️ Viral hooks craft ho rahe hain...' },
    { delay: 4000, text: '🎨 Visual assets ban rahe hain...' },
    { delay: 5000, text: '⚔️ Final quality check chal raha hai...' },
  ],
  es: [
    { delay: 0, text: '🔥 Inicializando Diamond Cascade Engine...' },
    { delay: 800, text: '⚡ Escaneando base de datos de tendencias...' },
    { delay: 1600, text: '🎯 Calibrando para máximo impacto...' },
    { delay: 2400, text: '🧠 Tier 1: Gemini Flash — Generando estrategia...' },
    { delay: 3200, text: '✍️ Creando hooks virales...' },
    { delay: 4000, text: '🎨 Componiendo assets visuales...' },
    { delay: 5000, text: '⚔️ Verificación final de calidad...' },
  ],
};

function getCookingMessages(language: string) {
  return COOKING_MESSAGES[language] || COOKING_MESSAGES['en'];
}

function createSSEStream(
  statusMessages: { delay: number; text: string }[],
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

      // Cost depends on the generation mode — reserved up-front and refunded
      // if generation fails, so a user only ever pays for a real campaign.
      const cost = genomeMode ? 2 : 1;
      let reserved = false;
      let committed = false;
      let msgInterval: ReturnType<typeof setInterval> | null = null;

      try {
        // Atomic reserve BEFORE any paid AI work. The conditional decrement
        // (users.ts deductCredits) means concurrent streams can never overdraw:
        // once the balance is exhausted, further reservations fail cleanly and
        // generation never starts for them.
        const deduction = await deductCredits(userId, cost);
        if (!deduction.success) {
          send('error', {
            error: 'Insufficient credits',
            message: `This operation costs ${cost} credit${cost > 1 ? 's' : ''}. Your balance is ${deduction.subscription.credits}.`,
            upgradeRequired: true,
            currentCredits: deduction.subscription.credits,
            cost,
          });
          send('done', { success: false });
          return;
        }
        reserved = true;

        // Stream cooking status messages
        let messageIdx = 0;
        msgInterval = setInterval(() => {
          if (messageIdx < statusMessages.length) {
            send('status', { message: statusMessages[messageIdx].text, timestamp: Date.now() });
            messageIdx++;
          } else {
            clearInterval(msgInterval ?? undefined);
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

        // The deliverable now exists (a persisted campaign row, or completed
        // genome variants). Failures from here on must NOT refund — a transport
        // error after commit must not hand the user the campaign AND the credit.
        committed = true;
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
        // Refund only when we actually reserved the credits AND the work was
        // not already committed. A refund after commit (e.g. a client
        // disconnect once the campaign row exists) would hand out free
        // campaigns. Refund is best-effort; addCredits never throws.
        if (reserved && !committed) {
          await addCredits(userId, cost).catch(() => {});
        }
        send('error', { message: error.message || 'Generation failed' });
        send('done', { success: false });
      } finally {
        // The status timer must stop on every path (success, failure, and
        // stream abort) or it leaks and keeps the process alive.
        if (msgInterval) clearInterval(msgInterval);
        controller.close();
      }
    },
  });

  return stream;
}

import { isDemoMode, createMockSSEStream } from '@/lib/mockShield';

export async function POST(req: Request) {
  try {
    // Identity comes from the verified Cognito JWT — never trust client input.
    const { userId } = await requireUser(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Demo Mock Shield
    if (isDemoMode()) {
      const isGenomeMode = (body as Record<string, unknown>).genome_mode === true;
      logger.info('stream', 'Demo shield active, returning mock SSE stream', { genomeMode: isGenomeMode });
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

    const parsed = streamSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', issues: parsed.error.issues.map((issue) => issue.message) }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate BEFORE any paid work: an empty/malformed body must never reach
    // the credit reservation or the generation pipeline.
    const parsedRequest = parseCampaignRequest(parsed.data);
    if (!parsedRequest) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: provide a goal, or both business and topic' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { goal: campaignGoal, messages: conversationMessages } = parsedRequest;
    const { genome_mode, pastWinningContext } = parsed.data;
    const campaignLanguage = (parsed.data as any).language || 'en';
    const authHeader = req.headers.get('Authorization');
    const isGenomeMode = genome_mode === true;

    // Rate limiting
    const rateLimit = await checkRateLimit(userId, 10, 60);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetIn: rateLimit.resetIn }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.resetIn) } }
      );
    }

    // Quota pre-check (fast UX gate for all tiers). This is only an early
    // exit — the authoritative, race-safe reservation happens atomically
    // inside the stream (createSSEStream) before any paid AI work starts, so
    // this read can never be raced into an overdraw.
    const sub = await getSubscription(userId);
    const requiredCredits = isGenomeMode ? 2 : 1;

    if (sub.credits < requiredCredits) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          message: `This operation requires ${requiredCredits} credits. You have ${sub.credits}. Upgrade to Pro or Enterprise for more.`,
          upgradeRequired: true,
          currentCredits: sub.credits,
          cost: requiredCredits,
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
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
    const industryHint = typeof body.business === 'string' ? body.business.trim() : '';
    const industry = industryHint || dna?.industry || 'general';
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
          language: campaignLanguage,
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

    logger.info('stream', 'SSE stream started', { tier: sub.tier, genomeMode: isGenomeMode });
    // Create the SSE stream
    const stream = createSSEStream(getCookingMessages(campaignLanguage), runner, userId, campaignGoal, isGenomeMode);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('stream', 'Stream failed', { err: error });
    return new Response(
      JSON.stringify({ error: error.message || 'Stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
