import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { migrateLegacyUser } from './migrateUser';

// The DynamoDB client is the only I/O boundary — command classes are inert
// data holders, so we stub the client and drive the migration through it.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: () => ({ send: sendMock }),
  TABLES: {
    USERS: 'avoir-users',
    CAMPAIGNS: 'avoir-campaigns',
    AUDIT: 'avoir-audit',
    BRAND_DNA: 'avoir-brand-dna',
    PERFORMANCE: 'avoir-performance',
    INTELLIGENCE: 'avoir-intelligence',
    COMPETITORS: 'avoir-competitors',
    ALIASES: 'avoir-user-aliases',
  },
}));

let legacyRows = new Map<string, unknown>();
let failingTable: string | null = null;

function fakeSend(command: unknown): Promise<unknown> {
  const { input } = command as { input?: { TableName?: string; Key?: Record<string, string> } };

  if (command instanceof GetCommand) {
    const row = legacyRows.get(`${input?.TableName}:${input?.Key?.userId}`);
    return Promise.resolve({ Item: row ?? undefined });
  }

  if (command instanceof QueryCommand) {
    return Promise.resolve({ Items: legacyRows.get(`${input?.TableName}:*`) ?? [], LastEvaluatedKey: undefined });
  }

  if (command instanceof PutCommand) {
    if (failingTable && input?.TableName === failingTable) {
      return Promise.reject(new Error(`Simulated DynamoDB failure on ${input?.TableName}`));
    }
    // Simulate the condition expression: a put with a userId that already has a
    // row fails, forcing the merge path (sub rows that were auto-created as
    // free-tier defaults).
    const target = (input?.Item as { userId?: string } | undefined)?.userId;
    if (target && legacyRows.has(`${input?.TableName}:${target}`)) {
      const err = new Error('The conditional request failed') as Error & { name: string };
      err.name = 'ConditionalCheckFailedException';
      return Promise.reject(err);
    }
    return Promise.resolve({});
  }

  return Promise.resolve({});
}

beforeEach(() => {
  legacyRows = new Map();
  failingTable = null;
  sendMock.mockReset();
  sendMock.mockImplementation(fakeSend);
});

describe('migrateLegacyUser', () => {
  it('reports migrated=true but complete=false when one table migration fails', async () => {
    legacyRows = new Map<string, unknown>([
      ['avoir-users:legacy@example.com', { userId: 'legacy@example.com', tier: 'pro' }],
      ['avoir-brand-dna:legacy@example.com', { brandName: 'Avoir' }],
      ['avoir-intelligence:legacy@example.com', { level: 'bronze' }],
    ]);
    failingTable = 'avoir-intelligence';

    const result = await migrateLegacyUser('sub-123', 'legacy@example.com');

    // Users and brand-dna migrated; intelligence failed; the rest had no rows.
    expect(result).toEqual({ migrated: true, complete: false });
  });

  it('reports complete=true when every table migration succeeds', async () => {
    legacyRows = new Map<string, unknown>([
      ['avoir-users:legacy@example.com', { userId: 'legacy@example.com', tier: 'pro' }],
      ['avoir-brand-dna:legacy@example.com', { brandName: 'Avoir' }],
      ['avoir-intelligence:legacy@example.com', { level: 'bronze' }],
    ]);

    const result = await migrateLegacyUser('sub-123', 'legacy@example.com');

    expect(result).toEqual({ migrated: true, complete: true });
  });

  it('is a no-op for a user with no legacy rows', async () => {
    const result = await migrateLegacyUser('sub-123', 'legacy@example.com');

    expect(result).toEqual({ migrated: false, complete: true });
  });

  it('skips migration when sub equals the email', async () => {
    const result = await migrateLegacyUser('user@example.com', 'user@example.com');

    expect(sendMock).not.toHaveBeenCalled();
    expect(result).toEqual({ migrated: false, complete: true });
  });

  it('preserves legacy attributes with non-identifier names via indexed placeholders', async () => {
    legacyRows = new Map<string, unknown>([
      ['avoir-users:sub-123', { userId: 'sub-123', tier: 'free' }],
      [
        'avoir-users:legacy@example.com',
        { userId: 'legacy@example.com', tier: 'pro', 'custom.field': 'x', 'created-at': '2024-01-01', '0th': true },
      ],
    ]);

    const result = await migrateLegacyUser('sub-123', 'legacy@example.com');

    expect(result).toEqual({ migrated: true, complete: true });

    const updateCalls = sendMock.mock.calls.filter(([c]) => c instanceof UpdateCommand);
    expect(updateCalls.length).toBe(1);
    const input = updateCalls[0][0].input;
    expect(input.UpdateExpression).toContain('#f0 = :v0');
    expect(input.ExpressionAttributeNames['#f0']).toBe('custom.field');
    expect(input.ExpressionAttributeValues[':v0']).toBe('x');
    expect(input.ExpressionAttributeNames['#f1']).toBe('created-at');
    expect(input.ExpressionAttributeNames['#f2']).toBe('0th');
  });
});
