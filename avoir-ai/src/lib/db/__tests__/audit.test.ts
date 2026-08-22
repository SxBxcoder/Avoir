import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { logAuditEvent } from '../teams';

const { sendMock, loggerMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  loggerMock: { error: vi.fn() },
}));

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: () => ({ send: sendMock }),
  TABLES: { AUDIT: 'avoir-audit' },
}));

vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({});
});

describe('logAuditEvent', () => {
  it('writes team-scoped entries with the teamId attribute', async () => {
    await logAuditEvent('team-1', 'user-1', 'team.created', { teamName: 'Acme' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command.input.TableName).toBe('avoir-audit');
    const item = command.input.Item as Record<string, unknown>;
    expect(item.teamId).toBe('team-1');
    expect(item.userId).toBe('user-1');
    expect(item.action).toBe('team.created');
    expect(item.details).toEqual({ teamName: 'Acme' });
    expect(item.logId).toBeTruthy();
    expect(typeof item.ttl).toBe('number');
  });

  it('omits the teamId attribute for user-scoped (null) events', async () => {
    await logAuditEvent(null, 'user-1', 'billing.checkout_completed', {
      tier: 'pro',
      creditsAdded: 1000,
    });

    const item = (sendMock.mock.calls[0][0] as PutCommand).input.Item as Record<string, unknown>;
    expect('teamId' in item).toBe(false);
    expect(item.action).toBe('billing.checkout_completed');
    expect(item.details).toEqual({ tier: 'pro', creditsAdded: 1000 });
  });

  it('defaults details to an empty object', async () => {
    await logAuditEvent(null, 'user-1', 'cascade.tier_transition');

    const item = (sendMock.mock.calls[0][0] as PutCommand).input.Item as Record<string, unknown>;
    expect(item.details).toEqual({});
  });

  it('swallows write failures and logs loudly instead of throwing', async () => {
    sendMock.mockRejectedValue(new Error('ProvisionedThroughputExceeded'));

    await expect(
      logAuditEvent(null, 'user-1', 'billing.payment_failed')
    ).resolves.toBeUndefined();

    expect(loggerMock.error).toHaveBeenCalledWith(
      'db.teams',
      'Audit log write failed',
      expect.objectContaining({ userId: 'user-1', action: 'billing.payment_failed' })
    );
  });
});
