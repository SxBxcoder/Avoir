import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from './route';

const {
  constructEvent,
  subscriptionsRetrieve,
  customersRetrieve,
  upsertSubscription,
  logAuditEvent,
  headersGet,
} = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  customersRetrieve: vi.fn(),
  upsertSubscription: vi.fn(),
  logAuditEvent: vi.fn(),
  headersGet: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

vi.mock('next/headers', () => ({
  headers: () => ({ get: headersGet }),
}));

vi.mock('@/lib/stripe', () => ({
  getStripeServer: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve },
    customers: { retrieve: customersRetrieve },
  }),
}));

vi.mock('@/lib/services/subscription', () => ({ upsertSubscription }));
vi.mock('@/lib/db/teams', () => ({ logAuditEvent }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function makeRequest(): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: 'raw-stripe-payload',
  });
}

function stripeEvent(type: string, object: unknown) {
  return { type, data: { object } };
}

const proSubscription = {
  items: { data: [{ price: { id: 'price_pro_monthly' } }] },
  customer: 'cus_123',
  current_period_end: 1790000000,
  cancel_at_period_end: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  headersGet.mockReturnValue('valid-signature');
  upsertSubscription.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

// The route reads the raw body as text; smuggle the verified event through it.
// constructEvent is stubbed per-call, so signature verification is bypassed.
async function postEvent(event: unknown): Promise<Response> {
  constructEvent.mockReturnValueOnce(event);
  return POST(makeRequest());
}

describe('POST /api/stripe/webhook — audit trail', () => {
  it('audits checkout.session.completed with tier and credits', async () => {
    subscriptionsRetrieve.mockResolvedValue(proSubscription);

    const res = await postEvent(
      stripeEvent('checkout.session.completed', {
        metadata: { userId: 'user-1' },
        customer: 'cus_123',
        subscription: 'sub_123',
      })
    );

    expect(res.status).toBe(200);
    expect(upsertSubscription).toHaveBeenCalledWith('user-1', expect.objectContaining({ tier: 'pro' }));
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    const [teamId, userId, action, details] = logAuditEvent.mock.calls[0];
    expect(teamId).toBeNull();
    expect(userId).toBe('user-1');
    expect(action).toBe('billing.checkout_completed');
    expect(details).toMatchObject({ tier: 'pro', creditsAdded: 1000 });
  });

  it('audits invoice.payment_failed', async () => {
    customersRetrieve.mockResolvedValue({ metadata: { cognitoUserId: 'user-2' } });

    await postEvent(
      stripeEvent('invoice.payment_failed', {
        id: 'in_123',
        subscription: 'sub_456',
      })
    );

    expect(upsertSubscription).toHaveBeenCalledWith('user-2', { status: 'past_due' });
    const [teamId, userId, action] = logAuditEvent.mock.calls[0];
    expect(teamId).toBeNull();
    expect(userId).toBe('user-2');
    expect(action).toBe('billing.payment_failed');
  });

  it('audits customer.subscription.deleted downgrade to free', async () => {
    customersRetrieve.mockResolvedValue({ metadata: { cognitoUserId: 'user-3' } });

    await postEvent(
      stripeEvent('customer.subscription.deleted', {
        customer: 'cus_789',
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
      })
    );

    expect(upsertSubscription).toHaveBeenCalledWith('user-3', expect.objectContaining({ tier: 'free' }));
    const [teamId, , action, details] = logAuditEvent.mock.calls[0];
    expect(teamId).toBeNull();
    expect(action).toBe('billing.subscription_deleted');
    expect(details).toMatchObject({ downgradedTo: 'free' });
  });

  it('does not audit when the event has no resolvable userId', async () => {
    await postEvent(
      stripeEvent('checkout.session.completed', {
        metadata: null,
        customer: 'cus_x',
        subscription: 'sub_x',
      })
    );

    expect(upsertSubscription).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects unsigned requests before any processing or auditing', async () => {
    headersGet.mockReturnValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
