/**
 * Avoir — Team Members API
 *
 * GET  /api/teams/[teamId]/members          → List all members
 * POST /api/teams/[teamId]/members          → Add member directly
 */

import { NextResponse } from 'next/server';
import { withTeamAuth, type TeamContext } from '@/lib/api/withTeamAuth';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/teams/[teamId]/members — List all members */
export const GET = withTeamAuth(async (req, ctx: TeamContext) => {
  if (isDemoMode()) {
    return NextResponse.json({
      members: [
        { teamId: ctx.teamId, userId: 'demo-user', role: 'owner', joinedAt: '2025-01-15T00:00:00.000Z', invitedBy: 'system', status: 'active', displayName: 'Demo User', email: 'demo@avoir.ai' },
        { teamId: ctx.teamId, userId: 'user-2', role: 'admin', joinedAt: '2025-02-01T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Sarah Chen', email: 'sarah@avoir.ai' },
        { teamId: ctx.teamId, userId: 'user-3', role: 'member', joinedAt: '2025-02-10T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Marcus Johnson', email: 'marcus@avoir.ai' },
      ],
      count: 3,
    });
  }

  try {
    const { listMembers } = await import('@/lib/db/teams');
    const members = await listMembers(ctx.teamId);
    return NextResponse.json({ members, count: members.length });
  } catch (err) {
    logger.error('api.teams.members', 'Failed to list members', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}, { requiredPermission: 'team.view' });

/** POST /api/teams/[teamId]/members — Add a member directly */
export const POST = withTeamAuth(async (req, ctx: TeamContext) => {
  try {
    const body = await req.json();
    const { userId: targetUserId, role } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const validRoles = ['owner', 'admin', 'member'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({
        teamId: ctx.teamId,
        userId: targetUserId,
        role: role || 'member',
        joinedAt: new Date().toISOString(),
        invitedBy: ctx.userId,
        status: 'active',
      }, { status: 201 });
    }

    const { addMember } = await import('@/lib/db/teams');
    const membership = await addMember(ctx.teamId, targetUserId, role || 'member', ctx.userId);
    return NextResponse.json(membership, { status: 201 });
  } catch (err) {
    logger.error('api.teams.members', 'Failed to add member', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}, { requiredPermission: 'member.invite' });
