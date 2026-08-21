/**
 * Avoir — Server-side VAPID Configuration
 *
 * Reads VAPID keys from environment variables and validates they exist.
 * Used by API routes when sending push notifications via web-push.
 */

import type { VapidKeys } from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let _validatedKeys: VapidKeys | null = null;

/**
 * Returns validated VAPID keys. Throws on first call if env vars are missing.
 * Cached after first successful validation.
 */
export function getVapidKeys(): VapidKeys {
  if (_validatedKeys) return _validatedKeys;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      'VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and ' +
        'VAPID_PRIVATE_KEY in your environment. Run: node scripts/generate-vapid-keys.mjs'
    );
  }

  _validatedKeys = {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
  };

  return _validatedKeys;
}

/**
 * Returns just the public key for client-side use.
 * Safe to expose in browser bundles (it's a PUBLIC key by design).
 */
export function getVapidPublicKey(): string {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
  }
  return VAPID_PUBLIC_KEY;
}
