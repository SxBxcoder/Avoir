/**
 * Avoir — DynamoDB Table Provisioning Script
 * 
 * Run this ONCE to create the required DynamoDB tables:
 *   node scripts/create-tables.mjs
 * 
 * Tables created:
 *   1. avoir-users     — User subscriptions (PK: userId)
 *   2. avoir-campaigns — Campaign history (PK: userId, SK: campaignId)
 *   3. avoir-audit     — Audit logs (PK: userId, SK: logId)
 * 
 * Prerequisites:
 *   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment
 *   - AWS_REGION defaults to us-east-1
 */

import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const TABLES = [
  {
    TableName: 'avoir-users',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST', // Serverless — scales to zero
  },
  {
    TableName: 'avoir-campaigns',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'campaignId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'campaignId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'avoir-audit',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'logId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'logId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
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

async function main() {
  console.log('🚀 Avoir — DynamoDB Table Provisioning');
  console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log('');

  for (const table of TABLES) {
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

  console.log('');
  console.log('✅ Table provisioning complete.');
  console.log('   Add these to your .env.local:');
  console.log('   DYNAMODB_USERS_TABLE=avoir-users');
  console.log('   DYNAMODB_CAMPAIGNS_TABLE=avoir-campaigns');
  console.log('   DYNAMODB_AUDIT_TABLE=avoir-audit');
}

main().catch(console.error);
