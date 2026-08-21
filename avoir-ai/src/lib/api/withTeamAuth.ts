/**
 * Avoir — Team-aware API route wrapper
 *
 * Wraps Next.js route handlers with:
 *   1. JWT verification (via requireUser)
 *   2. Team membership verification (via Redis cache, fallback to DynamoDB)
 *   3. Role-based permission checking
 *
 * Usage in route handlers:
 *
 *   import { withTeamAuth, type TeamContext } from '@/lib/api/withTeamAuth';
 *
 *   export const GET = withTeamAuth(async (req, ctx: TeamContext) => {
 *     // ctx.userId, ctx.teamId, ctx.role are verified
 *     // Only runs if user has the required permission
 *     return NextResponse.json({ ok: true });
 *   }, { requiredPermission: 'team.view' });
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamContext {
  userId: string;
  email?: string;
  teamId: string;
  role: TeamRole;
}

export interface WithTeamAuthOptions {
  /** If set, the handler only runs when the user has this permission. */
  requiredPermission?: string;
  /** If true, skip team verification (only auth). Useful for team creation routes. */
  skipTeam?: boolean;
}

// ============================================================================
// PERMISSION MATRIX
// ============================================================================

const PERMISSIONS: Record<string, TeamRole[]> = {
  'team.view':          ['owner', 'admin', 'member'],
  'team.update':        ['owner', 'admin'],
  'team.delete':        ['owner'],
  'team.manage_billing': ['owner'],
  'team.view_audit':    ['owner', 'admin'],

  'member.invite':      ['owner', 'admin'],
  'member.remove':      ['owner', 'admin'],
  'member.update_role': ['owner'],

  'campaign.view':      ['owner', 'admin', 'member'],
  'campaign.create':    ['owner', 'admin', 'member'],
  'campaign.delete':    ['owner', 'admin'],

  'brand_dna.view':     ['owner', 'admin', 'member'],
  'brand_dna.update':   ['owner', 'admin', 'member'],

  'invitation.create':  ['owner', 'admin'],
  'invitation.revoke':  ['owner', 'admin'],
};

/**
 * Check if a role has a given permission.
 */
export function hasPermission(role: TeamRole, permission: string): boolean {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

// ============================================================================
// TEAM MEMBERSHIP RESOLUTION
// ============================================================================

/**
 * Resolve team membership. Tries Redis cache first, falls back to DynamoDB.
 * Returns the role if the user is a member, null otherwise.
 */
async function resolveTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  // Try Redis cache first (fast path)
  try {
    const { Redis } = await import('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      const redis = new Redis({ url, token });
      const cached = await redis.get(`team:member:${teamId}:${userId}`) as string | null;
      if (cached) {
        return cached as TeamRole;
      }
    }
  } catch {
    // Redis unavailable — fall through to DynamoDB
  }

  // Fallback: read from DynamoDB
  try {
    const { getDynamoClient, TABLES } = await import('@/lib/db/dynamodb');
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const client = getDynamoClient();

    const result = await client.send(
      new GetCommand({
        TableName: TABLES.TEAM_MEMBERS,
        Key: { teamId, userId },
      })
    );

    if (result.Item?.role) {
      const role = result.Item.role as TeamRole;

      // Cache in Redis for 5 minutes (best-effort)
      try {
        const { Redis } = await import('@upstash/redis');
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (url && token) {
          const redis = new Redis({ url, token });
          await redis.set(`team:member:${teamId}:${userId}`, role, { ex: 300 });
        }
      } catch { /* cache write failure is non-fatal */ }

      return role;
    }
  } catch (err) {
    logger.error('withTeamAuth', 'DynamoDB membership lookup failed', { userId, teamId, err });
  }

  return null;
}

// ============================================================================
// DEMO MODE TEAM CONTEXT
// ============================================================================

function getDemoTeamContext(req: NextRequest, userId: string): TeamContext | null {
  const teamId = req.headers.get('x-team-id') || req.nextUrl.searchParams.get('teamId');
  if (!teamId) return null;

  return {
    userId,
    teamId,
    role: 'owner', // Demo user owns their workspace
  };
}

// ============================================================================
// HOF: withTeamAuth
// ============================================================================

export function withTeamAuth<T extends NextRequest>(
  handler: (req: T, ctx: TeamContext) => Promise<NextResponse>,
  options: WithTeamAuthOptions = {}
) {
  return async (req: T): Promise<NextResponse> => {
    try {
      // 1. Verify JWT identity
      const { userId, email } = await requireUser(req);

      // 2. If skipTeam, just run the handler with basic context
      if (options.skipTeam) {
        const teamId = req.headers.get('x-team-id') || '';
        return handler(req, { userId, email, teamId, role: 'owner' });
      }

      // 3. Resolve team context
      const teamId = req.headers.get('x-team-id') || req.nextUrl.searchParams.get('teamId') || '';

      if (!teamId) {
        return NextResponse.json(
          { error: 'teamId is required. Provide it in the URL path or x-team-id header.' },
          { status: 400 }
        );
      }

      // Demo mode: bypass membership check
      let role: TeamRole;
      if (isDemoMode()) {
        const demoCtx = getDemoTeamContext(req, userId);
        role = demoCtx?.role || 'owner';
      } else {
        const resolvedRole = await resolveTeamRole(userId, teamId);
        if (!resolvedRole) {
          return NextResponse.json(
            { error: 'You are not a member of this team.' },
            { status: 403 }
          );
        }
        role = resolvedRole;
      }

      // 4. Check permission (if required)
      if (options.requiredPermission && !hasPermission(role, options.requiredPermission)) {
        return NextResponse.json(
          { error: `Insufficient permissions. Required: ${options.requiredPermission}` },
          { status: 403 }
        );
      }

      // 5. Run the handler
      return handler(req, { userId, email, teamId, role });
    } catch (error) {
      const authError = authErrorResponse(error);
      if (authError) return authError;

      logger.error('withTeamAuth', 'Unexpected error', { error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
