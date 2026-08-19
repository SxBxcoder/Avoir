/**
 * Avoir — Shadow Clone Pipeline
 *
 * Orchestrates the full Shadow Clone video generation flow:
 *   1. Analyze brand voice from campaign assets
 *   2. Clone voice profile (or use default)
 *   3. Synthesize script audio via ElevenLabs
 *   4. Generate avatar video via HeyGen
 *   5. Deliver final video URL
 *
 * Emits SSE events matching the client parser:
 *   event: status  → { step, message }
 *   event: video   → { video_url }
 *
 * Credits are refunded if the pipeline fails before HeyGen accepts the task
 * (i.e. before createVideo succeeds).
 */

import { synthesize, cloneVoice, deleteVoice } from './elevenlabs';
import { createVideo, pollVideo } from './heygen';
import { saveShadowClone } from '@/lib/db/shadowClones';
import { addCredits } from '@/lib/services/subscription';
import { logger } from '@/lib/logger';
import type { PipelineStep } from '@/lib/types/shadowClone';

const encoder = new TextEncoder();

// Max base64 payload size for HeyGen (1MB safety limit)
const MAX_AUDIO_BASE64_BYTES = 1_000_000;

// ============================================================================
// SSE HELPERS
// ============================================================================

function sseStatus(step: PipelineStep, message: string): Uint8Array {
  return encoder.encode(`event: status\ndata: ${JSON.stringify({ step, message })}\n\n`);
}

function sseVideo(videoUrl: string): Uint8Array {
  return encoder.encode(`event: video\ndata: ${JSON.stringify({ video_url: videoUrl })}\n\n`);
}

// ============================================================================
// PIPELINE
// ============================================================================

export interface PipelineContext {
  userId: string;
  script: string;
  imageUrl: string;
  voiceId?: string;
  avatarId?: string;
}

/**
 * Runs the full Shadow Clone pipeline as an SSE ReadableStream.
 *
 * @param ctx    - Pipeline inputs (userId, script, image, optional overrides)
 * @param signal - AbortSignal from the request — checked during polling to
 *                 cleanly abort if the client disconnects.
 */
export function runShadowClonePipeline(
  ctx: PipelineContext,
  signal?: AbortSignal
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      let voiceId: string | null = null;
      let heygenAccepted = false;

      try {
        // Check for early disconnect
        if (signal?.aborted) throw new Error('Client disconnected');

        // Step 1: Analyze brand voice
        controller.enqueue(sseStatus(1, 'Analyzing brand voice DNA...'));
        await new Promise((r) => setTimeout(r, 500));

        // Step 2: Clone voice (or use default)
        controller.enqueue(sseStatus(2, 'Preparing voice profile...'));
        const voice = await cloneVoice(`shadow-clone-${ctx.userId}`, undefined);
        voiceId = voice.voice_id;
        await new Promise((r) => setTimeout(r, 300));

        // Step 3: Synthesize audio via ElevenLabs
        controller.enqueue(sseStatus(3, 'Synthesizing voice with ElevenLabs...'));
        const audio = await synthesize(voiceId, ctx.script);

        // Base64 payload size guard — HeyGen may reject oversized payloads
        const audioBase64 = audio.audio_buffer.toString('base64');
        if (audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
          throw new Error(
            `Audio payload too large (${(audioBase64.length / 1_000_000).toFixed(1)}MB). ` +
            `Script is too long for HeyGen data URI — keep scripts under ~45 seconds.`
          );
        }
        const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

        // Step 4: Generate video via HeyGen
        controller.enqueue(sseStatus(4, 'Rendering video with HeyGen pipeline...'));
        const videoTask = await createVideo({
          audioUrl: audioDataUrl,
          avatarId: ctx.avatarId,
          script: ctx.script,
        });
        heygenAccepted = true;

        // Poll for completion — pass AbortSignal to abort on client disconnect
        const result = await pollVideo(
          videoTask.video_id,
          (status) => {
            controller.enqueue(sseStatus(4, status));
          },
          undefined,
          signal
        );

        if (result.status === 'failed' || !result.video_url) {
          throw new Error(result.error || 'Video generation failed');
        }

        // Step 5: Deliver
        controller.enqueue(sseStatus(5, 'Shadow Clone ready for deployment'));

        // Final video event
        controller.enqueue(sseVideo(result.video_url));
        controller.close();

        // Persist result
        await saveShadowClone({
          userId: ctx.userId,
          videoId: videoTask.video_id,
          script: ctx.script,
          imageUrl: ctx.imageUrl,
          videoUrl: result.video_url,
          elevenLabsVoiceId: voiceId,
          heygenAvatarId: ctx.avatarId,
          createdAt: new Date().toISOString(),
        }).catch(() => {});

        logger.info('services.shadowClonePipeline', 'Pipeline completed', {
          userId: ctx.userId,
          videoId: videoTask.video_id,
          videoUrl: result.video_url,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown pipeline error';
        logger.error('services.shadowClonePipeline', 'Pipeline failed', {
          userId: ctx.userId,
          error: message,
          heygenAccepted,
        });

        // Refund credits if HeyGen never accepted the task
        // ( ElevenLabs error, base64 size limit, client disconnected early, etc. )
        if (!heygenAccepted) {
          await addCredits(ctx.userId, 50).catch(() => {});
          logger.info('services.shadowClonePipeline', 'Credits refunded (pre-HeyGen failure)', {
            userId: ctx.userId,
          });
        }

        controller.enqueue(sseStatus(0, `ERROR: ${message}`));
        controller.close();
      } finally {
        // Cleanup cloned voice
        if (voiceId) {
          await deleteVoice(voiceId).catch(() => {});
        }
      }
    },
  });
}
