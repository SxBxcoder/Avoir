/**
 * Prachar.ai — Enterprise Stripe Webhook Handler
 * 
 * POST /api/stripe/webhook
 * 
 * Handles the FULL Stripe subscription lifecycle:
 *   1. checkout.session.completed   → User subscribes → upgrade tier
 *   2. invoice.payment_succeeded    → Recurring payment → keep active
 *   3. invoice.payment_failed       → Payment failed → flag past_due
 *   4. customer.subscription.updated → Plan change / cancel at period end
 *   5. customer.subscription.deleted → Subscription ended → downgrade to free
 * 
 * Security: Verifies webhook signature using STRIPE_WEBHOOK_SECRET.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getStripeServer, type PlanTier } from '@/lib/stripe';
import { upsertSubscription } from '@/lib/services/subscription';
import type Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ============================================================================
// PRICE ID → TIER MAPPING
// Keep this in sync with your Stripe Dashboard products.
// ============================================================================

const PRICE_TO_TIER: Record<string, PlanTier> = {
  // Monthly
  [process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly']: 'pro',
  [process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual']: 'pro',
  [process.env.NEXT_PUBLIC_STRIPE_ENT_MONTHLY_PRICE_ID || 'price_ent_monthly']: 'enterprise',
  [process.env.NEXT_PUBLIC_STRIPE_ENT_ANNUAL_PRICE_ID || 'price_ent_annual']: 'enterprise',
};

function resolveTier(priceId: string): PlanTier {
  return PRICE_TO_TIER[priceId] || 'pro'; // default to pro for unknown price IDs
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: Request) {
  const stripe = getStripeServer();

  // 1. Read raw body (must be text, not json, for signature verification)
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // 2. Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Signature invalid: ${err.message}` }, { status: 400 });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  // 3. Process event
  try {
    switch (event.type) {

      // ====================================================================
      // CHECKOUT COMPLETED — User just finished paying
      // ====================================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error('[Webhook] checkout.session.completed missing userId in metadata');
          break;
        }

        // Fetch the subscription to get the price ID and period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id || '';
        const tier = resolveTier(priceId);

        const creditsToAdd = tier === 'enterprise' ? 5000 : tier === 'pro' ? 1000 : 0;

        await upsertSubscription(userId, {
          tier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: 'active',
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          credits: creditsToAdd, // Assign new credits
          lastResetDate: new Date().toISOString(),
        });

        console.log(`[Webhook] ✅ User ${userId} upgraded to ${tier}. Customer: ${customerId}`);
        break;
      }

      // ====================================================================
      // RECURRING PAYMENT SUCCEEDED — Keep subscription active
      // ====================================================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = subscription.customer as string;

        // Find user by customer ID (iterate store)
        // In production, you'd query DynamoDB by stripeCustomerId
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.cognitoUserId;

        if (userId) {
          // Note: In a metered billing setup without separate invoices for credits, 
          // a recurring invoice payment would refill the credits.
          const priceId = subscription.items.data[0]?.price?.id || '';
          const tier = resolveTier(priceId);
          const creditsToAdd = tier === 'enterprise' ? 5000 : tier === 'pro' ? 1000 : 0;

          await upsertSubscription(userId, {
            status: 'active',
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
            credits: creditsToAdd, // Refill credits
            lastResetDate: new Date().toISOString(),
          });
          console.log(`[Webhook] ✅ Invoice paid for user ${userId}. Counter reset.`);
        }
        break;
      }

      // ====================================================================
      // PAYMENT FAILED — Flag the subscription
      // ====================================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.cognitoUserId;

        if (userId) {
          await upsertSubscription(userId, { status: 'past_due' });
          console.log(`[Webhook] ⚠️ Payment failed for user ${userId}. Status: past_due.`);
        }
        break;
      }

      // ====================================================================
      // SUBSCRIPTION UPDATED — Plan change or cancel-at-period-end
      // ====================================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.cognitoUserId;

        if (userId) {
          const priceId = subscription.items.data[0]?.price?.id || '';
          const tier = resolveTier(priceId);
          const status = subscription.status === 'active' ? 'active' : 
                         subscription.status === 'past_due' ? 'past_due' :
                         subscription.status === 'canceled' ? 'canceled' : 'active';

          await upsertSubscription(userId, {
            tier,
            status: status as any,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          });
          console.log(`[Webhook] ✅ Subscription updated for user ${userId}. Tier: ${tier}, Cancel at end: ${subscription.cancel_at_period_end}`);
        }
        break;
      }

      // ====================================================================
      // SUBSCRIPTION DELETED — Downgrade to free
      // ====================================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.cognitoUserId;

        if (userId) {
          await upsertSubscription(userId, {
            tier: 'free',
            status: 'canceled',
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            // We do not strip credits away, they keep what they paid for until they use them
          });
          console.log(`[Webhook] ✅ Subscription deleted for user ${userId}. Downgraded to free.`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`[Webhook] Error processing event ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe from retrying (we logged the error)
    return NextResponse.json({ received: true, error: err.message });
  }
}
