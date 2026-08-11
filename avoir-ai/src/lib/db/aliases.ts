/**
 * Avoir — User Email Alias Repository
 *
 * Maps a Cognito `sub` to the email the account was created with, so the
 * one-time legacy migration (email-keyed rows → sub-keyed rows) can find the
 * old data without scanning tables.
 *
 * Table: avoir-user-aliases
 *   PK: userId (string — the Cognito sub)
 *   Attributes: email, createdAt
 */

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';

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
  } catch (err: any) {
    // Non-fatal: the migration can be re-run on the next session refresh.
    console.warn(`[DB] Alias write failed for ${userId}: ${err.message}`);
  }
}
