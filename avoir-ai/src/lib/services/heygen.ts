/**
 * Avoir — HeyGen Video Service
 *
 * Generates avatar videos via the HeyGen API.
 *
 * API Docs: https://docs.heygen.com/reference
 *
 * Flow:
 *   1. createVideo() — submits a video generation task (audio + avatar)
 *   2. pollVideo()   — polls until completion (with timeout)
 *   3. getVideo()    — fetches final video URL
 *
 * Requires HEYGEN_API_KEY in .env.
 */

import { logger } from '@/lib/logger';
import type { HeyGenVideoResult } from '@/lib/types/shadowClone';

const API_KEY = process.env.HEYGEN_API_KEY || '';
const BASE_URL = 'https://api.heygen.com';
const DEFAULT_AVATAR_ID = 'josh_lite3_20230714';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

// ============================================================================
// CREATE VIDEO
// ============================================================================

/**
 * Creates a HeyGen video generation task.
 *
 * @param audioUrl  - URL of the synthesized audio (from ElevenLabs or hosted)
 * @param avatarId  - HeyGen avatar ID to use
 * @param script    - The script text (for display/caption purposes)
 * @returns         - Video ID and initial status
 */
export async function createVideo(params: {
  audioUrl: string;
  avatarId?: string;
  script: string;
}): Promise<{ video_id: string; status: 'pending' }> {
  if (!API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  const { audioUrl, avatarId, script } = params;

  const res = await fetch(`${BASE_URL}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId || DEFAULT_AVATAR_ID,
            avatar_style: 'normal',
          },
          voice: {
            type: 'audio',
            audio_url: audioUrl,
          },
          background: {
            type: 'color',
            value: '#000000',
          },
        },
      ],
      dimension: {
        width: 1280,
        height: 720,
      },
      test: false,
      caption: {
        enabled: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HeyGen create video failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const videoId = data.data?.video_id;

  if (!videoId) {
    throw new Error('HeyGen returned no video_id');
  }

  logger.info('services.heygen', 'Video task created', { videoId, avatarId });
  return { video_id: videoId, status: 'pending' };
}

// ============================================================================
// POLL FOR COMPLETION
// ============================================================================

/**
 * Polls HeyGen until the video is ready or failed.
 *
 * @param videoId       - The video ID to poll
 * @param onProgress    - Optional callback for progress updates
 * @param maxAttempts   - Max poll attempts before timeout
 * @returns             - Final video result with URL
 */
export async function pollVideo(
  videoId: string,
  onProgress?: (status: string) => void,
  maxAttempts = MAX_POLL_ATTEMPTS
): Promise<HeyGenVideoResult> {
  if (!API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${BASE_URL}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': API_KEY },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HeyGen poll failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    const status = data.data?.status;
    const videoUrl = data.data?.video_url;

    if (status === 'completed') {
      logger.info('services.heygen', 'Video completed', { videoId, url: videoUrl });
      return { video_id: videoId, status: 'completed', video_url: videoUrl };
    }

    if (status === 'failed') {
      const error = data.data?.error || 'Unknown error';
      logger.error('services.heygen', 'Video failed', { videoId, error });
      return { video_id: videoId, status: 'failed', error };
    }

    // Still processing
    onProgress?.(`Processing video... (${attempt + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Timeout
  logger.error('services.heygen', 'Video poll timeout', { videoId, maxAttempts });
  return { video_id: videoId, status: 'failed', error: 'Video generation timed out' };
}

// ============================================================================
// GET VIDEO (one-shot fetch)
// ============================================================================

/**
 * Fetches the current status and URL of a video.
 * Use this for one-shot checks without polling.
 */
export async function getVideo(videoId: string): Promise<HeyGenVideoResult> {
  if (!API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  const res = await fetch(`${BASE_URL}/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': API_KEY },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HeyGen get video failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const d = data.data;

  return {
    video_id: videoId,
    status: d?.status || 'failed',
    video_url: d?.video_url,
    error: d?.error,
  };
}
