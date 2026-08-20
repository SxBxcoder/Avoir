import { describe, it, expect } from 'vitest';
import type { TeamBillingInfo } from '@/lib/teams/billing';
import {
  canAddMember,
  getSeatUsage,
  getSeatLimitForPlan,
  getTeamCreditUsage,
  hasCreditsRemaining,
  consumeCredits,
  getPlanDisplayName,
  getPlanColor,
  formatSeatUsage,
  formatCreditUsage,
} from '@/lib/teams/billing';

function makeBilling(overrides: Partial<TeamBillingInfo> = {}): TeamBillingInfo {
  return {
    teamId: 'team_1',
    plan: 'free',
    seatLimit: 1,
    creditsPoolTotal: 0,
    creditsPoolUsed: 0,
    creditPoolEnabled: false,
    ...overrides,
  };
}

// ============================================================================
// SEAT MANAGEMENT
// ============================================================================

describe('TestSeatLimits', () => {
  describe('canAddMember', () => {
    it('returns true when under the seat limit', () => {
      const billing = makeBilling({ seatLimit: 3 });
      expect(canAddMember(billing, 1)).toBe(true);
    });

    it('returns false when at the seat limit', () => {
      const billing = makeBilling({ seatLimit: 3 });
      expect(canAddMember(billing, 3)).toBe(false);
    });

    it('returns false when over the seat limit', () => {
      const billing = makeBilling({ seatLimit: 3 });
      expect(canAddMember(billing, 5)).toBe(false);
    });

    it('returns true when current member count is zero', () => {
      const billing = makeBilling({ seatLimit: 1 });
      expect(canAddMember(billing, 0)).toBe(true);
    });
  });

  describe('getSeatUsage', () => {
    it('returns correct available seats when under limit', () => {
      const billing = makeBilling({ teamId: 'team_a', seatLimit: 10 });
      const usage = getSeatUsage(billing, 4);
      expect(usage).toEqual({
        teamId: 'team_a',
        totalSeats: 10,
        usedSeats: 4,
        availableSeats: 6,
        canAddMember: true,
      });
    });

    it('returns zero available seats when at limit', () => {
      const billing = makeBilling({ teamId: 'team_b', seatLimit: 3 });
      const usage = getSeatUsage(billing, 3);
      expect(usage.availableSeats).toBe(0);
      expect(usage.canAddMember).toBe(false);
    });

    it('floors available seats to zero when over limit', () => {
      const billing = makeBilling({ seatLimit: 2 });
      const usage = getSeatUsage(billing, 5);
      expect(usage.availableSeats).toBe(0);
    });
  });

  describe('getSeatLimitForPlan', () => {
    it('returns 1 for free plan', () => {
      expect(getSeatLimitForPlan('free')).toBe(1);
    });

    it('returns 3 for starter plan', () => {
      expect(getSeatLimitForPlan('starter')).toBe(3);
    });

    it('returns 10 for pro plan', () => {
      expect(getSeatLimitForPlan('pro')).toBe(10);
    });

    it('returns 999 for enterprise plan', () => {
      expect(getSeatLimitForPlan('enterprise')).toBe(999);
    });

    it('falls back to free limit for unknown plan', () => {
      expect(getSeatLimitForPlan('unknown')).toBe(1);
    });
  });
});

// ============================================================================
// CREDIT POOLING
// ============================================================================

describe('TestCreditPooling', () => {
  describe('getTeamCreditUsage', () => {
    it('calculates correct totals and percentages', () => {
      const billing = makeBilling({ teamId: 'team_x', creditsPoolTotal: 1000 });
      const memberUsage = { alice: 200, bob: 300, carol: 50 };
      const usage = getTeamCreditUsage(billing, memberUsage);

      expect(usage.teamId).toBe('team_x');
      expect(usage.total).toBe(1000);
      expect(usage.used).toBe(550);
      expect(usage.remaining).toBe(450);
      expect(usage.percentageUsed).toBe(55);
      expect(usage.byMember).toEqual(memberUsage);
    });

    it('returns 0 percent when no credits used', () => {
      const billing = makeBilling({ creditsPoolTotal: 500 });
      const usage = getTeamCreditUsage(billing, {});
      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(500);
      expect(usage.percentageUsed).toBe(0);
    });

    it('floors remaining to zero when over-used', () => {
      const billing = makeBilling({ creditsPoolTotal: 100 });
      const usage = getTeamCreditUsage(billing, { user1: 60, user2: 70 });
      expect(usage.used).toBe(130);
      expect(usage.remaining).toBe(0);
      expect(usage.percentageUsed).toBe(130);
    });

    it('falls back to plan default when creditsPoolTotal is 0', () => {
      const billing = makeBilling({ plan: 'starter', creditsPoolTotal: 0 });
      const usage = getTeamCreditUsage(billing, { u: 100 });
      expect(usage.total).toBe(500);
    });
  });

  describe('hasCreditsRemaining', () => {
    it('returns true when credits remain', () => {
      const billing = makeBilling({
        creditPoolEnabled: true,
        creditsPoolTotal: 500,
        creditsPoolUsed: 200,
      });
      expect(hasCreditsRemaining(billing)).toBe(true);
    });

    it('returns false when credits exhausted', () => {
      const billing = makeBilling({
        creditPoolEnabled: true,
        creditsPoolTotal: 500,
        creditsPoolUsed: 500,
      });
      expect(hasCreditsRemaining(billing)).toBe(false);
    });

    it('returns true when pool is disabled', () => {
      const billing = makeBilling({ creditPoolEnabled: false });
      expect(hasCreditsRemaining(billing)).toBe(true);
    });
  });

  describe('consumeCredits', () => {
    it('succeeds when enough credits remain', () => {
      const billing = makeBilling({
        creditPoolEnabled: true,
        creditsPoolTotal: 1000,
        creditsPoolUsed: 300,
      });
      const result = consumeCredits(billing, 200);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(500);
      expect(billing.creditsPoolUsed).toBe(500);
    });

    it('fails when insufficient credits remain', () => {
      const billing = makeBilling({
        creditPoolEnabled: true,
        creditsPoolTotal: 100,
        creditsPoolUsed: 80,
      });
      const result = consumeCredits(billing, 50);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(20);
      expect(billing.creditsPoolUsed).toBe(80);
    });

    it('succeeds with remaining -1 when pool is disabled', () => {
      const billing = makeBilling({ creditPoolEnabled: false });
      const result = consumeCredits(billing, 100);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(-1);
    });
  });
});

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

describe('TestDisplayHelpers', () => {
  describe('getPlanDisplayName', () => {
    it('returns Free for free plan', () => {
      expect(getPlanDisplayName('free')).toBe('Free');
    });

    it('returns Starter for starter plan', () => {
      expect(getPlanDisplayName('starter')).toBe('Starter');
    });

    it('returns Pro for pro plan', () => {
      expect(getPlanDisplayName('pro')).toBe('Pro');
    });

    it('returns Enterprise for enterprise plan', () => {
      expect(getPlanDisplayName('enterprise')).toBe('Enterprise');
    });

    it('falls back to Free for unknown plan', () => {
      expect(getPlanDisplayName('unknown')).toBe('Free');
    });
  });

  describe('getPlanColor', () => {
    it('returns muted color for free', () => {
      expect(getPlanColor('free')).toBe('text-muted-foreground');
    });

    it('returns info color for starter', () => {
      expect(getPlanColor('starter')).toBe('text-info');
    });

    it('returns purple for pro', () => {
      expect(getPlanColor('pro')).toBe('text-purple-500');
    });

    it('returns amber for enterprise', () => {
      expect(getPlanColor('enterprise')).toBe('text-amber-500');
    });

    it('falls back to free color for unknown plan', () => {
      expect(getPlanColor('nope')).toBe('text-muted-foreground');
    });
  });

  describe('formatSeatUsage', () => {
    it('formats seat usage correctly', () => {
      expect(formatSeatUsage(3, 10)).toBe('3 / 10 seats');
    });

    it('formats zero seats', () => {
      expect(formatSeatUsage(0, 5)).toBe('0 / 5 seats');
    });

    it('formats fully used seats', () => {
      expect(formatSeatUsage(1, 1)).toBe('1 / 1 seats');
    });
  });

  describe('formatCreditUsage', () => {
    it('formats credit usage with percentage', () => {
      expect(formatCreditUsage(250, 1000)).toBe('250 / 1,000 credits (25%)');
    });

    it('formats zero credits used', () => {
      expect(formatCreditUsage(0, 500)).toBe('0 / 500 credits (0%)');
    });

    it('formats 100 percent usage', () => {
      expect(formatCreditUsage(1000, 1000)).toBe('1,000 / 1,000 credits (100%)');
    });

    it('returns 0 percent when total is zero', () => {
      expect(formatCreditUsage(0, 0)).toBe('0 / 0 credits (0%)');
    });
  });
});
