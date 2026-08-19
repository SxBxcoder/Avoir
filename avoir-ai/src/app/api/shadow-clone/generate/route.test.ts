import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import type { UserSubscription } from '@/lib/stripe';

const {
  getSubscription,
  deductCredits,
  addCredits,
  isDemoMode,
  createMockShadowCloneStream,
  requireUser,
  authErrorResponse,
  runShadowClonePipeline,
} = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  isDemoMode: vi.fn(),
  createMockShadowCloneStream: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  runShadowClonePipeline: vi.fn(),
}));

vi.mock('@/lib/services/subscription', () => ({ getSubscription, deductCredits, addCredits }));
vi.mock('@/lib/mockShield', () => ({ isDemoMode, createMockShadowCloneStream }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/services/shadowClonePipeline', () => ({ runShadowClonePipeline }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

function subscription(credits: number): UserSubscription {
  return {
    userId: 'user-1',
    tier: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    status: 'none',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    credits,
    campaignsUsedThisMonth: 0,
    lastResetDate: new Date().toISOString(),
  };
}

function makeRequest(script = 'Test script'): Request {
  return new Request('http://localhost/api/shadow-clone/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.token' },
    body: JSON.stringify({ script, image_url: 'https://example.com/image.jpg' }),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(requireUser).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
  vi.mocked(getSubscription).mockResolvedValue(subscription(100));

  // Mock pipeline returns a minimal ReadableStream
  vi.mocked(runShadowClonePipeline).mockReturnValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: video\ndata: {"video_url":"https://example.com/video.mp4"}\n\n'));
        controller.close();
      },
    })
  );

  getSubscription.mockClear();
  deductCredits.mockReset();
  addCredits.mockReset();
  runShadowClonePipeline.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/shadow-clone/generate', () => {
  it('returns 400 when script is empty', async () => {
    const res = await POST(makeRequest(''));
    expect(res.status).toBe(400);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it('returns 402 when read-only pre-check shows insufficient credits', async () => {
    vi.mocked(getSubscription).mockResolvedValue(subscription(10));
    const res = await POST(makeRequest());
    expect(res.status).toBe(402);
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it('returns 402 when atomic reservation fails', async () => {
    deductCredits.mockResolvedValue({ success: false, subscription: subscription(10) });
    const res = await POST(makeRequest());
    expect(res.status).toBe(402);
  });

  it('calls runShadowClonePipeline after successful credit reservation', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(50) });
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(deductCredits).toHaveBeenCalledWith('user-1', 50);
    expect(runShadowClonePipeline).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', script: 'Test script' })
    );
  });

  it('returns mock stream in demo mode', async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);
    const mockStream = new ReadableStream();
    vi.mocked(createMockShadowCloneStream).mockReturnValue(mockStream);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(createMockShadowCloneStream).toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });
});
