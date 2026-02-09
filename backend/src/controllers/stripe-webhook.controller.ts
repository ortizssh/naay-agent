import { Router, Request, Response } from 'express';
import { stripeService } from '@/services/stripe.service';
import { tenantService } from '@/services/tenant.service';
import { planService } from '@/services/plan.service';
import { logger } from '@/utils/logger';
import { TenantPlan } from '@/types';

const router = Router();

/**
 * Helper: find plan slug by stripe price ID
 */
async function findPlanByPriceId(priceId: string): Promise<TenantPlan | null> {
  const plans = await planService.getAllPlans();
  const match = plans.find(p => p.stripe_price_id === priceId);
  return match ? match.slug : null;
}

/**
 * POST /api/stripe/webhooks
 * Handle Stripe webhook events
 * NOTE: This endpoint uses express.raw() middleware (configured in index.ts)
 */
router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.warn('Stripe webhook: missing signature');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = stripeService.constructEvent(req.body, signature);
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const shopDomain = session.metadata?.shop_domain;
        const subscriptionId = session.subscription;

        if (!shopDomain) {
          logger.warn('checkout.session.completed: no shop_domain in metadata');
          break;
        }

        // Save subscription ID
        await tenantService.updateStripeInfo(shopDomain, {
          stripe_subscription_id: subscriptionId,
        });

        // Determine plan from subscription's price
        if (subscriptionId) {
          try {
            const sub = await stripeService.getSubscription(subscriptionId);
            const priceId = (sub as any).items?.data?.[0]?.price?.id;
            if (priceId) {
              const planSlug = await findPlanByPriceId(priceId);
              if (planSlug) {
                await tenantService.updatePlan(shopDomain, planSlug);
              }
            }
            // Set status to trial since we create subscriptions with trial
            await tenantService.updateStatus(shopDomain, 'trial');
          } catch (err) {
            logger.error('Error processing checkout subscription:', err);
          }
        }

        logger.info('Checkout completed', { shopDomain, subscriptionId });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const shopDomain = subscription.metadata?.shop_domain;

        if (!shopDomain) {
          logger.warn('subscription.updated: no shop_domain in metadata');
          break;
        }

        // Update status based on subscription status
        if (subscription.status === 'active') {
          await tenantService.updateStatus(shopDomain, 'active');
        } else if (subscription.status === 'trialing') {
          await tenantService.updateStatus(shopDomain, 'trial');
        }

        // Check if plan changed (price ID changed)
        const priceId = subscription.items?.data?.[0]?.price?.id;
        if (priceId) {
          const planSlug = await findPlanByPriceId(priceId);
          if (planSlug) {
            const tenant = await tenantService.getTenant(shopDomain);
            if (tenant && tenant.plan !== planSlug) {
              await tenantService.updatePlan(shopDomain, planSlug);
              logger.info('Plan changed via subscription update', {
                shopDomain,
                from: tenant.plan,
                to: planSlug,
              });
            }
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const shopDomain = subscription.metadata?.shop_domain;

        if (!shopDomain) {
          logger.warn('subscription.deleted: no shop_domain in metadata');
          break;
        }

        // Downgrade to free plan
        await tenantService.updatePlan(shopDomain, 'free');
        await tenantService.updateStatus(shopDomain, 'cancelled');
        await tenantService.updateStripeInfo(shopDomain, {
          stripe_subscription_id: undefined,
        });

        logger.info('Subscription cancelled, downgraded to free', { shopDomain });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        logger.warn('Invoice payment failed', {
          customerId: invoice.customer,
          invoiceId: invoice.id,
        });
        // Stripe handles retries via dunning settings
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          try {
            const sub = await stripeService.getSubscription(subscriptionId);
            const shopDomain = sub.metadata?.shop_domain;
            if (shopDomain) {
              // If was on trial, move to active on first payment
              const tenant = await tenantService.getTenant(shopDomain);
              if (tenant && tenant.status === 'trial') {
                await tenantService.updateStatus(shopDomain, 'active');
                logger.info('Trial -> Active after first payment', { shopDomain });
              }
            }
          } catch (err) {
            logger.error('Error processing invoice.paid:', err);
          }
        }
        break;
      }

      default:
        logger.info('Unhandled Stripe webhook event', { type: event.type });
    }
  } catch (err) {
    logger.error('Error processing Stripe webhook:', err);
    // Still return 200 to avoid retries for processing errors
  }

  res.json({ received: true });
});

export default router;
