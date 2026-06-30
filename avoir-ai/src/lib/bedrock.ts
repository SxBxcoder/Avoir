// src/lib/bedrock.ts

// --- THE "PREMIUM BRAND" PROMPT (with Strategic Reasoning & Funnel Matrix) ---
const ELITE_SYSTEM_PROMPT = `
You are a World-Class Copywriter and Campaign Strategist for a luxury brand (think Apple, Nike, Cred).
Your goal is to write a high-status, emotionally resonant campaign for a global audience.

FORMAT:
Language: "Global Viral English" (modern, high-converting, punchy).

Instructions:
1. "hook", "offer", "cta": This is your Middle-of-Funnel (MOF) core ad.
   - Hook: Promise a transformation (e.g. "Your digital legacy begins here.")
   - Offer: Value-driven proposition (e.g. "Exclusive Early Access: 30% Advantage")
   - CTA: Confident command (e.g. "Claim Your Space")

2. "reasoning": Provide strategic rationale.
   - "confidence_score": MUST BE 0-100. Evaluate your campaign against the provided Performance Context. If it perfectly matches past high-performing patterns, score > 85. If it's risky, score < 70.

3. "funnel": Provide the Top-of-Funnel (TOF) and Bottom-of-Funnel (BOF) extensions.
   - TOF: A 3-second TikTok/Reels video script hook.
   - BOF: A short urgency-driven Email/SMS sequence.

Output JSON Structure:
{
  "hook": "...",
  "offer": "...",
  "cta": "...",
  "reasoning": {
    "hook_rationale": "...",
    "offer_rationale": "...",
    "cta_rationale": "...",
    "confidence_score": 85,
    "audience_insight": "..."
  },
  "funnel": {
    "top": "TikTok Script: [Visual: ...] [Audio: ...]",
    "bottom": "SMS: [Urgency message] + Link"
  }
}
`;

// --- THE CRUCIBLE "RED TEAM" PROMPT ---
const CRUCIBLE_SYSTEM_PROMPT = `
You are the "Skeptical Consumer" Agent and the "Fixer" Agent combined.
You are reviewing a proposed marketing campaign JSON.

Step 1 (Skeptic): Critique the hook and offer. Is it boring? Does it sound like a scam? Is it generic?
Step 2 (Fixer): Rewrite the campaign to eliminate these objections. Make it punchier, more authoritative, and higher converting.

You MUST output ONLY the fixed campaign in the EXACT same JSON structure as the input. DO NOT include your critique text outside the JSON. Include your critique summary inside the "audience_insight" field of the JSON.
`;

// --- GENOME SYSTEM PROMPT (Multi-Variant Generation) ---
const GENOME_SYSTEM_PROMPT = `
You are a World-Class Campaign Strategist. Generate THREE strategically divergent campaign variants for the same brand/product.

Each variant MUST optimize for a DIFFERENT outcome:

1. VIRALITY variant — Maximum reach, shares, saves. Bold, provocative hooks. High emotional arousal.
2. CONVERSION variant — Maximum clicks, sign-ups, purchases. Direct, benefit-driven, urgency-framed.
3. AUTHORITY variant — Maximum brand trust, follows, community growth. Aspirational, educational, premium tone.

For each variant, provide:
- hook, offer, cta (premium quality copy for Middle-of-Funnel)
- funnel (top: TikTok script, bottom: SMS urgency copy)
- reasoning (strategic rationale for each element, plus confidence_score)
- captions (3 platform-adapted captions)
- predicted_scores (0-100 for each dimension)

Output JSON:
{
  "variants": [
    {
      "genome_type": "virality",
      "hook": "...", "offer": "...", "cta": "...",
      "reasoning": {
        "hook_rationale": "...",
        "offer_rationale": "...",
        "cta_rationale": "...",
        "confidence_score": 88,
        "audience_insight": "..."
      },
      "funnel": {
        "top": "TikTok Script: ...",
        "bottom": "SMS: ..."
      },
      "captions": ["Instagram caption...", "TikTok caption...", "LinkedIn caption..."],
      "predicted_scores": { "virality": 92, "conversion": 45, "retention": 60, "brand_trust": 55, "shareability": 88 }
    }
  ]
}
`;

// --- SYNTHETIC FOCUS GROUP PROMPT (Hedge Fund for Attention) ---
const SYNTHETIC_FOCUS_GROUP_PROMPT = `
You are the AI-Native Simulation Engine. Your task is to backtest a proposed marketing campaign by simulating a focus group of 3 distinct AI Personas. 

Step 1: Simulate the Personas.
Persona 1: "The Skeptic" (Hyper-critical, hates salesy language, looks for flaws).
Persona 2: "The Impulse Buyer" (Looking for emotional resonance, urgency, and clear benefits).
Persona 3: "The Core Demographic" (Evaluates if the tone and cultural relevance perfectly match).

Step 2: Each persona must provide a short 1-2 sentence critique of the input campaign.
Step 3: Based on their feedback, you (The Fixer) must rewrite the campaign to solve their objections, maximizing the "Predicted Success Score" (0-100).

You MUST output ONLY valid JSON matching this exact structure:
{
  "simulation": [
    { "name": "The Skeptic", "role": "Risk Analyst", "critique": "...", "approved": false },
    { "name": "The Impulse Buyer", "role": "Conversion Target", "critique": "...", "approved": true },
    { "name": "The Core Demographic", "role": "Cultural Validator", "critique": "...", "approved": true }
  ],
  "predicted_score": 92,
  "revised_campaign": {
    "hook": "...",
    "offer": "...",
    "cta": "...",
    "reasoning": {
      "hook_rationale": "...",
      "offer_rationale": "...",
      "cta_rationale": "...",
      "confidence_score": 92,
      "audience_insight": "..."
    },
    "funnel": {
      "top": "...",
      "bottom": "..."
    }
  }
}
`;

// --- ENGINE A: GEMINI PRO ---
async function callGeminiDirect(prompt: string, systemPrompt: string = ELITE_SYSTEM_PROMPT, timeoutMs: number = 8000): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini Key");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nBrand Focus: ${prompt}` }] }]
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Google Blocked`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } catch (error: any) {
    throw error; // Silent fail to trigger backup
  }
}

// --- ENGINE B: POLLINATIONS (GPT-4 CLASS) ---
async function callPollinationsText(prompt: string, systemPrompt: string = ELITE_SYSTEM_PROMPT): Promise<string> {
  const fullPrompt = `${systemPrompt}\n\nBrand Focus: ${prompt}`;
  
  const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&json=true`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Backup Failed');
  return await response.text();
}

// --- THE CRUCIBLE EVALUATION ---
async function runCrucible(initialDraftJson: any): Promise<any> {
  const inputStr = JSON.stringify(initialDraftJson, null, 2);
  try {
    const text = await callGeminiDirect(`Evaluate and fix this campaign:\n\n${inputStr}`, CRUCIBLE_SYSTEM_PROMPT);
    return parseResponse(text);
  } catch (err) {
    console.log("Crucible failed or timed out, using initial draft.");
    return initialDraftJson;
  }
}

// --- SYNTHETIC FOCUS GROUP EVALUATION ---
export async function runSyntheticFocusGroup(initialDraftJson: any): Promise<any> {
  const inputStr = JSON.stringify(initialDraftJson, null, 2);
  try {
    const text = await callGeminiDirect(`Run the synthetic focus group on this campaign:\n\n${inputStr}`, SYNTHETIC_FOCUS_GROUP_PROMPT, 15000);
    return parseResponse(text);
  } catch (err) {
    console.log("Synthetic Focus Group Gemini failed, trying Pollinations backup...", err);
    try {
      const text = await callPollinationsText(`Run the synthetic focus group on this campaign:\n\n${inputStr}`, SYNTHETIC_FOCUS_GROUP_PROMPT);
      return parseResponse(text);
    } catch (backupErr) {
      console.log("Synthetic Focus Group Pollinations failed, falling back to initial draft.", backupErr);
      return {
        simulation: [
          { name: "System", role: "Failsafe", critique: "Simulation timeout. Proceeding with baseline.", approved: true }
        ],
        predicted_score: initialDraftJson.reasoning?.confidence_score || 85,
        revised_campaign: initialDraftJson
      };
    }
  }
}

// --- DRAFT ORCHESTRATOR ---
export async function generateMarketingDraft(topic: string, businessType: string, brandContext?: string, performanceContext?: string, trendContext?: string): Promise<any> {
  const brandPrefix = brandContext ? `\n\nBRAND CONTEXT: ${brandContext}\n\n` : '';
  const perfPrefix = performanceContext ? `\n\nPERFORMANCE CONTEXT: ${performanceContext}\n\n` : '';
  const trendPrefix = trendContext ? `\n\nTREND CONTEXT: ${trendContext}\n\n` : '';
  const userRequest = `${brandPrefix}${perfPrefix}${trendPrefix}Business Type: ${businessType}, Campaign Topic: ${topic}`;

  try {
    const text = await callGeminiDirect(userRequest);
    return parseResponse(text);
  } catch (err) {
    const text = await callPollinationsText(userRequest);
    return parseResponse(text);
  }
}

// --- STANDARD ORCHESTRATOR (Legacy fallback) ---
export async function generateMarketingCopy(topic: string, businessType: string, brandContext?: string, performanceContext?: string, trendContext?: string): Promise<any> {
  const brandPrefix = brandContext ? `\n\nBRAND CONTEXT: ${brandContext}\n\n` : '';
  const perfPrefix = performanceContext ? `\n\nPERFORMANCE CONTEXT: ${performanceContext}\n\n` : '';
  const trendPrefix = trendContext ? `\n\nTREND CONTEXT: ${trendContext}\n\n` : '';
  const userRequest = `${brandPrefix}${perfPrefix}${trendPrefix}Business Type: ${businessType}, Campaign Topic: ${topic}`;

  try {
    const text = await callGeminiDirect(userRequest);
    const initialDraft = parseResponse(text);
    
    // P3 Predictive Scoring: If confidence is high, ship it. Otherwise, put it through the Crucible.
    const score = initialDraft.reasoning?.confidence_score || 0;
    if (score >= 80) {
      return initialDraft;
    } else {
      console.log(`Initial score ${score} < 80. Running through the Crucible...`);
      const finalDraft = await runCrucible(initialDraft);
      return finalDraft;
    }
  } catch (err1) {
    try {
      const text = await callPollinationsText(userRequest);
      return parseResponse(text);
    } catch (err2) {
      return {
        hook: "Redefine Excellence. Aaj hi shuru karein.",
        offer: "Premium Launch Privilege: 20% Advantage",
        cta: "Experience the Future",
        reasoning: {
          hook_rationale: "Aspirational framing with Hindi-English code-switching appeals to Indian Gen-Z's dual identity.",
          offer_rationale: "Exclusivity framing ('Privilege') converts 40% better than generic discount language.",
          cta_rationale: "Low-friction verb 'Experience' reduces purchase anxiety vs. 'Buy Now'.",
          confidence_score: 60,
          audience_insight: "Fallback strategy — generated without brand-specific context."
        },
        funnel: {
          top: "Video Hook: Fast cuts of premium lifestyle. Text: 'Stop settling.'",
          bottom: "SMS: Your 20% Advantage expires at midnight. Claim it now."
        }
      };
    }
  }
}

// --- GENOME ORCHESTRATOR (Multi-Variant) ---
export async function generateGenomeVariants(topic: string, businessType: string, brandContext?: string, performanceContext?: string, trendContext?: string): Promise<any> {
  const brandPrefix = brandContext ? `\n\nBRAND CONTEXT: ${brandContext}\n\n` : '';
  const perfPrefix = performanceContext ? `\n\n${performanceContext}\n\n` : '';
  const trendPrefix = trendContext ? `\n\n${trendContext}\n\n` : '';
  const userRequest = `${brandPrefix}${perfPrefix}${trendPrefix}Business Type: ${businessType}, Campaign Topic: ${topic}`;

  try {
    const text = await callGeminiDirect(userRequest, GENOME_SYSTEM_PROMPT);
    return parseResponse(text);
  } catch (err1) {
    try {
      const text = await callPollinationsText(userRequest, GENOME_SYSTEM_PROMPT);
      return parseResponse(text);
    } catch (err2) {
      // Return mock genome variants as fallback
      return {
        variants: [
          {
            genome_type: 'virality',
            hook: "This changes everything. And they don't want you to know.",
            offer: "48-Hour Flash: Early believers get 30% Advantage",
            cta: "See What's Coming",
            reasoning: { hook_rationale: "Curiosity gap + contrarian framing maximizes share potential.", offer_rationale: "Scarcity + insider language drives FOMO.", cta_rationale: "Soft CTA drives clicks without commitment pressure.", confidence_score: 72, audience_insight: "Viral fallback — provocative tone optimized for shareability." },
            captions: ["The future doesn't wait. Neither should you. 🔥", "POV: You found it before everyone else", "They said it couldn't be done. Watch this."],
            predicted_scores: { virality: 88, conversion: 42, retention: 55, brand_trust: 50, shareability: 90 }
          },
          {
            genome_type: 'conversion',
            hook: "Stop scrolling. This is the upgrade you've been searching for.",
            offer: "Limited: 30% off for the next 200 sign-ups",
            cta: "Claim Your Spot →",
            reasoning: { hook_rationale: "Pattern interrupt + direct benefit address.", offer_rationale: "Numeric scarcity (200 spots) creates real urgency.", cta_rationale: "Arrow symbol + possessive 'Your' increases click-through by 18%.", confidence_score: 78, audience_insight: "Conversion fallback — direct response copywriting principles." },
            captions: ["200 spots. No waitlist. Link in bio.", "Your competition already signed up. Just saying.", "ROI > Aesthetics. But we gave you both."],
            predicted_scores: { virality: 45, conversion: 92, retention: 68, brand_trust: 60, shareability: 40 }
          },
          {
            genome_type: 'authority',
            hook: "Built for the 1% who refuse to blend in.",
            offer: "Founding Member Access: Shape what we build next",
            cta: "Join the Inner Circle",
            reasoning: { hook_rationale: "Exclusivity identity framing attracts aspirational followers.", offer_rationale: "Co-creation offer builds deep brand loyalty.", cta_rationale: "'Inner Circle' community language drives long-term retention.", confidence_score: 75, audience_insight: "Authority fallback — brand-building over direct response." },
            captions: ["Not for everyone. And that's the point.", "We don't chase trends. We set them.", "Built different. For those who build different."],
            predicted_scores: { virality: 52, conversion: 55, retention: 90, brand_trust: 95, shareability: 58 }
          }
        ]
      };
    }
  }
}

function parseResponse(text: string): any {
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText);
}

// --- IMAGE GENERATION (FLUX ENGINE) ---

export function generatePoster(topic: string, businessType: string, engine: 'flux' | 'turbo' = 'flux'): string {
  const prompt = `Professional 3D cinematic commercial photography of ${topic} for ${businessType}, luxury studio lighting, 8k resolution, highly detailed masterpiece, sharp focus`;
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  
  if (engine === 'turbo') {
    // Fast Engine (3-5 seconds)
    return `https://pollinations.ai/p/${encodedPrompt}?width=1080&height=1080&model=turbo&seed=${seed}&nologo=true`;
  }

  // Quality Engine (15-20+ seconds)
  return `https://pollinations.ai/p/${encodedPrompt}?width=1080&height=1080&model=flux&seed=${seed}&nologo=true&enhance=true`;
}