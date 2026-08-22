/**
 * Avoir — Competitor Cache Smoke Test
 *
 * Verifies the live DynamoDB connection for the avoir-competitors table
 * WITHOUT needing Facebook credentials or a logged-in user.
 *
 *   node scripts/smoke-competitors.mjs
 *
 * What it does (against the real table):
 *   1. PutItem  — writes a marker entry under industry "__smoke_test"
 *   2. GetItem  — reads it back through the same key shape the app uses
 *   3. Asserts  — TTL field is ~24h in the future, cacheKey is country-scoped
 *   4. DeleteItem — cleans up after itself
 *
 * Output: structured JSON lines (same format as src/lib/logger.ts), so runs
 * stay queryable if piped into CloudWatch/Datadog. Set LOG_LEVEL=debug for
 * more detail.
 *
 * Prerequisites:
 *   - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or an IAM role) in env
 *   - AWS_REGION matching where the table lives (default us-east-1)
 *   - DYNAMODB_COMPETITORS_TABLE (default avoir-competitors)
 *   - IAM permissions: dynamodb:PutItem, GetItem, DeleteItem on the table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './lib/logger.mjs';

const SCOPE = 'smoke-competitors';
const TABLE = process.env.DYNAMODB_COMPETITORS_TABLE || 'avoir-competitors';
const INDUSTRY = '__smoke_test';
const COUNTRY = 'US';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  }),
  { marshallOptions: { removeUndefinedValues: true } }
);

let failures = 0;

function step(name, ok, detail = '') {
  if (!ok) failures++;
  logger.info(SCOPE, `${ok ? 'PASS' : 'FAIL'}: ${name}`, detail ? { detail } : undefined);
}

async function main() {
  logger.info(SCOPE, 'Starting competitor cache smoke test', {
    table: TABLE,
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const item = {
    industry: INDUSTRY,
    cacheKey: `latest:${COUNTRY}`,
    ads: [],
    marketGaps: ['smoke test entry — safe to delete'],
    source: 'facebook',
    fetchedAt: new Date().toISOString(),
    ttl,
    searchTerms: '__smoke_test',
    country: COUNTRY,
  };

  // 1. WRITE
  try {
    await client.send(new PutCommand({ TableName: TABLE, Item: item }));
    step('PutItem', true, `${INDUSTRY} / latest:${COUNTRY}`);
  } catch (err) {
    step('PutItem', false, err.message);
    logger.error(SCOPE, 'Smoke test aborted — check credentials/IAM and that the table exists');
    process.exit(1);
  }

  // 2. READ
  let read = null;
  try {
    const result = await client.send(
      new GetCommand({ TableName: TABLE, Key: { industry: INDUSTRY, cacheKey: `latest:${COUNTRY}` } })
    );
    read = result.Item ?? null;
    step('GetItem', !!read, read ? 'item found' : 'item NOT found');
  } catch (err) {
    step('GetItem', false, err.message);
  }

  // 3. ASSERT shape matches what competitorCache.ts reads/writes
  if (read) {
    step('cacheKey is country-scoped', read.cacheKey === `latest:${COUNTRY}`, `got "${read.cacheKey}"`);
    const ttlOk = typeof read.ttl === 'number' && read.ttl > Date.now() / 1000 + 23 * 60 * 60;
    step('ttl ≈ now + 24h', ttlOk, `got ${read.ttl}`);
    step('country stored', read.country === COUNTRY, `got "${read.country}"`);
  } else {
    failures++;
  }

  // 4. CLEANUP
  try {
    await client.send(
      new DeleteCommand({ TableName: TABLE, Key: { industry: INDUSTRY, cacheKey: `latest:${COUNTRY}` } })
    );
    step('DeleteItem (cleanup)', true);
  } catch (err) {
    step('DeleteItem (cleanup)', false, err.message);
  }

  if (failures === 0) {
    logger.info(SCOPE, 'Smoke test passed — competitors table is wired correctly');
    logger.info(SCOPE, 'API can read/write this cache once FACEBOOK_ACCESS_TOKEN is set');
  } else {
    logger.error(SCOPE, `Smoke test failed with ${failures} problem(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(SCOPE, 'Unexpected failure', { error: err });
  process.exit(1);
});
