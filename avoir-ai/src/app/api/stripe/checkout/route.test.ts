import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from './route';

const {
  customersList,
  customersCreate,
  customersUpdate,
  sessionsCreate,
  requireUserEmail,
} = vi.hoisted(() => ({
  customersList: vi.fn(),
  customersCreate: vi.fn(),
  customersUpdate: vi.fn(),
  sessionsCreate: vi.fn(),
  requireUserEmail: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
}));

vi.mock('@/lib/stripe', () => ({
  getStripeServer: () => ({
    customers: { list: customersList, create: customersCreate, update: customersUpdate },
    checkout: { sessions: { create: sessionsCreate } },
  }),
}));

vi.mock('@/lib/mockShield', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/auth/requireUser', () => ({ authErrorResponse: () => null, requireUserEmail }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function makeRequest(): Request {
  return new Request('http://localhost/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ priceId: 'price_pro_monthly' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserEmail.mockResolvedValue({ userId: 'user-1', email: 'buyer@example.com' });
  customersList.mockResolvedValue({ data: [] });
  customersCreate.mockResolvedValue({ id: 'cus_new' });
  customersUpdate.mockResolvedValue({});
  sessionsCreate.mockResolvedValue({ id: 'cs_123' });
});

describe('POST /api/stripe/checkout — customer metadata', () => {
  it('backfills cognitoUserId metadata when reusing an existing customer', async () => {
    customersList.mockResolvedValue({ data: [{ id: 'cus_existing' }] });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(customersCreate).not.toHaveBeenCalled();
    // Without this update, webhook correlation via metadata.cognitoUserId
    // silently fails for pre-metadata customers and skips credit refills.
    expect(customersUpdate).toHaveBeenCalledWith('cus_existing', {
      metadata: { cognitoUserId: 'user-1' },
    });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });

  it('creates a new customer with cognitoUserId metadata when none exists', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(customersUpdate).not.toHaveBeenCalled();
    expect(customersCreate).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      metadata: { cognitoUserId: 'user-1' },
    });
  });
});
