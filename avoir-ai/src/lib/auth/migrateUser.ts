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

import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from '@/lib/db/dynamodb';

type DynamoItem = Record<string, NativeAttributeValue>;

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

function isNonEmptyEmail(email: string): boolean {
  return typeof email === 'string' && email.length > 0 && email.includes('@') && email.length <= 254;
}

function isConditionalCheckFailed(err: unknown): boolean {
  return err instanceof Error && err.name === 'ConditionalCheckFailedException';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// DynamoDB attribute names are substituted via ExpressionAttributeNames, but a
// name containing `#` or `:` would still break the generated expression.
function isSafeExpressionField(field: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(field);
}

async function queryAllByUser(table: string, userId: string): Promise<DynamoItem[]> {
  const client = getDynamoClient();
  const items: DynamoItem[] = [];
  let lastKey: DynamoItem | undefined;

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
    lastKey = result.LastEvaluatedKey as DynamoItem | undefined;
  } while (lastKey);

  return items;
}

async function migrateUsers(sub: string, email: string): Promise<boolean> {
  const client = getDynamoClient();
  const legacy = await client.send(
    new GetCommand({ TableName: TABLES.USERS, Key: { userId: email } })
  );
  if (!legacy.Item) return false;
  const legacyItem: DynamoItem = legacy.Item;

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
  } catch (err: unknown) {
    if (!isConditionalCheckFailed(err)) throw err;
  }

  if (!claimed) {
    // The sub row already exists (auto-created free-tier default). Merge every
    // legacy attribute that is ABSENT on the sub row — a fixed allowlist would
    // silently drop attributes (createdAt, onboarding state, future schema
    // fields) right before the legacy row is deleted.
    const existing = await client.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { userId: sub } })
    );
    const existingItem: DynamoItem = existing.Item || {};

    const parts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, NativeAttributeValue> = {};
    for (const [field, value] of Object.entries(legacyItem)) {
      if (field === 'userId' || existingItem[field] !== undefined) continue;
      if (!isSafeExpressionField(field)) continue;
      parts.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = value;
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
  } catch (err: unknown) {
    if (!isConditionalCheckFailed(err)) throw err;
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
    const legacyKey: DynamoItem = { userId: email, [sortKey]: item[sortKey] };
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
    } catch (err: unknown) {
      if (!isConditionalCheckFailed(err)) throw err;
    }
  }

  return copied > 0;
}

export interface MigrationResult {
  /** True when at least one legacy record was moved under the sub. */
  migrated: boolean;
  /** True when every table was processed without error. */
  complete: boolean;
}

/**
 * Re-key all legacy data for a user from `email` to the Cognito `sub`.
 *
 * Returns `migrated` (any rows moved) and `complete` (no table threw). A
 * partial failure never throws — the failing table is logged, the rest still
 * run, and `complete: false` tells the caller to stay retry-eligible.
 */
export async function migrateLegacyUser(sub: string, email: string): Promise<MigrationResult> {
  if (!sub || !isNonEmptyEmail(email) || sub === email) return { migrated: false, complete: true };

  let migrated = false;
  let complete = true;

  try {
    migrated = (await migrateUsers(sub, email)) || migrated;
  } catch (err: unknown) {
    complete = false;
    console.error(`[Migrate] users failed for ${sub}: ${errorMessage(err)}`);
  }

  for (const { table } of SINGLE_KEY_TABLES) {
    try {
      migrated = (await migrateSingleKey(table, sub, email)) || migrated;
    } catch (err: unknown) {
      complete = false;
      console.error(`[Migrate] ${table} failed for ${sub}: ${errorMessage(err)}`);
    }
  }

  for (const { table, sortKey } of COMPOSITE_KEY_TABLES) {
    try {
      migrated = (await migrateCompositeKey(table, sortKey, sub, email)) || migrated;
    } catch (err: unknown) {
      complete = false;
      console.error(`[Migrate] ${table} failed for ${sub}: ${errorMessage(err)}`);
    }
  }

  return { migrated, complete };
}
