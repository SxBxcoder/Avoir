/**
 * Avoir — User Email Alias Repository
 *
 * Maps a Cognito `sub` to the email the account was created with, so the
 * one-time legacy migration (email-keyed rows → sub-keyed rows) can find the
 * old data without scanning tables. The email here is always the one verified
 * server-side from the Cognito ID token — never a client-supplied value.
 *
 * Table: avoir-user-aliases
 *   PK: userId (string — the Cognito sub)
 *   Attributes: email, createdAt
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';
import { logger } from '@/lib/logger';

export async function setEmailAlias(userId: string, email: string): Promise<void> {
  try {
    await getDynamoClient().send(
      new PutCommand({
        TableName: TABLES.ALIASES,
        Item: {
          userId,
          email,
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Non-fatal: the migration can be re-run on the next session refresh.
    logger.warn(`[DB] Alias write failed: ${message}`);
  }
}

/**
 * Returns the stored alias email for a sub, or null when not linked yet.
 * Failures degrade to null — the link-email route retries on next refresh.
 */
export async function getEmailAlias(userId: string): Promise<string | null> {
  try {
    const { Item } = await getDynamoClient().send(
      new GetCommand({ TableName: TABLES.ALIASES, Key: { userId } })
    );
    return typeof Item?.email === 'string' ? Item.email : null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[DB] Alias read failed: ${message}`);
    return null;
  }
}
