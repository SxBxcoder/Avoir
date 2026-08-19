/**
 * Avoir — Shadow Clone Generation API
 *
 * POST /api/shadow-clone/generate
 *
 * Generates a "Shadow Clone" avatar video from campaign assets.
 * Runs the full pipeline directly (ElevenLabs TTS → HeyGen video)
 * and streams progress via SSE.
 *
 * Cost: 50 credits (pre-reserved atomically before pipeline starts).
 */

import { NextResponse } from 'next/server';
import { getSubscription, deductCredits, addCredits } from '@/lib/services/subscription';
import { isDemoMode, createMockShadowCloneStream } from '@/lib/mockShield';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { runShadowClonePipeline } from '@/lib/services/shadowClonePipeline';
import { logger } from '@/lib/logger';

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
    const { userId } = await requireUser(req);

    const body = await req.json().catch(() => ({}));
    const script = body.script || '';
    const imageUrl = body.image_url || '';

    if (!script) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 });
    }

    // 1. Credit pre-check (fast UX gate)
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
        { status: 402 }
      );
    }

    // 2. Atomic credit reservation
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
        { status: 402 }
      );
    }

    // 3. Run the pipeline as an SSE stream
    const pipeline = runShadowClonePipeline({
      userId,
      script,
      imageUrl,
      voiceId: body.voice_id,
      avatarId: body.avatar_id,
    });

    // Note: credits are consumed on pipeline start. If the pipeline fails
    // internally, the error event is emitted but credits are not refunded
    // because the pipeline attempted real API calls (ElevenLabs + HeyGen).
    // The user sees the error in the modal.

    return new Response(pipeline, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const authErr = authErrorResponse(error);
    if (authErr) return authErr;
    logger.error('shadow-clone', 'Generation failed', { err: error });
    const message = error instanceof Error ? error.message : 'Generation failed';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
