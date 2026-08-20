/**
 * Avoir — Teams API
 *
 * GET  /api/teams         → List user's teams
 * POST /api/teams         → Create a new team
 */

import { NextResponse } from 'next/server';
import { withTeamAuth } from '@/lib/api/withTeamAuth';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const DEMO_TEAMS = [
  {
    teamId: 'team-demo-001',
    name: 'Avoir Marketing',
    ownerId: 'demo-user',
    maxSeats: 10,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    settings: { allowMemberCampaignCreation: true, creditPoolEnabled: true },
  },
];

/** GET /api/teams — List teams the current user belongs to */
export const GET = withTeamAuth(async (_req, ctx) => {
  if (isDemoMode()) {
    return NextResponse.json({ teams: DEMO_TEAMS, count: DEMO_TEAMS.length });
  }

  try {
    const { listUserTeams } = await import('@/lib/db/teams');
    const teams = await listUserTeams(ctx.userId);
    return NextResponse.json({ teams, count: teams.length });
  } catch (err) {
    logger.error('api.teams', 'Failed to list teams', { err });
    return NextResponse.json({ error: 'Failed to list teams' }, { status: 500 });
  }
}, { skipTeam: true });

/** POST /api/teams — Create a new team */
export const POST = withTeamAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    if (name.length > 50) {
      return NextResponse.json({ error: 'Team name must be 50 characters or less' }, { status: 400 });
    }

    if (isDemoMode()) {
      const newTeam = {
        teamId: `team-demo-${Date.now()}`,
        name: name.trim(),
        ownerId: ctx.userId,
        maxSeats: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: { allowMemberCampaignCreation: true, creditPoolEnabled: true },
      };
      return NextResponse.json(newTeam, { status: 201 });
    }

    const { createTeam } = await import('@/lib/db/teams');
    const team = await createTeam(ctx.userId, name.trim());
    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    logger.error('api.teams', 'Failed to create team', { err });
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}, { skipTeam: true });
