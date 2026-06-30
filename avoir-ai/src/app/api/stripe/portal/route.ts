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
 */

import { NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const stripe = getStripeServer();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    console.log(`[Portal] Session created for customer: ${customerId}`);
    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('[Portal] Error creating portal session:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
