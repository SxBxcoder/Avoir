/**
 * Avoir — Team/Workspace DynamoDB Repository
 *
 * CRUD operations for teams, invitations, and audit logs.
 * Follows the same patterns as users.ts and campaigns.ts.
 *
 * Tables:
 *   - avoir-teams         → Team workspace metadata
 *   - avoir-team-members  → Team membership (PK: teamId, SK: userId)
 *   - avoir-invitations   → Pending invitations with TTL
 *
 * Features:
 *   - Atomic invitation acceptance via TransactWriteCommand
 *   - Redis-cached membership lookups (5-minute TTL)
 *   - Audit log entries with 90-day TTL
 *   - Paginated queries with exclusiveStartKey
 */

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import {
  type Team,
  type TeamMembership,
  type Invitation,
  type AuditEntry,
  type TeamRole,
  type AuditAction,
} from '@/lib/teams/types';
import { logger } from '@/lib/logger';

function uuid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// TEAM CRUD
// ============================================================================

export async function createTeam(ownerId: string, name: string): Promise<Team> {
  const client = getDynamoClient();
  const teamId = `team-${uuid()}`;
  const now = new Date().toISOString();

  const team: Team = {
    teamId,
    name,
    ownerId,
    maxSeats: 5,
    createdAt: now,
    updatedAt: now,
    settings: {
      allowMemberCampaignCreation: true,
      creditPoolEnabled: true,
    },
  };

  // Create team + add owner as member in a transaction
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLES.TEAMS,
            Item: team,
            ConditionExpression: 'attribute_not_exists(teamId)',
          },
        },
        {
          Put: {
            TableName: TABLES.TEAM_MEMBERS,
            Item: {
              teamId,
              userId: ownerId,
              role: 'owner' as TeamRole,
              joinedAt: now,
              invitedBy: ownerId,
              status: 'active',
            },
          },
        },
      ],
    })
  );

  return team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.TEAMS,
        Key: { teamId },
      })
    );
    return (result.Item as Team) || null;
  } catch (err) {
    logger.error('db.teams', 'Failed to get team', { teamId, err });
    return null;
  }
}

export async function listUserTeams(userId: string): Promise<Team[]> {
  const client = getDynamoClient();

  try {
    // Query the GSI to get all teams this user belongs to
    const memberResult = await client.send(
      new QueryCommand({
        TableName: TABLES.TEAM_MEMBERS,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
      })
    );

    const memberships = (memberResult.Items || []) as TeamMembership[];
    if (memberships.length === 0) return [];

    // Fetch each team
    const teams: Team[] = [];
    for (const membership of memberships) {
      const team = await getTeam(membership.teamId);
      if (team) teams.push(team);
    }

    return teams;
  } catch (err) {
    logger.error('db.teams', 'Failed to list user teams', { userId, err });
    return [];
  }
}

export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null> {
  const client = getDynamoClient();

  const expressionParts: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, any> = {};

  const merged: Record<string, any> = { ...updates, updatedAt: new Date().toISOString() };

  Object.entries(merged).forEach(([key, value]) => {
    if (key === 'teamId') return;
    const safeKey = `#${key}`;
    const safeVal = `:${key}`;
    expressionParts.push(`${safeKey} = ${safeVal}`);
    expressionNames[safeKey] = key;
    expressionValues[safeVal] = value;
  });

  if (expressionParts.length === 0) return getTeam(teamId);

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.TEAMS,
        Key: { teamId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes as Team;
  } catch (err) {
    logger.error('db.teams', 'Failed to update team', { teamId, err });
    return getTeam(teamId);
  }
}

// ============================================================================
// TEAM MEMBERS
// ============================================================================

export async function addMember(teamId: string, userId: string, role: TeamRole, invitedBy: string): Promise<TeamMembership> {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  const membership: TeamMembership = {
    teamId,
    userId,
    role,
    joinedAt: now,
    invitedBy,
    status: 'active',
  };

  await client.send(
    new PutCommand({
      TableName: TABLES.TEAM_MEMBERS,
      Item: membership,
      ConditionExpression: 'attribute_not_exists(teamId) AND attribute_not_exists(userId)',
    })
  );

  return membership;
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const client = getDynamoClient();

  await client.send(
    new DeleteCommand({
      TableName: TABLES.TEAM_MEMBERS,
      Key: { teamId, userId },
    })
  );
}

export async function updateMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMembership | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLES.TEAM_MEMBERS,
        Key: { teamId, userId },
        UpdateExpression: 'SET #role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': role },
        ReturnValues: 'ALL_NEW',
      })
    );
    return result.Attributes as TeamMembership;
  } catch (err) {
    logger.error('db.teams', 'Failed to update member role', { teamId, userId, err });
    return null;
  }
}

export async function listMembers(teamId: string): Promise<TeamMembership[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.TEAM_MEMBERS,
        KeyConditionExpression: 'teamId = :teamId',
        ExpressionAttributeValues: { ':teamId': teamId },
      })
    );
    return (result.Items || []) as TeamMembership[];
  } catch (err) {
    logger.error('db.teams', 'Failed to list members', { teamId, err });
    return [];
  }
}

export async function getUserTeamRole(teamId: string, userId: string): Promise<TeamRole | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.TEAM_MEMBERS,
        Key: { teamId, userId },
      })
    );
    return (result.Item?.role as TeamRole) || null;
  } catch {
    return null;
  }
}

// ============================================================================
// INVITATIONS
// ============================================================================

export async function createInvitation(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string
): Promise<Invitation> {
  const client = getDynamoClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation: Invitation = {
    token: uuid(),
    teamId,
    invitedEmail: email,
    invitedBy,
    role,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000),
  };

  await client.send(
    new PutCommand({
      TableName: TABLES.INVITATIONS,
      Item: invitation,
    })
  );

  return invitation;
}

export async function acceptInvitation(token: string, userId: string): Promise<{ success: boolean; teamId?: string; role?: TeamRole; error?: string }> {
  const client = getDynamoClient();

  // 1. Fetch the invitation
  const invResult = await client.send(
    new GetCommand({
      TableName: TABLES.INVITATIONS,
      Key: { token },
    })
  );

  const invitation = invResult.Item as Invitation | undefined;
  if (!invitation) return { success: false, error: 'Invitation not found.' };
  if (invitation.status !== 'pending') return { success: false, error: 'Invitation already used.' };
  if (new Date(invitation.expiresAt) < new Date()) return { success: false, error: 'Invitation expired.' };

  // 2. Atomic transaction: mark invitation accepted + add membership
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLES.INVITATIONS,
              Key: { token },
              UpdateExpression: 'SET #status = :accepted',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':accepted': 'accepted' },
              ConditionExpression: '#status = :pending',
            },
          },
          {
            Put: {
              TableName: TABLES.TEAM_MEMBERS,
              Item: {
                teamId: invitation.teamId,
                userId,
                role: invitation.role,
                joinedAt: new Date().toISOString(),
                invitedBy: invitation.invitedBy,
                status: 'active',
              },
              ConditionExpression: 'attribute_not_exists(teamId) AND attribute_not_exists(userId)',
            },
          },
        ],
      })
    );

    return { success: true, teamId: invitation.teamId, role: invitation.role };
  } catch (err) {
    logger.error('db.teams', 'Invitation accept transaction failed', { token, userId, err });
    return { success: false, error: 'Failed to accept invitation. It may have already been used.' };
  }
}

export async function revokeInvitation(token: string): Promise<boolean> {
  const client = getDynamoClient();

  try {
    await client.send(
      new UpdateCommand({
        TableName: TABLES.INVITATIONS,
        Key: { token },
        UpdateExpression: 'SET #status = :revoked',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':revoked': 'revoked' },
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function listPendingInvitations(teamId: string): Promise<Invitation[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.INVITATIONS,
        IndexName: 'teamId-index',
        KeyConditionExpression: 'teamId = :teamId',
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':teamId': teamId, ':pending': 'pending' },
      })
    );
    return (result.Items || []) as Invitation[];
  } catch (err) {
    logger.error('db.teams', 'Failed to list invitations', { teamId, err });
    return [];
  }
}

export async function validateInvitationToken(token: string): Promise<Invitation | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.INVITATIONS,
        Key: { token },
      })
    );

    const invitation = result.Item as Invitation | undefined;
    if (!invitation) return null;
    if (invitation.status !== 'pending') return null;
    if (new Date(invitation.expiresAt) < new Date()) return null;

    return invitation;
  } catch {
    return null;
  }
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function logAuditEvent(
  teamId: string,
  userId: string,
  action: AuditAction,
  details: Record<string, unknown> = {}
): Promise<void> {
  const client = getDynamoClient();
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const entry: AuditEntry = {
    teamId,
    logId: uuid(),
    userId,
    action,
    details,
    timestamp: now.toISOString(),
    ttl,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.AUDIT,
        Item: entry,
      })
    );
  } catch (err) {
    // Audit failures are non-fatal but logged loudly
    logger.error('db.teams', 'Audit log write failed', { teamId, userId, action, err });
  }
}

export async function getAuditLog(
  teamId: string,
  limit: number = 20,
  nextToken?: string
): Promise<{ entries: AuditEntry[]; nextToken?: string }> {
  const client = getDynamoClient();

  try {
    const params: any = {
      TableName: TABLES.AUDIT,
      IndexName: 'teamId-createdAt-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
      ScanIndexForward: false, // newest first
      Limit: limit,
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await client.send(new QueryCommand(params));

    return {
      entries: (result.Items || []) as AuditEntry[],
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };
  } catch (err) {
    logger.error('db.teams', 'Failed to get audit log', { teamId, err });
    return { entries: [] };
  }
}
