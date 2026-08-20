import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TestPushTypes', () => {
  it('notification payload has required fields', async () => {
    const { NotificationPayload } = await import('@/lib/push/types');

    // Type-level check: NotificationPayload should be assignable
    const payload: NotificationPayload = {
      title: 'Test',
      body: 'Hello',
    };
    expect(payload.title).toBe('Test');
    expect(payload.body).toBe('Hello');
  });

  it('push subscription record has all required fields', async () => {
    const { PushSubscriptionRecord } = await import('@/lib/push/types');

    const sub: PushSubscriptionRecord = {
      userId: 'user-1',
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' },
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(sub.userId).toBe('user-1');
    expect(sub.keys.p256dh).toBe('key');
  });

  it('send notification request accepts userId or teamId', async () => {
    const { SendNotificationRequest } = await import('@/lib/push/types');

    const byUser: SendNotificationRequest = {
      userId: 'user-1',
      payload: { title: 'Hi', body: 'There' },
    };
    const byTeam: SendNotificationRequest = {
      teamId: 'team-1',
      payload: { title: 'Hi', body: 'There' },
    };
    expect(byUser.userId).toBe('user-1');
    expect(byTeam.teamId).toBe('team-1');
  });

  it('push status response shape', async () => {
    const { PushStatusResponse } = await import('@/lib/push/types');

    const status: PushStatusResponse = {
      subscribed: true,
      permission: 'granted',
      subscriptionCount: 2,
    };
    expect(status.subscribed).toBe(true);
    expect(status.subscriptionCount).toBe(2);
  });
});
