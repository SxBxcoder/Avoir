import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getSubscription, deductCredits, addCredits } from './users';
import { DEFAULT_SUBSCRIPTION, type UserSubscription } from '@/lib/stripe';

// The DynamoDB client is the only I/O boundary — command classes are inert
// data holders, so we stub the client and drive the credit logic through it.
// The in-memory store honours the same ConditionExpression the real table
// enforces (`credits >= amount`), so overdraws are impossible here too.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@/lib/db/dynamodb', () => ({
  getDynamoClient: () => ({ send: sendMock }),
  TABLES: { USERS: 'avoir-users' },
}));

let store = new Map<string, UserSubscription>();

function sub(overrides: Partial<UserSubscription> = {}): UserSubscription {
  return { ...DEFAULT_SUBSCRIPTION, userId: 'user-1', ...overrides } as UserSubscription;
}

function fakeSend(command: unknown): Promise<unknown> {
  const input = (command as { input?: any })?.input ?? {};
  const key = input.Key?.userId as string | undefined;

  if (command instanceof GetCommand) {
    return Promise.resolve({ Item: store.get(key!) });
  }

  if (command instanceof PutCommand) {
    if (input.ConditionExpression && store.has(key!)) {
      return Promise.reject(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          name: 'ConditionalCheckFailedException',
        })
      );
    }
    store.set(key!, input.Item as UserSubscription);
    return Promise.resolve({});
  }

  if (command instanceof UpdateCommand) {
    const current =
      store.get(key!) ?? ({ ...DEFAULT_SUBSCRIPTION, userId: key!, credits: 0 } as UserSubscription);
    const amount = input.ExpressionAttributeValues?.[':amount'] as number;
    const isDeduction = Boolean(input.ConditionExpression);

    if (isDeduction && (current.credits ?? 0) < amount) {
      return Promise.reject(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          name: 'ConditionalCheckFailedException',
        })
      );
    }

    const updated = {
      ...current,
      credits: isDeduction ? (current.credits ?? 0) - amount : (current.credits ?? 0) + amount,
      updatedAt: input.ExpressionAttributeValues?.[':now'] ?? new Date().toISOString(),
    };
    store.set(key!, updated);
    return Promise.resolve({ Attributes: updated });
  }

  return Promise.resolve({});
}

beforeEach(() => {
  store = new Map();
  sendMock.mockReset();
  sendMock.mockImplementation(fakeSend);
});

describe('deductCredits', () => {
  it('returns success:true and the decremented balance when the balance covers the cost', async () => {
    store.set('user-1', sub({ credits: 5 }));

    const result = await deductCredits('user-1', 2);

    expect(result.success).toBe(true);
    expect(result.subscription.credits).toBe(3);
  });

  it('returns success:false and leaves the balance untouched when funds are insufficient', async () => {
    store.set('user-1', sub({ credits: 1 }));

    const result = await deductCredits('user-1', 2);

    expect(result.success).toBe(false);
    expect(result.subscription.credits).toBe(1);
  });

  it('fails closed (success:false) when the store errors for an unknown reason', async () => {
    store.set('user-1', sub({ credits: 5 }));
    sendMock.mockRejectedValueOnce(new Error('Simulated DynamoDB failure'));

    const result = await deductCredits('user-1', 1);

    // A spend must never be granted when the deduction cannot be proven.
    expect(result.success).toBe(false);
    expect(result.subscription.credits).toBe(5);
  });

  it('never lets concurrent spends overdraw the balance', async () => {
    store.set('user-1', sub({ credits: 3 }));

    const results = await Promise.all(
      Array.from({ length: 6 }, () => deductCredits('user-1', 1))
    );

    const succeeded = results.filter((r) => r.success).length;
    expect(succeeded).toBe(3);

    const after = await getSubscription('user-1');
    expect(after.credits).toBe(0);
  });

  it('bootstraps a default free-tier row for a brand-new user', async () => {
    const result = await deductCredits('user-1', 1);

    // No row exists yet, so the conditional decrement fails closed and the
    // default free-tier subscription (with its initial credit balance) is created.
    expect(result.success).toBe(false);
    expect(result.subscription.credits).toBe(DEFAULT_SUBSCRIPTION.credits);
  });
});

describe('addCredits', () => {
  it('refunds credits atomically (used when a reserved generation fails)', async () => {
    store.set('user-1', sub({ credits: 0 }));

    const updated = await addCredits('user-1', 1);

    expect(updated.credits).toBe(1);
  });

  it('initialises the balance from zero when no row exists yet', async () => {
    const updated = await addCredits('user-1', 5);

    expect(updated.credits).toBe(5);
  });
});
