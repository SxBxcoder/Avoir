/**
 * Avoir — Team Invitations API
 *
 * GET  /api/teams/[teamId]/invitations       → List pending invitations
 * POST /api/teams/[teamId]/invitations       → Create an invitation
 */

import { NextResponse } from 'next/server';
import { withTeamAuth, type TeamContext } from '@/lib/api/withTeamAuth';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/teams/[teamId]/invitations — List pending invitations */
export const GET = withTeamAuth(async (req, ctx: TeamContext) => {
  if (isDemoMode()) {
    return NextResponse.json({
      invitations: [
        {
          token: 'inv-demo-token-abc',
          teamId: ctx.teamId,
          invitedEmail: 'pending@avoir.ai',
          invitedBy: ctx.userId,
          role: 'member',
          status: 'pending',
          createdAt: '2025-03-01T00:00:00.000Z',
          expiresAt: '2025-03-08T00:00:00.000Z',
          ttl: 0,
        },
      ],
      count: 1,
    });
  }

  try {
    const { listPendingInvitations } = await import('@/lib/db/teams');
    const invitations = await listPendingInvitations(ctx.teamId);
    return NextResponse.json({ invitations, count: invitations.length });
  } catch (err) {
    logger.error('api.teams.invitations', 'Failed to list invitations', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to list invitations' }, { status: 500 });
  }
}, { requiredPermission: 'team.view' });

/** POST /api/teams/[teamId]/invitations — Create an invitation */
export const POST = withTeamAuth(async (req, ctx: TeamContext) => {
  try {
    const body = await req.json();
    const { email, role } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const validRoles = ['admin', 'member'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({
        token: `inv-demo-${Date.now()}`,
        teamId: ctx.teamId,
        invitedEmail: email,
        invitedBy: ctx.userId,
        role: role || 'member',
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ttl: 0,
      }, { status: 201 });
    }

    const { createInvitation } = await import('@/lib/db/teams');
    const invitation = await createInvitation(ctx.teamId, email, role || 'member', ctx.userId);
    return NextResponse.json(invitation, { status: 201 });
  } catch (err) {
    logger.error('api.teams.invitations', 'Failed to create invitation', { teamId: ctx.teamId, err });
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}, { requiredPermission: 'invitation.create' });
