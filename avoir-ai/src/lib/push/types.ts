/**
 * Avoir — Push Notification Types
 *
 * Shared types for push subscription storage, notification payloads,
 * and API request/response contracts.
 */

// ============================================================================
// PUSH SUBSCRIPTION
// ============================================================================

export interface PushSubscriptionRecord {
  /** Cognito sub of the subscription owner */
  userId: string;
  /** Push subscription endpoint URL (unique per browser/device) */
  endpoint: string;
  /** ECDH keys for encryption */
  keys: {
    p256dh: string;
    auth: string;
  };
  /** ISO timestamp of when the subscription was created */
  createdAt: string;
  /** Optional team scope for team-wide broadcasts */
  teamId?: string;
  /** User agent string for debugging */
  userAgent?: string;
}

// ============================================================================
// NOTIFICATION PAYLOAD
// ============================================================================

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  /** URL to open when the notification is clicked */
  url?: string;
  /** Freeform data attached to the notification */
  data?: Record<string, unknown>;
}

export interface SendNotificationRequest {
  /** Send to a specific user */
  userId?: string;
  /** Send to all members of a team */
  teamId?: string;
  /** The notification payload */
  payload: NotificationPayload;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface PushStatusResponse {
  subscribed: boolean;
  permission: NotificationPermission;
  subscriptionCount: number;
}

export interface SubscribeResponse {
  ok: boolean;
  subscription?: PushSubscriptionRecord;
}

export interface SendResponse {
  ok: boolean;
  sent: number;
  failed: number;
}

// ============================================================================
// NOTIFICATION TYPES (for categorizing notifications)
// ============================================================================

export type NotificationType =
  | 'campaign.complete'
  | 'campaign.failed'
  | 'invitation.received'
  | 'invitation.accepted'
  | 'member.joined'
  | 'member.removed'
  | 'team.updated'
  | 'billing.payment_failed'
  | 'system.maintenance';
