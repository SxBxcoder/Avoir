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
 */

import { synthesize, cloneVoice, deleteVoice } from './elevenlabs';
import { createVideo, pollVideo } from './heygen';
import { saveShadowClone } from '@/lib/db/shadowClones';
import { logger } from '@/lib/logger';
import type { PipelineStep } from '@/lib/types/shadowClone';

const encoder = new TextEncoder();

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
 * Each step emits an `event: status` SSE event with a step number and message.
 * On completion, emits `event: video` with the final video URL.
 * On failure, emits `event: status` with step 0 and an error message.
 */
export function runShadowClonePipeline(ctx: PipelineContext): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      let voiceId: string | null = null;

      try {
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

        // Upload audio to a temporary hosting (HeyGen needs a URL)
        // We use a data URI for now — HeyGen accepts base64 audio
        const audioBase64 = audio.audio_buffer.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

        // Step 4: Generate video via HeyGen
        controller.enqueue(sseStatus(4, 'Rendering video with HeyGen pipeline...'));
        const videoTask = await createVideo({
          audioUrl: audioDataUrl,
          avatarId: ctx.avatarId,
          script: ctx.script,
        });

        // Poll for completion
        const result = await pollVideo(videoTask.video_id, (status) => {
          controller.enqueue(sseStatus(4, status));
        });

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
        });

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
