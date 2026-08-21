import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TestVapidConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('returns keys when env vars are set', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';

    const { getVapidKeys } = await import('@/lib/push/vapid');
    const keys = getVapidKeys();

    expect(keys.publicKey).toBe('test-public-key');
    expect(keys.privateKey).toBe('test-private-key');
  });

  it('throws when NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';

    const { getVapidKeys } = await import('@/lib/push/vapid');
    expect(() => getVapidKeys()).toThrow('VAPID keys not configured');
  });

  it('throws when VAPID_PRIVATE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
    delete process.env.VAPID_PRIVATE_KEY;

    const { getVapidKeys } = await import('@/lib/push/vapid');
    expect(() => getVapidKeys()).toThrow('VAPID keys not configured');
  });

  it('getVapidPublicKey returns just the public key', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'my-public';
    process.env.VAPID_PRIVATE_KEY = 'my-private';

    const { getVapidPublicKey } = await import('@/lib/push/vapid');
    expect(getVapidPublicKey()).toBe('my-public');
  });

  it('getVapidPublicKey throws when not set', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const { getVapidPublicKey } = await import('@/lib/push/vapid');
    expect(() => getVapidPublicKey()).toThrow('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
  });

  it('caches keys after first call', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'cached-pub';
    process.env.VAPID_PRIVATE_KEY = 'cached-priv';

    const { getVapidKeys } = await import('@/lib/push/vapid');
    const first = getVapidKeys();
    const second = getVapidKeys();

    expect(first).toBe(second);
  });
});
