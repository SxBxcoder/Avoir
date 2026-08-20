/**
 * Avoir — Push Notification Service Worker
 *
 * Handles push events and notification interactions.
 * This file is served from public/ and registered by the client.
 *
 * Events:
 *   push        → parse payload → show notification
 *   notificationclick → focus existing tab or open URL
 *   notificationclose → analytics placeholder
 */

// eslint-disable-next-line no-restricted-globals
const sw = self as ServiceWorkerGlobalScope;

// ============================================================================
// PUSH EVENT
// ============================================================================

sw.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback if the server sent plain text
    payload = {
      title: 'Avoir',
      body: event.data.text(),
    };
  }

  const { title, body, icon, badge, image, tag, url, data } = payload;

  const options = {
    body,
    icon: icon || '/logo.png',
    badge: badge || '/logo.png',
    image,
    tag: tag || 'avoir-notification',
    data: { url: url || '/dashboard', ...data },
    vibrate: [100, 50, 100],
    actions: data?.actions || [],
  };

  event.waitUntil(
    sw.registration.showNotification(title || 'Avoir', options)
  );
});

// ============================================================================
// NOTIFICATION CLICK
// ============================================================================

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if one is open at the target URL
      for (const client of clientList) {
        if (client.url.includes(new URL(url, sw.location.origin).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(url);
      }
      return undefined;
    })
  );
});

// ============================================================================
// NOTIFICATION CLOSE (analytics placeholder)
// ============================================================================

sw.addEventListener('notificationclose', (_event) => {
  // Placeholder for analytics: track notification dismissal rate
});

// ============================================================================
// INSTALL & ACTIVATE
// ============================================================================

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});
