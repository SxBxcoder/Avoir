/**
 * Prachar.ai — Enterprise Campaign Repository
 * 
 * DynamoDB-backed campaign storage with user isolation.
 * 
 * Table: prachar-campaigns
 *   PK: userId (string)
 *   SK: campaignId (string — UUID)
 *   Attributes: goal, plan, captions, imageUrl, messages, tier, status,
 *               createdAt, updatedAt, ttl
 */

import { PutCommand, QueryCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface Campaign {
  userId: string;
  campaignId: string;
  goal: string;
  plan: {
    hook: string;
    offer: string;
    cta: string;
  };
  captions: string[];
  imageUrl: string;
  messages: Array<{ role: string; content: string; displayContent?: string }>;
  tier: string;       // Which Diamond Cascade tier was used
  status: string;     // 'completed' | 'failed' | 'pending'
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createCampaign(
  userId: string,
  data: Omit<Campaign, 'userId' | 'campaignId' | 'createdAt' | 'updatedAt'>
): Promise<Campaign> {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  const campaign: Campaign = {
    userId,
    campaignId: uuidv4(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.CAMPAIGNS,
        Item: campaign,
      })
    );
  } catch (err: any) {
    console.error(`[DB] Campaign create failed: ${err.message}`);
  }

  return campaign;
}

// ============================================================================
// READ (Single)
// ============================================================================

export async function getCampaign(
  userId: string,
  campaignId: string
): Promise<Campaign | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.CAMPAIGNS,
        Key: { userId, campaignId },
      })
    );

    return (result.Item as Campaign) || null;
  } catch (err: any) {
    console.error(`[DB] Campaign get failed: ${err.message}`);
    return null;
  }
}

// ============================================================================
// LIST (By User — paginated)
// ============================================================================

export async function listCampaigns(
  userId: string,
  limit: number = 20,
  lastKey?: Record<string, any>
): Promise<{ campaigns: Campaign[]; lastKey?: Record<string, any> }> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.CAMPAIGNS,
        KeyConditionExpression: '#uid = :uid',
        ExpressionAttributeNames: { '#uid': 'userId' },
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false, // Newest first
        Limit: limit,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );

    return {
      campaigns: (result.Items as Campaign[]) || [],
      lastKey: result.LastEvaluatedKey,
    };
  } catch (err: any) {
    console.error(`[DB] Campaign list failed: ${err.message}`);
    return { campaigns: [] };
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteCampaign(userId: string, campaignId: string): Promise<boolean> {
  const client = getDynamoClient();

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLES.CAMPAIGNS,
        Key: { userId, campaignId },
      })
    );
    return true;
  } catch (err: any) {
    console.error(`[DB] Campaign delete failed: ${err.message}`);
    return false;
  }
}
