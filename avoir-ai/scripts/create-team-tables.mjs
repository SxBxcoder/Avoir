/**
 * Avoir — Team Tables Provisioning Script
 *
 * Run this ONCE to create the team collaboration DynamoDB tables:
 *   node scripts/create-team-tables.mjs
 *
 * Tables created:
 *   1. avoir-teams         — Team workspaces (PK: teamId)
 *   2. avoir-team-members  — Team membership (PK: teamId, SK: userId)
 *                            GSI: userId-index (PK: userId) for "get all teams for a user"
 *   3. avoir-invitations   — Pending invitations (PK: token)
 *                            GSI: teamId-index (PK: teamId) for "list invitations for a team"
 *                            TTL attribute: expiresAt
 *   4. avoir-push-subscriptions — Push notification subscriptions (PK: userId, SK: endpoint)
 *                                 GSI: teamId-index (PK: teamId) for team-wide broadcast
 *
 * GSIs added to existing tables:
 *   - avoir-campaigns: teamId-createdAt-index (PK: teamId, SK: createdAt)
 *   - avoir-brand-dna: teamId-index (PK: teamId)
 *
 * Prerequisites:
 *   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment
 *   - AWS_REGION defaults to us-east-1
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTableCommand,
  DescribeGlobalSecondaryIndexCommand,
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const TEAM_TABLES = [
  {
    TableName: 'avoir-teams',
    KeySchema: [
      { AttributeName: 'teamId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'avoir-team-members',
    KeySchema: [
      { AttributeName: 'teamId', KeyType: 'HASH' },
      { AttributeName: 'userId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'avoir-invitations',
    KeySchema: [
      { AttributeName: 'token', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'token', AttributeType: 'S' },
      { AttributeName: 'teamId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'teamId-index',
        KeySchema: [
          { AttributeName: 'teamId', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'avoir-push-subscriptions',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'endpoint', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'endpoint', AttributeType: 'S' },
      { AttributeName: 'teamId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'teamId-index',
        KeySchema: [
          { AttributeName: 'teamId', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

const GSI_UPDATES = [
  {
    tableName: 'avoir-campaigns',
    gsi: {
      IndexName: 'teamId-createdAt-index',
      KeySchema: [
        { AttributeName: 'teamId', KeyType: 'HASH' },
        { AttributeName: 'createdAt', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    attributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
  },
  {
    tableName: 'avoir-brand-dna',
    gsi: {
      IndexName: 'teamId-index',
      KeySchema: [
        { AttributeName: 'teamId', KeyType: 'HASH' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    attributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
    ],
  },
  {
    tableName: 'avoir-audit',
    gsi: {
      IndexName: 'teamId-createdAt-index',
      KeySchema: [
        { AttributeName: 'teamId', KeyType: 'HASH' },
        { AttributeName: 'createdAt', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    attributeDefinitions: [
      { AttributeName: 'teamId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
  },
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function gsiExists(tableName, indexName) {
  try {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    return (desc.Table?.GlobalSecondaryIndexes || []).some(g => g.IndexName === indexName);
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 Avoir — Team Table Provisioning');
  console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log('');

  // Create new team tables
  for (const table of TEAM_TABLES) {
    const exists = await tableExists(table.TableName);

    if (exists) {
      console.log(`   ✅ ${table.TableName} — Already exists`);
      continue;
    }

    try {
      await client.send(new CreateTableCommand(table));
      console.log(`   🔨 ${table.TableName} — Created (PAY_PER_REQUEST)`);
    } catch (err) {
      console.error(`   ❌ ${table.TableName} — Failed: ${err.message}`);
    }
  }

  // Add GSIs to existing tables
  console.log('');
  console.log('   Adding GSIs to existing tables...');

  for (const update of GSI_UPDATES) {
    const exists = await tableExists(update.tableName);
    if (!exists) {
      console.log(`   ⚠️  ${update.tableName} — Does not exist, skipping GSI`);
      continue;
    }

    const hasGSI = await gsiExists(update.tableName, update.gsi.IndexName);
    if (hasGSI) {
      console.log(`   ✅ ${update.tableName}/${update.gsi.IndexName} — Already exists`);
      continue;
    }

    try {
      // First, we need to add the attribute definitions to the table
      // DynamoDB requires all indexed attributes to be in AttributeDefinitions
      const desc = await client.send(new DescribeTableCommand({ TableName: update.tableName }));
      const existingAttrs = desc.Table?.AttributeDefinitions || [];
      const newAttrs = update.attributeDefinitions.filter(
        newA => !existingAttrs.some(eA => eA.AttributeName === newA.AttributeName)
      );

      if (newAttrs.length > 0) {
        await client.send(new UpdateTableCommand({
          TableName: update.tableName,
          AttributeDefinitions: [...existingAttrs, ...newAttrs],
          GlobalSecondaryIndexUpdates: [
            { Create: update.gsi },
          ],
        }));
      } else {
        await client.send(new UpdateTableCommand({
          TableName: update.tableName,
          GlobalSecondaryIndexUpdates: [
            { Create: update.gsi },
          ],
        }));
      }
      console.log(`   🔨 ${update.tableName}/${update.gsi.IndexName} — GSI created`);
    } catch (err) {
      console.error(`   ❌ ${update.tableName}/${update.gsi.IndexName} — Failed: ${err.message}`);
    }
  }

  console.log('');
  console.log('✅ Team table provisioning complete.');
  console.log('   Add these to your .env.local:');
  console.log('   DYNAMODB_TEAMS_TABLE=avoir-teams');
  console.log('   DYNAMODB_TEAM_MEMBERS_TABLE=avoir-team-members');
  console.log('   DYNAMODB_INVITATIONS_TABLE=avoir-invitations');
  console.log('   DYNAMODB_PUSH_SUBSCRIPTIONS_TABLE=avoir-push-subscriptions');
}

main().catch(console.error);
