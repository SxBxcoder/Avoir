/**
 * Avoir — Enterprise DynamoDB Client
 * 
 * Singleton client with connection pooling for serverless environments.
 * All table operations go through this module.
 * 
 * Tables:
 *   - avoir-users       → User profiles + subscription state
 *   - avoir-campaigns   → Campaign history with user isolation
 *   - avoir-audit       → Cascade tier logs and billing events
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// TABLE NAMES — Central registry
// ============================================================================

export const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'avoir-users',
  CAMPAIGNS: process.env.DYNAMODB_CAMPAIGNS_TABLE || 'avoir-campaigns',
  AUDIT: process.env.DYNAMODB_AUDIT_TABLE || 'avoir-audit',
  BRAND_DNA: process.env.DYNAMODB_BRAND_DNA_TABLE || 'avoir-brand-dna',
  PERFORMANCE: process.env.DYNAMODB_PERFORMANCE_TABLE || 'avoir-performance',
  INTELLIGENCE: process.env.DYNAMODB_INTELLIGENCE_TABLE || 'avoir-intelligence',
  COMPETITORS: process.env.DYNAMODB_COMPETITORS_TABLE || 'avoir-competitors',
} as const;

// ============================================================================
// CLIENT SINGLETON
// ============================================================================

let _client: DynamoDBDocumentClient | null = null;

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!_client) {
    const rawClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      // In production, credentials come from IAM roles automatically.
      // For local dev, use AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars.
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });

    _client = DynamoDBDocumentClient.from(rawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  return _client;
}
