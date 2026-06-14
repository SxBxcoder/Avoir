// src/lib/bedrock.ts

// --- THE "PREMIUM BRAND" PROMPT ---
// We removed the word count limits to let the AI write deeper, classier text.
const ELITE_SYSTEM_PROMPT = `
You are a World-Class Copywriter for a luxury brand (think Apple, Nike, Cred).
  Your goal is to write a high-status, emotionally resonant campaign for a global audience.
  
  FORMAT:
  Language: "Global Viral English" (modern, high-converting, punchy).

Instructions:
1. "hook": Write a magnetic headline. It should promise a transformation, not just a product.
   - Cheap: "Buy domains fast."
   - Premium: "Your digital legacy begins here. Naam banao, pehchaan banao."
   
2. "offer": A value-driven proposition, not just a discount.
   - Cheap: "30% off."
   - Premium: "Exclusive Early Access: 30% Advantage for the visionaries."

3. "cta": A confident, low-pressure command.
   - Cheap: "Click here now."
   - Premium: "Claim Your Space" or "Begin the Journey."

Output JSON Structure:
{
  "hook": "...",
  "offer": "...",
  "cta": "..."
}
`;

// --- ENGINE A: GEMINI PRO (With 1.5s Speed Limit) ---
async function callGeminiDirect(prompt: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini Key");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

  // AGGRESSIVE TIMEOUT: If Google doesn't reply in 1.5s, we kill it.
  // This makes the app feel instant even if Google fails.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${ELITE_SYSTEM_PROMPT}\n\nBrand Focus: ${prompt}` }] }]
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
async function callPollinationsText(prompt: string): Promise<string> {
  // We use the exact same Elite Prompt here
  const fullPrompt = `${ELITE_SYSTEM_PROMPT}\n\nBrand Focus: ${prompt}`;
  
  // 'model=openai' ensures high-logic responses
  const url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai&json=true`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Backup Failed');
  return await response.text();
}

// --- ORCHESTRATOR ---
export async function generateMarketingCopy(topic: string, businessType: string): Promise<any> {
  const userRequest = `Business Type: ${businessType}, Campaign Topic: ${topic}`;

  try {
    // 1. Try Google (Fast check)
    const text = await callGeminiDirect(userRequest);
    return parseResponse(text);
  } catch (err1) {
    // 2. Instant Switch to Premium Backup
    // We don't log errors anymore to keep the terminal clean
    try {
      const text = await callPollinationsText(userRequest);
      return parseResponse(text);
    } catch (err2) {
      // 3. Fallback (Safe Mode)
      return {
        hook: "Redefine Excellence. Aaj hi shuru karein.",
        offer: "Premium Launch Privilege: 20% Advantage",
        cta: "Experience the Future"
      };
    }
  }
}

function parseResponse(text: string): any {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    return {
      hook: "Innovation meets Tradition. Perfect choice.",
      offer: "Exclusive Member Pricing Applied",
      cta: "Explore Collection"
    };
  }
}

// --- IMAGE GENERATION (FLUX ENGINE) ---
// src/lib/bedrock.ts

// src/lib/bedrock.ts

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