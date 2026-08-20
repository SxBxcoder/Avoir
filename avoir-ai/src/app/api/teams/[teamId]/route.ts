/**
 * Avoir — Team Detail API
 *
 * GET    /api/teams/[teamId]   → Get team + members + invitations
 * PATCH  /api/teams/[teamId]   → Update team name/settings
 * DELETE /api/teams/[teamId]   → Delete team (owner only)
 */

import { NextResponse } from 'next/server';
import { withTeamAuth } from '@/lib/api/withTeamAuth';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/teams/[teamId] — Get team details + members + pending invitations */
export const GET = withTeamAuth(async (req, ctx) => {
  if (isDemoMode()) {
    return NextResponse.json({
      team: {
        teamId: ctx.teamId,
        name: 'Avoir Marketing',
        ownerId: 'demo-user',
        maxSeats: 10,
        createdAt: '2025-01-15T00:00:00.000Z',
        updatedAt: '2025-01-15T00:00:00.000Z',
        settings: { allowMemberCampaignCreation: true, creditPoolEnabled: true },
      },
      members: [
        { teamId: ctx.teamId, userId: 'demo-user', role: 'owner', joinedAt: '2025-01-15T00:00:00.000Z', invitedBy: 'system', status: 'active', displayName: 'Demo User', email: 'demo@avoir.ai' },
        { teamId: ctx.teamId, userId: 'user-2', role: 'admin', joinedAt: '2025-02-01T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Sarah Chen', email: 'sarah@avoir.ai' },
        { teamId: ctx.teamId, userId: 'user-3', role: 'member', joinedAt: '2025-02-10T00:00:00.000Z', invitedBy: 'demo-user', status: 'active', displayName: 'Marcus Johnson', email: 'marcus@avoir.ai' },
      ],
      pendingInvitations: [
        { token: 'inv-demo-token', teamId: ctx.teamId, invitedEmail: 'new@avoir.ai', invitedBy: 'demo-user', role: 'member', status: 'pending', createdAt: '2025-03-01T00:00:00.000Z', expiresAt: '2025-03-08T00:00:00.000Z', ttl: 0 },
      ],
      yourRole: ctx.role,
    });
  }

  try {
    const { getTeam } = await import('@/lib/db/teams');
    const team = await getTeam(ctx.teamId);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    return NextResponse.json({ team, yourRole: ctx.role });
  } catch (err) {
    logger.error('api.teams.[teamId]', 'Failed to get team', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to get team' }, { status: 500 });
  }
}, { requiredPermission: 'team.view' });

/** PATCH /api/teams/[teamId] — Update team */
export const PATCH = withTeamAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { updateTeam } = await import('@/lib/db/teams');
    const team = await updateTeam(ctx.teamId, body);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    return NextResponse.json(team);
  } catch (err) {
    logger.error('api.teams.[teamId]', 'Failed to update team', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}, { requiredPermission: 'team.update' });

/** DELETE /api/teams/[teamId] — Delete team (owner only) */
export const DELETE = withTeamAuth(async (req, ctx) => {
  try {
    const { deleteTeam } = await import('@/lib/db/teams');
    await deleteTeam(ctx.teamId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    logger.error('api.teams.[teamId]', 'Failed to delete team', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}, { requiredPermission: 'team.delete' });
