/**
 * Avoir — Legacy user-data migration (email → Cognito sub).
 *
 * Before the IDOR fix, every DynamoDB row was keyed by the user's email.
 * `requireUser` now derives identity from the Cognito `sub`, so legacy rows
 * must be re-keyed under the sub once per user. This runs lazily from the
 * /api/auth/link-email route on the first authenticated session after deploy.
 *
 * It is idempotent: every copy is guarded by `attribute_not_exists`, and a
 * legacy row is only deleted after its sub-keyed copy succeeded.
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from '@/lib/db/dynamodb';

// Single-partition-key tables (PK: userId)
const SINGLE_KEY_TABLES = [
  { table: TABLES.BRAND_DNA },
  { table: TABLES.INTELLIGENCE },
] as const;

// Composite-key tables (PK: userId, SK: campaignId)
const COMPOSITE_KEY_TABLES = [
  { table: TABLES.CAMPAIGNS, sortKey: 'campaignId' },
  { table: TABLES.PERFORMANCE, sortKey: 'campaignId' },
] as const;

// Fields merged when the sub-keyed users row already exists (it can only be
// the auto-created free-tier default from getSubscription at this point, so
// the legacy values are authoritative).
const USER_MERGE_FIELDS = [
  'tier',
  'status',
  'credits',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'currentPeriodEnd',
  'cancelAtPeriodEnd',
  'campaignsUsedThisMonth',
  'lastResetDate',
] as const;

function isNonEmptyEmail(email: string): boolean {
  return typeof email === 'string' && email.length > 0 && email.includes('@') && email.length <= 254;
}

async function queryAllByUser(table: string, userId: string): Promise<Record<string, any>[]> {
  const client = getDynamoClient();
  const items: Record<string, any>[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: '#uid = :uid',
        ExpressionAttributeNames: { '#uid': 'userId' },
        ExpressionAttributeValues: { ':uid': userId },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function migrateUsers(sub: string, email: string): Promise<boolean> {
  const client = getDynamoClient();
  const legacy = await client.send(
    new GetCommand({ TableName: TABLES.USERS, Key: { userId: email } })
  );
  if (!legacy.Item) return false;
  const legacyItem = legacy.Item;

  const now = new Date().toISOString();
  let claimed = false;
  try {
    await client.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: { ...legacyItem, userId: sub, updatedAt: now },
        ConditionExpression: 'attribute_not_exists(userId)',
      })
    );
    claimed = true;
  } catch (err: any) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
  }

  if (!claimed) {
    // Sub row already exists (auto-created default) — merge legacy fields.
    const parts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    for (const field of USER_MERGE_FIELDS) {
      if (legacyItem[field] !== undefined) {
        parts.push(`#${field} = :${field}`);
        names[`#${field}`] = field;
        values[`:${field}`] = legacyItem[field];
      }
    }
    if (parts.length > 0) {
      await client.send(
        new UpdateCommand({
          TableName: TABLES.USERS,
          Key: { userId: sub },
          UpdateExpression: `SET ${parts.join(', ')}, #u = :u`,
          ExpressionAttributeNames: { ...names, '#u': 'updatedAt' },
          ExpressionAttributeValues: { ...values, ':u': now },
        })
      );
    }
  }

  await client.send(new DeleteCommand({ TableName: TABLES.USERS, Key: { userId: email } }));
  return true;
}

async function migrateSingleKey(table: string, sub: string, email: string): Promise<boolean> {
  const client = getDynamoClient();
  const legacy = await client.send(
    new GetCommand({ TableName: table, Key: { userId: email } })
  );
  if (!legacy.Item) return false;

  try {
    await client.send(
      new PutCommand({
        TableName: table,
        Item: { ...legacy.Item, userId: sub },
        ConditionExpression: 'attribute_not_exists(userId)',
      })
    );
  } catch (err: any) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    return false; // Already migrated; keep the legacy row untouched.
  }

  await client.send(new DeleteCommand({ TableName: table, Key: { userId: email } }));
  return true;
}

async function migrateCompositeKey(
  table: string,
  sortKey: string,
  sub: string,
  email: string
): Promise<boolean> {
  const client = getDynamoClient();
  const items = await queryAllByUser(table, email);
  if (items.length === 0) return false;

  let copied = 0;
  for (const item of items) {
    const legacyKey = { userId: email, [sortKey]: item[sortKey] };
    try {
      await client.send(
        new PutCommand({
          TableName: table,
          Item: { ...item, userId: sub },
          ConditionExpression: `attribute_not_exists(userId) AND attribute_not_exists(${sortKey})`,
        })
      );
      await client.send(new DeleteCommand({ TableName: table, Key: legacyKey }));
      copied++;
    } catch (err: any) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }

  return copied > 0;
}

/**
 * Re-key all legacy data for a user from `email` to the Cognito `sub`.
 *
 * Returns true when anything was migrated. Never throws across tables — a
 * failure in one table is logged and the rest still run, and the whole thing
 * is retried on the next session refresh.
 */
export async function migrateLegacyUser(sub: string, email: string): Promise<boolean> {
  if (!sub || !isNonEmptyEmail(email) || sub === email) return false;

  let migrated = false;

  try {
    migrated = (await migrateUsers(sub, email)) || migrated;
  } catch (err: any) {
    console.error(`[Migrate] users failed for ${sub}: ${err.message}`);
  }

  for (const { table } of SINGLE_KEY_TABLES) {
    try {
      migrated = (await migrateSingleKey(table, sub, email)) || migrated;
    } catch (err: any) {
      console.error(`[Migrate] ${table} failed for ${sub}: ${err.message}`);
    }
  }

  for (const { table, sortKey } of COMPOSITE_KEY_TABLES) {
    try {
      migrated = (await migrateCompositeKey(table, sortKey, sub, email)) || migrated;
    } catch (err: any) {
      console.error(`[Migrate] ${table} failed for ${sub}: ${err.message}`);
    }
  }

  return migrated;
}
