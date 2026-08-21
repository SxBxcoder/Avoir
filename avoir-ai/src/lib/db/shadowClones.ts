/**
 * Avoir — Shadow Clone Repository
 *
 * Stores generated Shadow Clone video metadata in DynamoDB.
 * Table: avoir-shadow-clones
 *   PK: userId
 *   SK: videoId
 */

import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { logger } from '@/lib/logger';
import type { ShadowCloneRecord } from '@/lib/types/shadowClone';

// ============================================================================
// WRITE — Save Shadow Clone record
// ============================================================================

export async function saveShadowClone(record: ShadowCloneRecord): Promise<void> {
  const client = getDynamoClient();

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.SHADOW_CLONES,
        Item: {
          userId: record.userId,
          videoId: record.videoId,
          campaignId: record.campaignId,
          script: record.script,
          imageUrl: record.imageUrl,
          videoUrl: record.videoUrl,
          elevenLabsVoiceId: record.elevenLabsVoiceId,
          heygenAvatarId: record.heygenAvatarId,
          createdAt: record.createdAt,
        },
      })
    );
    logger.info('db.shadowClones', 'Saved record', { userId: record.userId, videoId: record.videoId });
  } catch (err) {
    logger.error('db.shadowClones', 'Save failed', { err });
  }
}

// ============================================================================
// READ — Get Shadow Clones for a user
// ============================================================================

export async function getShadowClones(
  userId: string,
  limit = 10
): Promise<ShadowCloneRecord[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.SHADOW_CLONES,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );

    return (result.Items as ShadowCloneRecord[]) || [];
  } catch (err) {
    logger.error('db.shadowClones', 'Query failed', { err });
    return [];
  }
}
