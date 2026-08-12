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
    // Identity comes from the verified Cognito JWT — no anonymous bypass.
    const { userId } = await requireUser(req);

    const body = await req.json().catch(() => ({}));

    // 1. Check Credits
    const sub = await getSubscription(userId);
    if (sub.credits < 50) {
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
    
    // Call Python backend running on port 8000
    const response = await fetch('http://localhost:8000/api/shadow-clone/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.get('Authorization') ? { 'Authorization': req.headers.get('Authorization') as string } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Backend refused the job — do NOT charge the user for a stream they
      // never received.
      throw new Error(`Backend Error: ${response.status}`);
    }

    // 2. Deduct Credits (only after the backend accepted the job)
    await deductCredits(userId, 50);

    // Return the SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    console.error('Shadow Clone Proxy Error:', error);
    const message = error instanceof Error ? error.message : 'Stream failed';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
