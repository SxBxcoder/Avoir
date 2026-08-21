'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on mount.
 * This is a client-only component placed in the root layout.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // SW registration failed — push notifications will not work, but
      // the app should still function normally.
    });
  }, []);

  return null;
}
