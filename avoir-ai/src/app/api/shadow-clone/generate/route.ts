import { NextResponse } from 'next/server';
import { getSubscription, deductCredits } from '@/lib/services/subscription';
import { isDemoMode, createMockShadowCloneStream } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

/**
 * Proxy for Shadow Clone SSE stream
 */
export async function POST(req: Request) {
  // Demo Mock Shield
  if (isDemoMode()) {
    return new Response(createMockShadowCloneStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  try {
    const body = await req.json();

    // Identity comes from the verified Cognito JWT — no anonymous bypass.
    const { userId } = await requireUser(req);

    // 1. Check Credits
    const sub = await getSubscription(userId);
    if (sub.credits < 50) {
      console.log(`[ShadowClone] 🚫 User ${userId} blocked. Insufficient credits: ${sub.credits}.`);
      return NextResponse.json(
        { 
          error: 'Insufficient Credits',
          message: `Shadow Clone costs 50 credits. You have ${sub.credits}. Please upgrade to Pro or Enterprise.`,
          upgradeRequired: true,
          currentCredits: sub.credits,
          cost: 50,
        },
        { status: 402 } // Payment Required
      );
    }
    
    // 2. Deduct Credits
    await deductCredits(userId, 50);
    console.log(`[ShadowClone] 🚀 Deducted 50 credits from User ${userId}. Remaining: ${sub.credits - 50}`);
    
    // Call Python backend running on port 8000
    const response = await fetch('http://localhost:8000/api/shadow-clone/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend Error: ${response.status}`);
    }

    // Return the SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('Shadow Clone Proxy Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
