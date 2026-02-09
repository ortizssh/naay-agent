import { Router, Request, Response, NextFunction } from 'express';
import { stripeService } from '@/services/stripe.service';
import { planService } from '@/services/plan.service';
import { tenantService } from '@/services/tenant.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { config } from '@/utils/config';
import { AppError, TenantPlan } from '@/types';
import jwt from 'jsonwebtoken';

const router = Router();
const supabaseService = new SupabaseService();

const JWT_SECRET =
  process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

// Middleware to verify client auth (same as in client.controller.ts)
async function requireClientAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { data: user, error } = await (supabaseService as any).serviceClient
      .from('admin_users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    if (user.status !== 'active') {
      throw new AppError('Tu cuenta esta suspendida', 403);
    }

    (req as any).user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token invalido', 401));
    } else {
      next(error);
    }
  }
}

/**
 * GET /api/billing/plans
 * Get available plans (public, no auth required)
 */
router.get(
  '/plans',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await planService.getAllPlans();

      // Strip stripe_price_id from response (don't expose to client)
      const safePlans = plans.map(({ stripe_price_id, ...rest }) => rest);

      res.json({
        success: true,
        data: safePlans,
      });
    } catch (error) {
      logger.error('Get billing plans error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout session for a plan
 */
router.post(
  '/checkout',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { planSlug } = req.body;

      if (!planSlug) {
        throw new AppError('Plan requerido', 400);
      }

      // Get the plan
      const plan = await planService.getPlanBySlug(planSlug as TenantPlan);
      if (!plan) {
        throw new AppError('Plan no encontrado', 404);
      }

      // If free plan, just update directly
      if (plan.price === 0) {
        // Get shop domain from client_stores
        const { data: store } = await (supabaseService as any).serviceClient
          .from('client_stores')
          .select('shop_domain')
          .eq('user_id', user.id)
          .single();

        if (store?.shop_domain) {
          await tenantService.updatePlan(store.shop_domain, planSlug as TenantPlan);
        }

        return res.json({
          success: true,
          data: { free: true },
        });
      }

      // Paid plan — need stripe_price_id
      if (!plan.stripe_price_id) {
        throw new AppError(
          'Este plan no tiene configuracion de pago. Contacte soporte.',
          400
        );
      }

      // Get shop domain
      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('shop_domain')
        .eq('user_id', user.id)
        .single();

      const shopDomain = store?.shop_domain || '';

      // Get or create Stripe customer
      const customer = await stripeService.getOrCreateCustomer(
        user.email,
        `${user.first_name} ${user.last_name}`,
        shopDomain
      );

      // Save stripe_customer_id to tenant
      if (shopDomain) {
        await tenantService.updateStripeInfo(shopDomain, {
          stripe_customer_id: customer.id,
          billing_email: user.email,
        });
      }

      // Create Checkout session
      const appUrl = config.shopify.appUrl;
      const session = await stripeService.createCheckoutSession({
        customerId: customer.id,
        priceId: plan.stripe_price_id,
        shopDomain,
        successUrl: `${appUrl}/app?checkout=success&step=4`,
        cancelUrl: `${appUrl}/app?checkout=cancelled&step=3`,
        trialDays: 14,
      });

      res.json({
        success: true,
        data: { checkoutUrl: session.url },
      });
    } catch (error) {
      logger.error('Create checkout error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session
 */
router.post(
  '/portal',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Get shop domain and stripe customer ID
      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('shop_domain')
        .eq('user_id', user.id)
        .single();

      if (!store?.shop_domain) {
        throw new AppError('Tienda no encontrada', 404);
      }

      const tenant = await tenantService.getTenant(store.shop_domain);
      if (!tenant?.stripe_customer_id) {
        throw new AppError(
          'No se encontro informacion de facturacion. Selecciona un plan primero.',
          400
        );
      }

      const appUrl = config.shopify.appUrl;
      const session = await stripeService.createPortalSession(
        tenant.stripe_customer_id,
        `${appUrl}/app`
      );

      res.json({
        success: true,
        data: { portalUrl: session.url },
      });
    } catch (error) {
      logger.error('Create portal session error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/billing/status
 * Get current billing status
 */
router.get(
  '/status',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('shop_domain')
        .eq('user_id', user.id)
        .single();

      if (!store?.shop_domain) {
        return res.json({
          success: true,
          data: { plan: 'free', status: 'active', subscription: null },
        });
      }

      const tenant = await tenantService.getTenant(store.shop_domain);
      if (!tenant) {
        return res.json({
          success: true,
          data: { plan: 'free', status: 'active', subscription: null },
        });
      }

      let subscription = null;
      if (tenant.stripe_subscription_id) {
        try {
          const sub = await stripeService.getSubscription(
            tenant.stripe_subscription_id
          );
          subscription = {
            id: sub.id,
            status: sub.status,
            currentPeriodEnd: new Date(
              (sub as any).current_period_end * 1000
            ).toISOString(),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            trialEnd: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          };
        } catch (err) {
          logger.warn('Failed to fetch Stripe subscription:', err);
        }
      }

      res.json({
        success: true,
        data: {
          plan: tenant.plan,
          status: tenant.status,
          trialEndsAt: tenant.trial_ends_at || null,
          subscription,
        },
      });
    } catch (error) {
      logger.error('Get billing status error:', error);
      next(error);
    }
  }
);

export default router;
