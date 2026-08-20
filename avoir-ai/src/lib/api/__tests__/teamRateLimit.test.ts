import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkTeamRateLimit, rateLimitHeaders, rateLimitResponse } from '@/lib/api/teamRateLimit';

describe('TestMemoryRateLimiter', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.useRealTimers();
  });

  it('allows requests up to the limit', async () => {
    const result = await checkTeamRateLimit({ teamId: 'team-1', plan: 'free', windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(60);
    expect(result.remaining).toBe(59);
  });

  it('blocks requests over the limit', async () => {
    const teamId = 'team-blocked';

    for (let i = 0; i < 60; i++) {
      await checkTeamRateLimit({ teamId, plan: 'free', windowMs: 60_000 });
    }

    const result = await checkTeamRateLimit({ teamId, plan: 'free', windowMs: 60_000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(60);
  });

  it('resets after window expires', async () => {
    const teamId = 'team-reset';
    const windowMs = 60_000;
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    for (let i = 0; i < 60; i++) {
      await checkTeamRateLimit({ teamId, plan: 'free', windowMs });
    }

    const blocked = await checkTeamRateLimit({ teamId, plan: 'free', windowMs });
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(now + windowMs + 1);

    const reset = await checkTeamRateLimit({ teamId, plan: 'free', windowMs });
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(59);
  });

  it('different plans have different limits', async () => {
    const free = await checkTeamRateLimit({ teamId: 'team-free', plan: 'free', windowMs: 60_000 });
    expect(free.limit).toBe(60);

    const pro = await checkTeamRateLimit({ teamId: 'team-pro', plan: 'pro', windowMs: 60_000 });
    expect(pro.limit).toBe(300);

    const starter = await checkTeamRateLimit({ teamId: 'team-starter', plan: 'starter', windowMs: 60_000 });
    expect(starter.limit).toBe(120);

    const enterprise = await checkTeamRateLimit({ teamId: 'team-enterprise', plan: 'enterprise', windowMs: 60_000 });
    expect(enterprise.limit).toBe(1000);
  });
});

describe('TestRateLimitHelpers', () => {
  it('rateLimitHeaders returns correct headers', () => {
    const result = {
      allowed: true,
      remaining: 42,
      resetAt: 1700000060000,
      limit: 100,
    };

    const headers = rateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('42');
    expect(headers['X-RateLimit-Reset']).toBe(String(Math.ceil(1700000060000 / 1000)));
  });

  it('rateLimitResponse returns a 429 Response with correct status and headers', async () => {
    const resetAt = Date.now() + 30_000;
    const result = {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: 60,
    };

    const response = rateLimitResponse(result);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error).toBe('Rate limit exceeded. Please try again shortly.');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(String(Math.ceil(resetAt / 1000)));
    expect(response.headers.get('Retry-After')).toBeDefined();

    const retryAfter = Number(response.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThanOrEqual(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});
