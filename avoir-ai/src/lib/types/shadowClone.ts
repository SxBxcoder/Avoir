/**
 * Avoir — Shadow Clone Types
 *
 * Shared types for the Shadow Clone video generation pipeline.
 * Covers: request/response shapes, pipeline events, service interfaces.
 */

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

export interface ShadowCloneRequest {
  /** Script text to speak (campaign caption or hook). */
  script: string;
  /** Campaign image URL used as avatar reference. */
  image_url: string;
  /** Optional: override the voice to use (ElevenLabs voice ID). */
  voice_id?: string;
  /** Optional: override the HeyGen avatar ID. */
  avatar_id?: string;
}

// ============================================================================
// PIPELINE EVENTS (SSE)
// ============================================================================

export type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface PipelineStatusEvent {
  step: PipelineStep;
  message: string;
}

export interface PipelineVideoEvent {
  video_url: string;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface ElevenLabsVoiceCloneResult {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export interface ElevenLabsSynthesisResult {
  audio_buffer: Buffer;
  content_type: string;
}

export interface HeyGenVideoResult {
  video_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

export interface ShadowCloneRecord {
  userId: string;
  videoId: string;
  campaignId?: string;
  script: string;
  imageUrl: string;
  videoUrl: string;
  elevenLabsVoiceId?: string;
  heygenAvatarId?: string;
  createdAt: string;
}
