/**
 * Prachar.ai — Enterprise Stripe Configuration
 * 
 * Single source of truth for all Stripe-related constants, types, and utilities.
 * Handles both client-side (Stripe.js) and server-side (Stripe Node SDK) initialization.
 */

import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';

// ============================================================================
// PLAN CONSTANTS — The Single Source of Truth
// ============================================================================

export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  monthlyPriceId: string;   // Stripe Price ID for monthly billing
  annualPriceId: string;    // Stripe Price ID for annual billing
  campaignsPerMonth: number; // -1 = unlimited
  features: string[];
}

/**
 * All plan configurations. Replace the `priceId` values with your real
 * Stripe Dashboard → Products → Price IDs before going live.
 */
export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Starter',
    monthlyPriceId: '',
    annualPriceId: '',
    campaignsPerMonth: 3,
    features: [
      '3 campaigns / month',
      'Standard AI models',
      'Community support',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual',
    campaignsPerMonth: -1, // unlimited
    features: [
      'Unlimited campaigns',
      '6-Tier Diamond Cascade AI',
      'Priority support',
      'Custom brand guidelines',
      'Campaign history & analytics',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID || 'price_ent_monthly',
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID || 'price_ent_annual',
    campaignsPerMonth: -1,
    features: [
      'Everything in Pro',
      'White-label branding',
      'Team collaboration (5 seats)',
      'API access',
      'Dedicated account manager',
      'SSO & advanced security',
    ],
  },
};

// ============================================================================
// CLIENT-SIDE STRIPE.JS SINGLETON
// ============================================================================

let stripePromise: Promise<StripeJS | null>;

/**
 * Returns a cached Stripe.js instance for client-side operations
 * (Elements, redirectToCheckout, etc.)
 */
export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error('[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
    }
    stripePromise = loadStripe(key!);
  }
  return stripePromise;
};

// ============================================================================
// SERVER-SIDE STRIPE SINGLETON (used in API routes only)
// ============================================================================

import Stripe from 'stripe';

let _stripeServer: Stripe | null = null;

/**
 * Returns a cached Stripe server SDK instance.
 * Safe to call from Next.js API routes / server components only.
 */
export const getStripeServer = (): Stripe => {
  if (!_stripeServer) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('[Stripe] STRIPE_SECRET_KEY is not set in environment variables.');
    }
    _stripeServer = new Stripe(key, {
      apiVersion: '2026-05-27.dahlia' as any,
      typescript: true,
    });
  }
  return _stripeServer;
};

// ============================================================================
// SUBSCRIPTION STATE TYPES
// ============================================================================

export interface UserSubscription {
  userId: string;
  tier: PlanTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'none';
  currentPeriodEnd: string | null; // ISO date
  cancelAtPeriodEnd: boolean;
  campaignsUsedThisMonth: number;
  lastResetDate: string; // ISO date — when the monthly counter was last reset
}

/**
 * Default subscription for brand new users (free tier).
 */
export const DEFAULT_SUBSCRIPTION: Omit<UserSubscription, 'userId'> = {
  tier: 'free',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  campaignsUsedThisMonth: 0,
  lastResetDate: new Date().toISOString(),
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Given a user's subscription, determine if they can generate another campaign.
 */
export function canGenerateCampaign(sub: UserSubscription): boolean {
  const plan = PLANS[sub.tier];
  if (plan.campaignsPerMonth === -1) return true; // unlimited
  return sub.campaignsUsedThisMonth < plan.campaignsPerMonth;
}

/**
 * Returns the remaining campaign count, or -1 for unlimited.
 */
export function getRemainingCampaigns(sub: UserSubscription): number {
  const plan = PLANS[sub.tier];
  if (plan.campaignsPerMonth === -1) return -1;
  return Math.max(0, plan.campaignsPerMonth - sub.campaignsUsedThisMonth);
}
