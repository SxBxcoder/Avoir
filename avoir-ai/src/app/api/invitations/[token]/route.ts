/**
 * Avoir — Public Invitation API
 *
 * GET  /api/invitations/[token]           → Validate invitation token
 * POST /api/invitations/[token]/accept     → Accept invitation
 *
 * These routes are PUBLIC (no auth required for validate).
 * Accept requires a userId in the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/mockShield';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/invitations/[token] — Validate an invitation token */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (isDemoMode()) {
    return NextResponse.json({
      valid: true,
      teamName: 'Avoir Marketing',
      role: 'member',
      invitedBy: 'demo-user',
    });
  }

  try {
    const { validateInvitationToken } = await import('@/lib/db/teams');
    const invitation = await validateInvitationToken(token);

    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // Fetch team name
    const { getTeam } = await import('@/lib/db/teams');
    const team = await getTeam(invitation.teamId);

    return NextResponse.json({
      valid: true,
      teamName: team?.name || 'Unknown Team',
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    });
  } catch (err) {
    logger.error('api.invitations', 'Failed to validate invitation', { token, err });
    return NextResponse.json(
      { valid: false, error: 'Failed to validate invitation' },
      { status: 500 }
    );
  }
}

/** POST /api/invitations/[token]/accept — Accept an invitation */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required to accept invitation' }, { status: 400 });
    }

    if (isDemoMode()) {
      return NextResponse.json({
        success: true,
        teamId: 'team-demo-001',
        role: 'member',
        message: 'Welcome to the team!',
      });
    }

    const { acceptInvitation } = await import('@/lib/db/teams');
    const result = await acceptInvitation(token, userId);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      teamId: result.teamId,
      role: result.role,
      message: 'Welcome to the team!',
    });
  } catch (err) {
    logger.error('api.invitations', 'Failed to accept invitation', { token, err });
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
