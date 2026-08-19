/**
 * Avoir — Ad Account Repository
 *
 * Maps users to their linked Meta Ads / Google Ads accounts.
 * Used by webhook handlers to scope incoming callbacks to the correct user,
 * and by the frontend to show connected ad platforms.
 *
 * Table: avoir-ad-accounts
 *   PK: userId (string)
 *   SK: platformAccountId (string — "{platform}:{accountId}", e.g. "meta:123456")
 */

import { PutCommand, QueryCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type AdPlatform = 'meta' | 'google';

export interface AdAccount {
  userId: string;
  /** Composite key: "{platform}:{accountId}" — e.g. "meta:act_123456" */
  platformAccountId: string;
  platform: AdPlatform;
  /** Platform-specific account ID (e.g. Meta Business Account ID). */
  accountId: string;
  /** Human-readable account name from the platform. */
  accountName: string;
  /** Encrypted access token for server-side API calls (optional). */
  accessToken?: string;
  linkedAt: string;
  lastSyncAt?: string;
}

// ============================================================================
// CREATE — Link an ad account
// ============================================================================

export async function linkAdAccount(
  userId: string,
  platform: AdPlatform,
  accountId: string,
  accountName: string,
  accessToken?: string
): Promise<AdAccount> {
  const client = getDynamoClient();
  const now = new Date().toISOString();
  const platformAccountId = `${platform}:${accountId}`;

  const account: AdAccount = {
    userId,
    platformAccountId,
    platform,
    accountId,
    accountName,
    accessToken,
    linkedAt: now,
  };

  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.AD_ACCOUNTS,
        Item: account,
      })
    );
  } catch (err: unknown) {
    logger.error('db.adAccounts', 'Link failed', { err });
  }

  return account;
}

// ============================================================================
// READ — Get a single linked account
// ============================================================================

export async function getAdAccount(
  userId: string,
  platformAccountId: string
): Promise<AdAccount | null> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.AD_ACCOUNTS,
        Key: { userId, platformAccountId },
      })
    );

    return (result.Item as AdAccount) || null;
  } catch (err: unknown) {
    logger.error('db.adAccounts', 'Get failed', { err });
    return null;
  }
}

// ============================================================================
// READ — List all linked accounts for a user
// ============================================================================

export async function getLinkedAccounts(userId: string): Promise<AdAccount[]> {
  const client = getDynamoClient();

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.AD_ACCOUNTS,
        KeyConditionExpression: '#uid = :uid',
        ExpressionAttributeNames: { '#uid': 'userId' },
        ExpressionAttributeValues: { ':uid': userId },
      })
    );

    return (result.Items as AdAccount[]) || [];
  } catch (err: unknown) {
    logger.error('db.adAccounts', 'List failed', { err });
    return [];
  }
}

// ============================================================================
// READ — Find account by platform (first match)
// ============================================================================

export async function getLinkedAccountByPlatform(
  userId: string,
  platform: AdPlatform
): Promise<AdAccount | null> {
  const accounts = await getLinkedAccounts(userId);
  return accounts.find((a) => a.platform === platform) || null;
}

// ============================================================================
// UPDATE — Touch lastSyncAt after a successful webhook ingestion
// ============================================================================

export async function touchLastSyncAt(
  userId: string,
  platformAccountId: string
): Promise<void> {
  const client = getDynamoClient();
  const now = new Date().toISOString();

  try {
    const existing = await getAdAccount(userId, platformAccountId);
    if (!existing) return;

    existing.lastSyncAt = now;

    await client.send(
      new PutCommand({
        TableName: TABLES.AD_ACCOUNTS,
        Item: existing,
      })
    );
  } catch (err: unknown) {
    logger.error('db.adAccounts', 'Sync touch failed', { err });
  }
}

// ============================================================================
// DELETE — Unlink an ad account
// ============================================================================

export async function unlinkAdAccount(
  userId: string,
  platformAccountId: string
): Promise<boolean> {
  const client = getDynamoClient();

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLES.AD_ACCOUNTS,
        Key: { userId, platformAccountId },
      })
    );
    return true;
  } catch (err: unknown) {
    logger.error('db.adAccounts', 'Unlink failed', { err });
    return false;
  }
}

// ============================================================================
// LOOKUP USER BY PLATFORM ACCOUNT — For webhook handlers
// ============================================================================

/**
 * Given a platform + account ID from a webhook callback, find the userId
 * that linked this account. Scans the ad-accounts table.
 */
export async function findUserByPlatformAccount(
  platform: AdPlatform,
  accountId: string
): Promise<string | null> {
  const client = getDynamoClient();
  const platformAccountId = `${platform}:${accountId}`;

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLES.AD_ACCOUNTS,
        IndexName: 'PlatformAccountIdIndex',
        KeyConditionExpression: '#paid = :paid',
        ExpressionAttributeNames: { '#paid': 'platformAccountId' },
        ExpressionAttributeValues: { ':paid': platformAccountId },
        Limit: 1,
      })
    );

    const item = result.Items?.[0] as AdAccount | undefined;
    return item?.userId || null;
  } catch (err: unknown) {
    // Table may not have a GSI — fall back to scan
    logger.warn('db.adAccounts', 'GSI query failed, trying scan', { err });

    try {
      const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
      const scanResult = await client.send(
        new ScanCommand({
          TableName: TABLES.AD_ACCOUNTS,
          FilterExpression: '#paid = :paid',
          ExpressionAttributeNames: { '#paid': 'platformAccountId' },
          ExpressionAttributeValues: { ':paid': platformAccountId },
          Limit: 1,
        })
      );

      const item = scanResult.Items?.[0] as AdAccount | undefined;
      return item?.userId || null;
    } catch {
      return null;
    }
  }
}
