/**
 * Avoir — Team Member Presence
 *
 * Tracks which team members are currently online using Redis keys with TTL.
 * Heartbeats refresh the key every 30 seconds. If a client disconnects
 * without a cleanup, the key expires after 90 seconds.
 *
 * Uses Upstash Redis (HTTP-based, serverless-friendly).
 * Falls back gracefully when Redis is unavailable.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PresenceInfo {
  userId: string;
  teamId: string;
  lastSeen: number;   // epoch ms
  status: 'online' | 'away' | 'offline';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HEARTBEAT_INTERVAL_MS = 30_000;   // 30 seconds
const PRESENCE_TTL_MS = 90_000;         // 90 seconds
const PRESENCE_KEY_PREFIX = 'presence:team:';
const ONLINE_USERS_PREFIX = 'presence:online:';

// ============================================================================
// REDIS CLIENT
// ============================================================================

async function getRedis() {
  try {
    const { Redis } = await import('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

// ============================================================================
// SET / REMOVE PRESENCE
// ============================================================================

/**
 * Mark a user as online in a team.
 * Automatically sets a TTL so the key expires if the user disconnects.
 */
export async function setPresence(teamId: string, userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = `${PRESENCE_KEY_PREFIX}${teamId}:${userId}`;
  const now = Date.now();

  try {
    const pipe = redis.pipeline();
    pipe.set(key, JSON.stringify({ userId, teamId, lastSeen: now, status: 'online' }), { px: PRESENCE_TTL_MS });
    pipe.sadd(`${ONLINE_USERS_PREFIX}${teamId}`, userId);
    pipe.expire(`${ONLINE_USERS_PREFIX}${teamId}`, Math.ceil(PRESENCE_TTL_MS / 1000) + 10);
    await pipe.exec();
  } catch (err) {
    logger.warn('presence', 'Failed to set presence', { teamId, userId, err });
  }
}

/**
 * Remove a user's presence (they went offline).
 */
export async function removePresence(teamId: string, userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = `${PRESENCE_KEY_PREFIX}${teamId}:${userId}`;

  try {
    const pipe = redis.pipeline();
    pipe.del(key);
    pipe.srem(`${ONLINE_USERS_PREFIX}${teamId}`, userId);
    await pipe.exec();
  } catch (err) {
    logger.warn('presence', 'Failed to remove presence', { teamId, userId, err });
  }
}

// ============================================================================
// GET ONLINE USERS
// ============================================================================

/**
 * Get all online members of a team.
 */
export async function getOnlineMembers(teamId: string): Promise<PresenceInfo[]> {
  const redis = await getRedis();
  if (!redis) return [];

  try {
    const userIds = await redis.smembers(`${ONLINE_USERS_PREFIX}${teamId}`);
    if (!userIds || userIds.length === 0) return [];

    const pipe = redis.pipeline();
    for (const uid of userIds) {
      pipe.get(`${PRESENCE_KEY_PREFIX}${teamId}:${uid}`);
    }
    const results = await pipe.exec();

    const now = Date.now();
    return results
      .map((val) => {
        if (!val || typeof val !== 'string') return null;
        try {
          const parsed = JSON.parse(val) as PresenceInfo;
          // Determine status based on lastSeen
          if (now - parsed.lastSeen > PRESENCE_TTL_MS) {
            return { ...parsed, status: 'away' as const };
          }
          return parsed;
        } catch {
          return null;
        }
      })
      .filter((p): p is PresenceInfo => p !== null);
  } catch (err) {
    logger.warn('presence', 'Failed to get online members', { teamId, err });
    return [];
  }
}

/**
 * Check if a specific user is online.
 */
export async function isUserOnline(teamId: string, userId: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;

  try {
    const key = `${PRESENCE_KEY_PREFIX}${teamId}:${userId}`;
    const val = await redis.get(key);
    return val !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// HEARTBEAT (client-side helper)
// ============================================================================

/**
 * Start a presence heartbeat for a team member.
 * Returns a cleanup function that removes presence and stops the interval.
 *
 * Usage in React:
 *   useEffect(() => {
 *     if (teamId && userId) {
 *       const cleanup = startPresenceHeartbeat(teamId, userId);
 *       return cleanup;
 *     }
 *   }, [teamId, userId]);
 */
export function startPresenceHeartbeat(teamId: string, userId: string): () => void {
  // Set initial presence
  setPresence(teamId, userId);

  const interval = setInterval(() => {
    setPresence(teamId, userId);
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    removePresence(teamId, userId);
  };
}
