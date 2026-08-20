import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PushSubscriptionRecord } from '@/lib/push/types';

const mockSend = vi.fn();
const mockGetCommand = vi.fn();
const mockPutCommand = vi.fn();
const mockDeleteCommand = vi.fn();
const mockQueryCommand = vi.fn();

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: () => ({
    send: mockSend,
  }),
  TABLES: {
    PUSH_SUBSCRIPTIONS: 'avoir-push-subscriptions',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeSub(overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord {
  return {
    userId: 'user-123',
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    createdAt: '2026-01-01T00:00:00.000Z',
    teamId: 'team-1',
    ...overrides,
  };
}

describe('TestPushSubscriptionCrud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockImplementation(async (cmd: unknown) => {
      const command = cmd as { constructor: { name: string } };
      if (command.constructor.name === 'GetCommand') return mockGetCommand(cmd);
      if (command.constructor.name === 'PutCommand') return mockPutCommand(cmd);
      if (command.constructor.name === 'DeleteCommand') return mockDeleteCommand(cmd);
      if (command.constructor.name === 'QueryCommand') return mockQueryCommand(cmd);
      return {};
    });
  });

  describe('saveSubscription', () => {
    it('saves subscription to DynamoDB', async () => {
      mockPutCommand.mockResolvedValue({});
      const { saveSubscription } = await import('@/lib/db/pushSubscriptions');

      const sub = makeSub();
      await saveSubscription(sub);

      expect(mockPutCommand).toHaveBeenCalledOnce();
      const call = mockPutCommand.mock.calls[0][0];
      expect(call.input.TableName).toBe('avoir-push-subscriptions');
      expect(call.input.Item.userId).toBe('user-123');
      expect(call.input.Item.endpoint).toContain('fcm.googleapis.com');
    });
  });

  describe('getSubscription', () => {
    it('returns null when subscription not found', async () => {
      mockGetCommand.mockResolvedValue({ Item: undefined });
      const { getSubscription } = await import('@/lib/db/pushSubscriptions');

      const result = await getSubscription('user-1', 'endpoint-1');
      expect(result).toBeNull();
    });

    it('returns subscription when found', async () => {
      const sub = makeSub();
      mockGetCommand.mockResolvedValue({ Item: sub });
      const { getSubscription } = await import('@/lib/db/pushSubscriptions');

      const result = await getSubscription('user-123', sub.endpoint);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
      expect(result!.keys.p256dh).toBe('test-p256dh');
    });
  });

  describe('listUserSubscriptions', () => {
    it('returns empty array when no subscriptions', async () => {
      mockQueryCommand.mockResolvedValue({ Items: [] });
      const { listUserSubscriptions } = await import('@/lib/db/pushSubscriptions');

      const result = await listUserSubscriptions('user-1');
      expect(result).toEqual([]);
    });

    it('returns all subscriptions for a user', async () => {
      const subs = [
        makeSub({ endpoint: 'endpoint-a' }),
        makeSub({ endpoint: 'endpoint-b' }),
      ];
      mockQueryCommand.mockResolvedValue({ Items: subs });
      const { listUserSubscriptions } = await import('@/lib/db/pushSubscriptions');

      const result = await listUserSubscriptions('user-123');
      expect(result).toHaveLength(2);
    });
  });

  describe('listTeamSubscriptions', () => {
    it('returns subscriptions for a team via GSI', async () => {
      const subs = [makeSub({ teamId: 'team-1' })];
      mockQueryCommand.mockResolvedValue({ Items: subs });
      const { listTeamSubscriptions } = await import('@/lib/db/pushSubscriptions');

      const result = await listTeamSubscriptions('team-1');
      expect(result).toHaveLength(1);
      expect(result[0].teamId).toBe('team-1');
    });
  });

  describe('countUserSubscriptions', () => {
    it('returns count of subscriptions', async () => {
      mockQueryCommand.mockResolvedValue({ Count: 3 });
      const { countUserSubscriptions } = await import('@/lib/db/pushSubscriptions');

      const count = await countUserSubscriptions('user-1');
      expect(count).toBe(3);
    });

    it('returns 0 when no subscriptions', async () => {
      mockQueryCommand.mockResolvedValue({ Count: 0 });
      const { countUserSubscriptions } = await import('@/lib/db/pushSubscriptions');

      const count = await countUserSubscriptions('user-1');
      expect(count).toBe(0);
    });
  });

  describe('deleteSubscription', () => {
    it('removes a specific subscription', async () => {
      mockDeleteCommand.mockResolvedValue({});
      const { deleteSubscription } = await import('@/lib/db/pushSubscriptions');

      await deleteSubscription('user-1', 'endpoint-1');
      expect(mockDeleteCommand).toHaveBeenCalledOnce();
    });
  });

  describe('deleteAllUserSubscriptions', () => {
    it('removes all subscriptions for a user', async () => {
      const subs = [
        makeSub({ endpoint: 'ep-a' }),
        makeSub({ endpoint: 'ep-b' }),
      ];
      mockQueryCommand.mockResolvedValue({ Items: subs });
      mockDeleteCommand.mockResolvedValue({});

      const { deleteAllUserSubscriptions } = await import('@/lib/db/pushSubscriptions');
      const count = await deleteAllUserSubscriptions('user-123');

      expect(count).toBe(2);
      expect(mockDeleteCommand).toHaveBeenCalledTimes(2);
    });

    it('returns 0 when no subscriptions exist', async () => {
      mockQueryCommand.mockResolvedValue({ Items: [] });

      const { deleteAllUserSubscriptions } = await import('@/lib/db/pushSubscriptions');
      const count = await deleteAllUserSubscriptions('user-1');

      expect(count).toBe(0);
    });
  });
});
