/**
 * Avoir — Team-Scoped Campaign Queries
 *
 * Extends the existing campaign repository with team-aware queries.
 * Campaigns can now be optionally scoped to a team via a `teamId` GSI.
 *
 * Key behaviors:
 *   - Existing personal campaigns (no teamId) continue to work unchanged
 *   - Team campaigns use the teamId-index GSI on avoir-campaigns
 *   - RBAC is enforced at the API layer (withTeamAuth), not here
 */

import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import type { Campaign } from './campaigns';

// ============================================================================
// TEAM-SCOPED CAMPAIGN TYPE
// ============================================================================

export interface TeamCampaign extends Campaign {
  teamId?: string;
  createdBy?: string;
}

// ============================================================================
// CREATE TEAM CAMPAIGN
// ============================================================================

export async function createTeamCampaign(
  userId: string,
  teamId: string,
  data: Omit<Campaign, 'userId' | 'campaignId' | 'createdAt' | 'updatedAt'>
): Promise<TeamCampaign> {
  const client = getDynamoClient();
  const campaignId = `camp-${uuidv4()}`;
  const now = new Date().toISOString();

  const campaign: TeamCampaign = {
    ...data,
    userId,
    campaignId,
    teamId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await client.send(
    new PutCommand({
      TableName: TABLES.CAMPAIGNS,
      Item: campaign,
    })
  );

  return campaign;
}

// ============================================================================
// LIST TEAM CAMPAIGNS
// ============================================================================

/**
 * List all campaigns for a team (uses teamId-index GSI).
 * Returns newest-first, paginated.
 */
export async function listTeamCampaigns(
  teamId: string,
  limit: number = 20,
  lastKey?: Record<string, unknown>
): Promise<{ campaigns: TeamCampaign[]; lastKey?: Record<string, unknown> }> {
  const client = getDynamoClient();

  try {
    const params = {
      TableName: TABLES.CAMPAIGNS,
      IndexName: 'teamId-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: { ':teamId': teamId },
      ScanIndexForward: false,
      Limit: limit,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    };

    const result = await client.send(new QueryCommand(params));
    return {
      campaigns: (result.Items || []) as TeamCampaign[],
      lastKey: result.LastEvaluatedKey,
    };
  } catch (err) {
    // GSI may not exist yet — fall back to empty list
    logger.warn('db.teamCampaigns', 'teamId GSI query failed, returning empty', { teamId, err });
    return { campaigns: [], lastKey: undefined };
  }
}

// ============================================================================
// LIST USER + TEAM CAMPAIGNS (COMBINED)
// ============================================================================

/**
 * Get all campaigns visible to a user: personal + all team campaigns.
 * Deduplicates by campaignId.
 */
export async function listAllVisibleCampaigns(
  userId: string,
  teamIds: string[],
  limit: number = 20
): Promise<TeamCampaign[]> {
  // Fetch personal campaigns
  const { listCampaigns } = await import('./campaigns');
  const personal = await listCampaigns(userId, limit);

  // Fetch team campaigns for all teams
  const teamResults = await Promise.all(
    teamIds.map(tid => listTeamCampaigns(tid, limit))
  );

  const teamCampaigns = teamResults.flatMap(r => r.campaigns);

  // Merge + deduplicate
  const seen = new Set<string>();
  const combined: TeamCampaign[] = [];

  for (const c of [...personal.campaigns, ...teamCampaigns] as TeamCampaign[]) {
    if (!seen.has(c.campaignId)) {
      seen.add(c.campaignId);
      combined.push(c);
    }
  }

  // Sort newest first
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return combined.slice(0, limit);
}
