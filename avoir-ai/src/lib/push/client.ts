/**
 * Avoir — Client-side Push Notification Hooks
 *
 * Provides React hooks for managing push notification subscriptions:
 *   - useNotificationPermission — tracks browser permission state
 *   - requestPermission() — asks the user for notification permission
 *   - subscribePush() — subscribes to push and saves to server
 *   - unsubscribePush() — unsubscribes and removes from server
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

// ============================================================================
// URL-BASE64 → Uint8ARRAY (VAPID key decoding)
// ============================================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================================
// PERMISSION HOOK
// ============================================================================

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

// ============================================================================
// PUSH SUBSCRIPTION HOOK
// ============================================================================

interface UsePushSubscriptionResult {
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  subscribe: (vapidPublicKey: string) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  isLoading: boolean;
}

export function usePushSubscription(): UsePushSubscriptionResult {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing subscription on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscription(sub);
      } catch {
        // SW not available or push not supported
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSubscription();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async (vapidPublicKey: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.toJSON().keys?.p256dh || '',
            auth: sub.toJSON().keys?.auth || '',
          },
          teamId: getTeamIdFromStorage(),
        }),
      });

      if (!res.ok) {
        // Server save failed — unsubscribe from push manager
        await sub.unsubscribe();
        return false;
      }

      setSubscription(sub);
      return true;
    } catch {
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;

    try {
      await subscription.unsubscribe();

      // Remove from server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscription(null);
      return true;
    } catch {
      return false;
    }
  }, [subscription]);

  return {
    isSubscribed: subscription !== null,
    subscription,
    subscribe,
    unsubscribe,
    isLoading,
  };
}

// ============================================================================
// SERVICE WORKER REGISTRATION
// ============================================================================

/**
 * Registers the service worker if not already registered.
 * Call once from a top-level component or layout.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    logger.info('[push]', 'Service worker registered', { scope: reg.scope });
    return reg;
  } catch {
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTeamIdFromStorage(): string | undefined {
  try {
    const stored = localStorage.getItem('avoir_current_team');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.teamId;
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Helper to check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
