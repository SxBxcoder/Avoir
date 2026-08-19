/**
 * Avoir — ElevenLabs TTS Service
 *
 * Handles voice cloning and text-to-speech synthesis via the ElevenLabs API.
 *
 * API Docs: https://elevenlabs.io/docs/api-reference
 *
 * Flow:
 *   1. cloneVoice() — optional, creates a temporary voice from a reference audio
 *   2. synthesize() — converts script text to speech audio (MP3)
 *
 * Requires ELEVENLABS_API_KEY in .env.
 */

import { logger } from '@/lib/logger';
import type { ElevenLabsVoiceCloneResult, ElevenLabsSynthesisResult } from '@/lib/types/shadowClone';

const API_KEY = process.env.ELEVENLABS_API_KEY || '';
const BASE_URL = 'https://api.elevenlabs.io/v1';

// Default voice for shadow clones (Rachel — natural female voice)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// ============================================================================
// HELPERS
// ============================================================================

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'xi-api-key': API_KEY,
    ...extra,
  };
}

// ============================================================================
// VOICE CLONING
// ============================================================================

/**
 * Clones a voice from a short audio sample.
 *
 * In the Shadow Clone context, we use the campaign image as a visual reference
 * and synthesize a generic voice. For true voice cloning, the user would
 * provide a 30s+ audio sample. This function supports both paths.
 *
 * @param name        - Display name for the cloned voice
 * @param audioBuffer - Optional audio sample (30s+ recommended for cloning)
 * @returns           - The created voice's ID
 */
export async function cloneVoice(
  name: string,
  audioBuffer?: Buffer
): Promise<ElevenLabsVoiceCloneResult> {
  if (!API_KEY) {
    logger.warn('services.elevenlabs', 'No API key — using default voice');
    return { voice_id: DEFAULT_VOICE_ID, name: 'Default (Rachel)' };
  }

  // If no audio sample provided, just use the default voice
  if (!audioBuffer) {
    logger.info('services.elevenlabs', 'No audio sample — using default voice');
    return { voice_id: DEFAULT_VOICE_ID, name: 'Default (Rachel)' };
  }

  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('files', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' }), `${name}.mp3`);

    const res = await fetch(`${BASE_URL}/voices/add`, {
      method: 'POST',
      headers: headers(),
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error('services.elevenlabs', 'Voice clone failed', { status: res.status, err });
      // Fall back to default voice
      return { voice_id: DEFAULT_VOICE_ID, name: 'Default (Rachel)' };
    }

    const data = await res.json();
    logger.info('services.elevenlabs', 'Voice cloned', { voice_id: data.voice_id });
    return { voice_id: data.voice_id, name };
  } catch (err) {
    logger.error('services.elevenlabs', 'Voice clone error', { err });
    return { voice_id: DEFAULT_VOICE_ID, name: 'Default (Rachel)' };
  }
}

// ============================================================================
// TEXT-TO-SPEECH
// ============================================================================

/**
 * Synthesizes text to speech using ElevenLabs TTS API.
 *
 * @param voiceId - The ElevenLabs voice ID to use
 * @param text    - The script text to synthesize
 * @returns       - Audio buffer (MP3) and content type
 */
export async function synthesize(
  voiceId: string,
  text: string
): Promise<ElevenLabsSynthesisResult> {
  if (!API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Accept: 'audio/mpeg' }),
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  logger.info('services.elevenlabs', 'TTS synthesized', {
    voiceId,
    chars: text.length,
    bytes: audioBuffer.length,
  });

  return { audio_buffer: audioBuffer, content_type: 'audio/mpeg' };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Deletes a cloned voice (cleanup after video is generated).
 * Call this to avoid accumulating stale voices in the ElevenLabs account.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  if (!API_KEY || voiceId === DEFAULT_VOICE_ID) return;

  try {
    await fetch(`${BASE_URL}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    logger.info('services.elevenlabs', 'Voice deleted', { voiceId });
  } catch (err) {
    logger.warn('services.elevenlabs', 'Voice delete failed (non-fatal)', { voiceId, err });
  }
}
