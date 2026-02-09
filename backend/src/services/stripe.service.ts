import Stripe from 'stripe';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!config.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(config.stripe.secretKey);
  }
  return stripeInstance;
}

export class StripeService {
  /**
   * Get or create a Stripe customer by email
   */
  async getOrCreateCustomer(
    email: string,
    name?: string,
    shopDomain?: string
  ): Promise<Stripe.Customer> {
    const stripe = getStripe();

    // Search for existing customer by email
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      return existing.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: shopDomain ? { shop_domain: shopDomain } : {},
    });

    logger.info('Created Stripe customer', { customerId: customer.id, email });
    return customer;
  }

  /**
   * Create a Stripe Checkout session for subscription
   */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    shopDomain: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = getStripe();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { shop_domain: params.shopDomain },
      subscription_data: {
        metadata: { shop_domain: params.shopDomain },
        ...(params.trialDays ? { trial_period_days: params.trialDays } : {}),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    logger.info('Created Stripe Checkout session', {
      sessionId: session.id,
      shopDomain: params.shopDomain,
    });
    return session;
  }

  /**
   * Create a Stripe Customer Portal session
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Verify and construct a Stripe webhook event
   */
  constructEvent(
    payload: Buffer | string,
    signature: string
  ): Stripe.Event {
    const stripe = getStripe();

    if (!config.stripe.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    );
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const stripe = getStripe();
    return stripe.subscriptions.retrieve(subscriptionId);
  }
}

export const stripeService = new StripeService();
