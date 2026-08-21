/**
 * Avoir — Team-Scoped Brand DNA
 *
 * Brand DNA profiles are shared within a team workspace.
 * All members can read; admin/owner can update.
 *
 * Uses the brand-dna table with the teamId-index GSI.
 * The `teamId` field on Brand DNA items is optional — personal Brand DNA
 * (no teamId) continues to work unchanged.
 */

import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamBrandDNA {
  teamId: string;
  profileId: string;    // 'default' or custom name
  brandName: string;
  personality: string[];
  toneOfVoice: string;
  targetAudience: string;
  colors: string[];
  fonts: string[];
  values: string[];
  competitors: string[];
  lastEditedBy?: string;
  lastEditedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GET TEAM BRAND DNA
// ============================================================================

/**
 * Get the default Brand DNA for a team.
 * Falls back to a new empty profile if none exists.
 */
export async function getTeamBrandDNA(teamId: string): Promise<TeamBrandDNA> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.BRAND_DNA,
        Key: { teamId, profileId: 'default' },
      })
    );

    if (result.Item) {
      return result.Item as TeamBrandDNA;
    }
  } catch (err) {
    logger.error('db.teamBrandDna', 'Failed to get team Brand DNA', { teamId, err });
  }

  // Return empty default profile
  return createEmptyProfile(teamId);
}

// ============================================================================
// SAVE TEAM BRAND DNA
// ============================================================================

/**
 * Save (create or update) the team's Brand DNA profile.
 */
export async function saveTeamBrandDNA(
  teamId: string,
  userId: string,
  data: Partial<TeamBrandDNA>
): Promise<TeamBrandDNA> {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  const existing = await getTeamBrandDNA(teamId);

  const merged: TeamBrandDNA = {
    ...existing,
    ...data,
    teamId,
    profileId: 'default',
    lastEditedBy: userId,
    lastEditedAt: now,
    updatedAt: now,
    createdAt: existing.createdAt || now,
  };

  await client.send(
    new PutCommand({
      TableName: TABLES.BRAND_DNA,
      Item: merged,
    })
  );

  return merged;
}

// ============================================================================
// LIST TEAM BRAND DNA PROFILES
// ============================================================================

/**
 * List all Brand DNA profiles for a team (supports multiple profiles).
 * Uses the teamId-index GSI.
 */
export async function listTeamBrandDNAProfiles(teamId: string): Promise<TeamBrandDNA[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.BRAND_DNA,
        IndexName: 'teamId-index',
        KeyConditionExpression: 'teamId = :teamId',
        ExpressionAttributeValues: { ':teamId': teamId },
      })
    );

    return (result.Items || []) as TeamBrandDNA[];
  } catch (err) {
    logger.warn('db.teamBrandDna', 'teamId GSI query failed', { teamId, err });
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyProfile(teamId: string): TeamBrandDNA {
  const now = new Date().toISOString();
  return {
    teamId,
    profileId: 'default',
    brandName: '',
    personality: [],
    toneOfVoice: '',
    targetAudience: '',
    colors: [],
    fonts: [],
    values: [],
    competitors: [],
    createdAt: now,
    updatedAt: now,
  };
}
