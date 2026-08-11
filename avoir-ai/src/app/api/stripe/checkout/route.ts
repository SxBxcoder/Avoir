/**
 * Avoir — Enterprise Stripe Checkout Session Route
 * 
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout Session with:
 *   - Customer lookup/create to prevent duplicates
 *   - userId attached as metadata for webhook correlation
 *   - Proper success/cancel URLs
 *   - Idempotency-safe design
 */

import { NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { requireUser, authErrorResponse } from '@/lib/auth/requireUser';

export async function POST(req: Request) {
  try {
    const { priceId, email: bodyEmail } = await req.json();

    // Identity comes from the verified Cognito JWT, not the request body.
    const { userId, email: tokenEmail } = await requireUser(req);
    const email = tokenEmail || bodyEmail;

    // Input validation
    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const stripe = getStripeServer();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // ========================================================================
    // CUSTOMER LOOKUP / CREATE
    // Enterprise pattern: never create duplicate customers for the same email.
    // ========================================================================
    let customerId: string | undefined;

    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log(`[Checkout] Reusing existing Stripe customer: ${customerId}`);
    } else {
      const newCustomer = await stripe.customers.create({
        email: email,
        metadata: { cognitoUserId: userId },
      });
      customerId = newCustomer.id;
      console.log(`[Checkout] Created new Stripe customer: ${customerId}`);
    }

    // ========================================================================
    // CREATE CHECKOUT SESSION
    // ========================================================================
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      metadata: {
        userId: userId, // Critical: webhook uses this to map payment → user
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true, // Enterprise feature: support promo codes
      billing_address_collection: 'auto',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
    });

    console.log(`[Checkout] Session created: ${session.id} for user: ${userId}`);

    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    const authErr = authErrorResponse(err);
    if (authErr) return authErr;
    console.error('[Checkout] Error creating checkout session:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
