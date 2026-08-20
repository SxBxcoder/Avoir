/**
 * Avoir — Team Billing Integration
 *
 * Handles seat-based billing and credit pooling for team workspaces.
 *
 * Plan seat limits:
 *   Free:      1 seat (solo only)
 *   Starter:   3 seats
 *   Pro:       10 seats
 *   Enterprise: unlimited
 *
 * Credit pooling:
 *   When enabled, all AI credits for a team are shared across members.
 *   The team owner sees aggregate usage across all members.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TeamBillingInfo {
  teamId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  seatLimit: number;
  creditsPoolTotal: number;
  creditsPoolUsed: number;
  creditPoolEnabled: boolean;
  billingEmail?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

export interface SeatUsage {
  teamId: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  canAddMember: boolean;
}

export interface CreditUsage {
  teamId: string;
  total: number;
  used: number;
  remaining: number;
  percentageUsed: number;
  byMember: Record<string, number>;
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

const PLAN_SEATS: Record<string, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  enterprise: 999,
};

const PLAN_CREDITS: Record<string, number> = {
  free: 50,
  starter: 500,
  pro: 2000,
  enterprise: 10000,
};

// ============================================================================
// SEAT MANAGEMENT
// ============================================================================

/**
 * Check if a team can add more members.
 */
export function canAddMember(billing: TeamBillingInfo, currentMemberCount: number): boolean {
  return currentMemberCount < billing.seatLimit;
}

/**
 * Get seat usage details for a team.
 */
export function getSeatUsage(billing: TeamBillingInfo, currentMemberCount: number): SeatUsage {
  const available = Math.max(0, billing.seatLimit - currentMemberCount);
  return {
    teamId: billing.teamId,
    totalSeats: billing.seatLimit,
    usedSeats: currentMemberCount,
    availableSeats: available,
    canAddMember: currentMemberCount < billing.seatLimit,
  };
}

/**
 * Upgrade seat limit when the team changes plan.
 */
export function getSeatLimitForPlan(plan: string): number {
  return PLAN_SEATS[plan] || PLAN_SEATS.free;
}

// ============================================================================
// CREDIT POOLING
// ============================================================================

/**
 * Get aggregate credit usage for a team.
 */
export function getTeamCreditUsage(
  billing: TeamBillingInfo,
  memberUsage: Record<string, number>
): CreditUsage {
  const total = billing.creditsPoolTotal || PLAN_CREDITS[billing.plan] || PLAN_CREDITS.free;
  const used = Object.values(memberUsage).reduce((sum, u) => sum + u, 0);
  const remaining = Math.max(0, total - used);

  return {
    teamId: billing.teamId,
    total,
    used,
    remaining,
    percentageUsed: total > 0 ? Math.round((used / total) * 100) : 0,
    byMember: memberUsage,
  };
}

/**
 * Check if a team has credits remaining.
 */
export function hasCreditsRemaining(billing: TeamBillingInfo): boolean {
  if (!billing.creditPoolEnabled) return true; // Personal credits checked separately
  return billing.creditsPoolUsed < billing.creditsPoolTotal;
}

/**
 * Consume credits from the team pool.
 * Returns true if successful, false if insufficient.
 */
export function consumeCredits(billing: TeamBillingInfo, amount: number): { success: boolean; remaining: number } {
  if (!billing.creditPoolEnabled) {
    return { success: true, remaining: -1 };
  }

  const remaining = billing.creditsPoolTotal - billing.creditsPoolUsed;
  if (remaining < amount) {
    return { success: false, remaining };
  }

  billing.creditsPoolUsed += amount;
  return { success: true, remaining: billing.creditsPoolTotal - billing.creditsPoolUsed };
}

// ============================================================================
// BILLING DISPLAY HELPERS
// ============================================================================

export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };
  return names[plan] || 'Free';
}

export function getPlanColor(plan: string): string {
  const colors: Record<string, string> = {
    free: 'text-muted-foreground',
    starter: 'text-info',
    pro: 'text-purple-500',
    enterprise: 'text-amber-500',
  };
  return colors[plan] || colors.free;
}

/**
 * Format seat usage for display.
 */
export function formatSeatUsage(used: number, total: number): string {
  return `${used} / ${total} seats`;
}

/**
 * Format credit usage for display.
 */
export function formatCreditUsage(used: number, total: number): string {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return `${used.toLocaleString()} / ${total.toLocaleString()} credits (${pct}%)`;
}
