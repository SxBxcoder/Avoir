/**
 * Avoir — Competitor Intelligence Health Check
 *
 * GET /api/competitors/health — Verify Facebook Ad Library connectivity
 *
 * Returns:
 *   - tokenConfigured: whether FACEBOOK_ACCESS_TOKEN is set
 *   - tokenValid: whether the token can authenticate against the Graph API
 *   - cacheStatus: whether DynamoDB cache table is reachable
 *   - timestamp: current ISO timestamp
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = {
    tokenConfigured: false,
    tokenValid: false,
    cacheStatus: 'unknown' as 'ok' | 'error' | 'unknown',
    timestamp: new Date().toISOString(),
  };

  // 1. Check if token is configured
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  result.tokenConfigured = !!token;

  // 2. Validate token against Graph API (lightweight debug_token call)
  if (token) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      result.tokenValid = !!(data as any).data?.is_valid;
    } catch {
      result.tokenValid = false;
    }
  }

  // 3. Check DynamoDB cache table connectivity
  try {
    const { getDynamoClient, TABLES } = await import('@/lib/db/dynamodb');
    const client = getDynamoClient();
    const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
    await client.send(new DescribeTableCommand({ TableName: TABLES.COMPETITORS }));
    result.cacheStatus = 'ok';
  } catch {
    result.cacheStatus = 'error';
  }

  const status = result.tokenValid && result.cacheStatus === 'ok' ? 200 : 503;

  logger.info('competitors-health', 'Health check', {
    tokenConfigured: result.tokenConfigured,
    tokenValid: result.tokenValid,
    cacheStatus: result.cacheStatus,
  });

  return NextResponse.json(result, { status });
}
