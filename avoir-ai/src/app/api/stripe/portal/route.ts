/**
 * Avoir — Stripe Customer Portal Route
 * 
 * POST /api/stripe/portal
 * 
 * Creates a Stripe Billing Portal session so users can self-serve:
 *   - Update payment method
 *   - View invoices
 *   - Cancel subscription
 *   - Switch plans
 * 
 * This is the enterprise-standard way to handle subscription management
 * without building custom UI for billing.
 * 
 * The customer is derived from the verified Cognito JWT — the client never
 * supplies a customerId (a caller could otherwise open any user's billing
 * portal by guessing a Stripe customer ID).
 */

import { NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { getSubscription } from '@/lib/services/subscription';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export async function POST(req: Request) {
  try {
    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId } = await requireUser(req);

    const sub = await getSubscription(userId);
    const customerId = sub?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account linked to this user' },
        { status: 400 }
      );
    }

    const stripe = getStripeServer();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    console.log(`[Portal] Session created for customer: ${customerId}`);
    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    const authErr = authErrorResponse(err);
    if (authErr) return authErr;
    console.error('[Portal] Error creating portal session:', err);
    // Never leak internal Stripe error text to the client.
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
