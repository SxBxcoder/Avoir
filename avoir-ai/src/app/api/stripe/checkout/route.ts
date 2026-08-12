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
 * 
 * The customer email comes from the verified Cognito ID token claim
 * (`email_verified === true`) — it is never taken from the request body, so a
 * caller cannot create a Stripe customer under someone else's email.
 */

import { NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe';
import { isDemoMode } from '@/lib/mockShield';
import { requireUserEmail, authErrorResponse } from '@/lib/auth/requireUser';

// Only the server-configured price IDs are purchasable — a client can't pass
// an arbitrary Stripe price (e.g. a discounted or one-time product). Keep the
// fallbacks in sync with PRICE_TO_TIER in the webhook route.
const ALLOWED_PRICE_IDS = new Set([
  process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
  process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual',
  process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID || 'price_ent_monthly',
  process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID || 'price_ent_annual',
]);

export async function POST(req: Request) {
  // Demo Mock Shield: never create live Stripe customers or checkout sessions
  // with the synthetic demo identity.
  if (isDemoMode()) {
    return NextResponse.json({ sessionId: 'cs_demo_checkout' });
  }

  try {
    // Authenticate FIRST so a malformed body can't mask a 401/403, and so the
    // email for the Stripe customer is always the verified account email.
    const { userId, email } = await requireUserEmail(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { priceId } = body;

    // Input validation
    if (typeof priceId !== 'string' || !priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
    }
    if (!ALLOWED_PRICE_IDS.has(priceId)) {
      return NextResponse.json({ error: 'Unsupported priceId' }, { status: 400 });
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

    console.log(`[Checkout] Session created: ${session.id}`);

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
