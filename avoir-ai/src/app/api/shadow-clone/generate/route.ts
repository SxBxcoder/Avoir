import { NextResponse } from 'next/server';
import { getSubscription, deductCredits, addCredits } from '@/lib/services/subscription';
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

    // 1. Check Credits (fast UX gate — the authoritative reservation is below)
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

    // 2. Reserve credits atomically BEFORE starting the paid job. The
    // conditional decrement means concurrent requests can never all pass the
    // read-only pre-check and overdraw — only the balance can reserve.
    const deduction = await deductCredits(userId, 50);
    if (!deduction.success) {
      return NextResponse.json(
        {
          error: 'Insufficient Credits',
          message: `Shadow Clone costs 50 credits. You have ${deduction.subscription.credits}. Please upgrade to Pro or Enterprise.`,
          upgradeRequired: true,
          currentCredits: deduction.subscription.credits,
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
      // Backend refused the job — refund the reservation; the user never
      // received a stream. Best-effort: addCredits never throws.
      await addCredits(userId, 50).catch(() => {});
      throw new Error(`Backend Error: ${response.status}`);
    }

    // Return the SSE stream directly (the reservation stands — the backend
    // accepted the job)
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
