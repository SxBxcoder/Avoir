import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import type { UserSubscription } from '@/lib/stripe';

const {
  addCredits,
  deductCredits,
  getSubscription,
  createCampaign,
  checkRateLimit,
  generateGenomeVariants,
  runSyntheticFocusGroup,
  getBrandDNA,
  getPerformanceInsights,
  formatInsightsForPrompt,
  getIntelligenceBrief,
  updateIntelligenceBrief,
  formatIntelligenceForPrompt,
  fetchCompetitorIntel,
  formatCompetitorContext,
  fetchIndustryTrends,
  synthesizeTrendContext,
  requireUser,
  authErrorResponse,
  isDemoMode,
  createMockSSEStream,
  fetchMock,
} = vi.hoisted(() => ({
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getSubscription: vi.fn(),
  createCampaign: vi.fn(),
  checkRateLimit: vi.fn(),
  generateGenomeVariants: vi.fn(),
  runSyntheticFocusGroup: vi.fn(),
  getBrandDNA: vi.fn(),
  getPerformanceInsights: vi.fn(),
  formatInsightsForPrompt: vi.fn(),
  getIntelligenceBrief: vi.fn(),
  updateIntelligenceBrief: vi.fn(),
  formatIntelligenceForPrompt: vi.fn(),
  fetchCompetitorIntel: vi.fn(),
  formatCompetitorContext: vi.fn(),
  fetchIndustryTrends: vi.fn(),
  synthesizeTrendContext: vi.fn(),
  requireUser: vi.fn(),
  authErrorResponse: vi.fn(),
  isDemoMode: vi.fn(),
  createMockSSEStream: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('@/lib/services/subscription', () => ({ addCredits, deductCredits, getSubscription }));
vi.mock('@/lib/db/campaigns', () => ({ createCampaign }));
vi.mock('@/lib/db/cache', () => ({ checkRateLimit }));
vi.mock('@/lib/bedrock', () => ({ generateGenomeVariants, runSyntheticFocusGroup }));
vi.mock('@/lib/db/brandDna', () => ({ getBrandDNA }));
vi.mock('@/lib/db/performance', () => ({
  getPerformanceInsights,
  formatInsightsForPrompt,
}));
vi.mock('@/lib/db/intelligence', () => ({
  getIntelligenceBrief,
  updateIntelligenceBrief,
  formatIntelligenceForPrompt,
}));
vi.mock('@/lib/db/competitors', () => ({
  fetchCompetitorIntel,
  formatCompetitorContext,
}));
vi.mock('@/lib/trends', () => ({ fetchIndustryTrends, synthesizeTrendContext }));
vi.mock('@/lib/auth/requireUser', () => ({ requireUser, authErrorResponse }));
vi.mock('@/lib/mockShield', () => ({ isDemoMode, createMockSSEStream }));

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

function makeRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.token' },
    body: JSON.stringify(body),
  });
}

async function readStreamEvents(res: Response): Promise<Array<{ event: string; data: any }>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();

  return buffer
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event: '));
      const dataLine = lines.find((l) => l.startsWith('data: '));
      return {
        event: eventLine ? eventLine.slice('event: '.length) : '',
        data: dataLine ? JSON.parse(dataLine.slice('data: '.length)) : undefined,
      };
    });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://lambda.test');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(isDemoMode).mockReturnValue(false);
  vi.mocked(requireUser).mockResolvedValue({ userId: 'user-1', email: 'user@example.com' });
  vi.mocked(authErrorResponse).mockReturnValue(null);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, resetIn: 0 });
  vi.mocked(getSubscription).mockResolvedValue(subscription(10));
  vi.mocked(getBrandDNA).mockResolvedValue(null);
  vi.mocked(getPerformanceInsights).mockResolvedValue(null);
  vi.mocked(getIntelligenceBrief).mockResolvedValue(null);
  vi.mocked(fetchIndustryTrends).mockResolvedValue(null);
  vi.mocked(fetchCompetitorIntel).mockResolvedValue(null);
  vi.mocked(updateIntelligenceBrief).mockResolvedValue(undefined);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1' });
  vi.mocked(runSyntheticFocusGroup).mockResolvedValue({
    simulation: [],
    predicted_score: 90,
    revised_campaign: { hook: 'H', offer: 'O', cta: 'C', reasoning: {} },
  });

  addCredits.mockReset();
  addCredits.mockResolvedValue(subscription(10));
  deductCredits.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/generate/stream quota enforcement', () => {
  it('returns 402 from the pre-check and never reserves when credits are insufficient', async () => {
    vi.mocked(getSubscription).mockResolvedValue(subscription(0));

    const res = await POST(makeRequest());

    expect(res.status).toBe(402);
    expect(deductCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits an error event without minting credits when the reservation loses the race', async () => {
    deductCredits.mockResolvedValue({ success: false, subscription: subscription(0) });

    const res = await POST(makeRequest());
    const events = await readStreamEvents(res);

    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining(['error', 'done'])
    );
    expect(addCredits).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refunds the reserved credit when generation fails', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockRejectedValue(new Error('Simulated Lambda failure'));

    const res = await POST(makeRequest());
    const events = await readStreamEvents(res);

    expect(deductCredits).toHaveBeenCalledWith('user-1', 1);
    expect(addCredits).toHaveBeenCalledWith('user-1', 1);
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining(['error', 'done'])
    );
  });

  it('reserves 2 credits in genome mode and streams the completed variants', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(8) });
    generateGenomeVariants.mockResolvedValue({
      variants: [
        { hook: 'V1', plan: { hook: 'V1', offer: 'O1', cta: 'C1' } },
        { hook: 'V2', plan: { hook: 'V2', offer: 'O2', cta: 'C2' } },
      ],
    });

    const res = await POST(makeRequest({ genome_mode: true, goal: 'G' }));
    const events = await readStreamEvents(res);

    expect(deductCredits).toHaveBeenCalledWith('user-1', 2);
    expect(addCredits).not.toHaveBeenCalled();
    expect(createCampaign).not.toHaveBeenCalled();
    expect(events.some((e) => e.event === 'genome')).toBe(true);
    expect(events.some((e) => e.event === 'done' && e.data.success === true)).toBe(true);
  });

  it('persists and streams a completed campaign on success', async () => {
    deductCredits.mockResolvedValue({ success: true, subscription: subscription(9) });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          body: JSON.stringify({
            plan: { hook: 'H', offer: 'O', cta: 'C' },
            captions: ['cap1'],
            image_url: 'img.png',
          }),
        }),
        { status: 200 }
      )
    );

    const res = await POST(makeRequest({ business: 'Acme', topic: 'Launch' }));
    const events = await readStreamEvents(res);

    expect(deductCredits).toHaveBeenCalledWith('user-1', 1);
    expect(addCredits).not.toHaveBeenCalled();
    expect(createCampaign).toHaveBeenCalledWith('user-1', expect.objectContaining({ goal: expect.any(String) }));
    expect(updateIntelligenceBrief).toHaveBeenCalledWith('user-1', { totalCampaignsGenerated: 1 });

    const campaignEvent = events.find((e) => e.event === 'campaign');
    expect(campaignEvent?.data.campaignId).toBe('camp-1');
    expect(events.some((e) => e.event === 'done' && e.data.success === true)).toBe(true);
  });
});
