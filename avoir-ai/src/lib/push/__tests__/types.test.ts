import { describe, it, expect } from 'vitest';
import type {
  NotificationPayload,
  PushSubscriptionRecord,
  SendNotificationRequest,
  PushStatusResponse,
} from '@/lib/push/types';

describe('TestPushTypes', () => {
  it('notification payload has required fields', () => {
    const payload: NotificationPayload = {
      title: 'Test',
      body: 'Hello',
    };
    expect(payload.title).toBe('Test');
    expect(payload.body).toBe('Hello');
  });

  it('push subscription record has all required fields', () => {
    const sub: PushSubscriptionRecord = {
      userId: 'user-1',
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' },
      createdAt: '2026-01-01T00:00:00Z',
    };
    expect(sub.userId).toBe('user-1');
    expect(sub.keys.p256dh).toBe('key');
  });

  it('send notification request accepts userId or teamId', () => {
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

  it('push status response shape', () => {
    const status: PushStatusResponse = {
      subscribed: true,
      permission: 'granted',
      subscriptionCount: 2,
    };
    expect(status.subscribed).toBe(true);
    expect(status.subscriptionCount).toBe(2);
  });

  it('notification payload supports optional fields', () => {
    const full: NotificationPayload = {
      title: 'Campaign Complete',
      body: 'Your campaign is ready',
      icon: '/icon.png',
      badge: '/badge.png',
      image: '/preview.png',
      tag: 'campaign-123',
      url: '/dashboard/campaigns/123',
      data: { campaignId: '123', type: 'campaign.complete' },
    };
    expect(full.tag).toBe('campaign-123');
    expect(full.data?.campaignId).toBe('123');
  });

  it('notification type union covers all event categories', () => {
    // Type-level validation: these should all compile
    const types: NotificationType[] = [
      'campaign.complete',
      'campaign.failed',
      'invitation.received',
      'invitation.accepted',
      'member.joined',
      'member.removed',
      'team.updated',
      'billing.payment_failed',
      'system.maintenance',
    ];
    expect(types).toHaveLength(9);
  });
});

import type { NotificationType } from '@/lib/push/types';
