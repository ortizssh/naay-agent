import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyService } from '@/services/shopify.service';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { webhookRateLimiter } from '@/middleware/rateLimiter';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const shopifyService = new ShopifyService();
const supabaseService = new SupabaseService();
const queueService = new QueueService();

// Apply rate limiting to webhooks
router.use(webhookRateLimiter);

// Webhook verification middleware
const verifyWebhook = (req: Request, res: Response, next: NextFunction) => {
  try {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const topic = req.get('X-Shopify-Topic');

    if (!hmacHeader || !shopDomain || !topic) {
      throw new AppError('Missing required webhook headers', 400);
    }

    const body = req.body;
    const rawBody = Buffer.isBuffer(body)
      ? body.toString()
      : JSON.stringify(body);

    const isValid = shopifyService.verifyWebhook(rawBody, hmacHeader);

    if (!isValid) {
      logger.warn('Invalid webhook signature', { shopDomain, topic });
      throw new AppError('Invalid webhook signature', 401);
    }

    // Add webhook data to request
    (req as any).shopDomain = shopDomain;
    (req as any).topic = topic;
    (req as any).webhookData =
      typeof body === 'string' ? JSON.parse(body) : body;

    next();
  } catch (error) {
    next(error);
  }
};

// Product created webhook
router.post(
  '/products/create',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const product = (req as any).webhookData;

      logger.info(`Product created webhook received for shop: ${shopDomain}`, {
        productId: product.id,
        productTitle: product.title,
      });

      // Get store access token
      const store = await supabaseService.getStore(shopDomain);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Log webhook event
      await logWebhookEvent(shopDomain, 'products/create', product);

      // Queue product sync
      await queueService.addProductSyncJob(
        shopDomain,
        store.access_token,
        product.id.toString(),
        'product_create'
      );

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Product create webhook error:', error);
      next(error);
    }
  }
);

// Product updated webhook
router.post(
  '/products/update',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const product = (req as any).webhookData;

      logger.info(`Product updated webhook received for shop: ${shopDomain}`, {
        productId: product.id,
        productTitle: product.title,
      });

      // Get store access token
      const store = await supabaseService.getStore(shopDomain);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Log webhook event
      await logWebhookEvent(shopDomain, 'products/update', product);

      // Queue product sync
      await queueService.addProductSyncJob(
        shopDomain,
        store.access_token,
        product.id.toString(),
        'product_update'
      );

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Product update webhook error:', error);
      next(error);
    }
  }
);

// Product deleted webhook
router.post(
  '/products/delete',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const product = (req as any).webhookData;

      logger.info(`Product deleted webhook received for shop: ${shopDomain}`, {
        productId: product.id,
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, 'products/delete', product);

      // Queue product deletion
      await queueService.addProductDeleteJob(shopDomain, product.id.toString());

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Product delete webhook error:', error);
      next(error);
    }
  }
);

// App uninstalled webhook
router.post(
  '/app/uninstalled',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;

      logger.info(`App uninstalled webhook received for shop: ${shopDomain}`);

      // Log webhook event
      await logWebhookEvent(shopDomain, 'app/uninstalled', {});

      // Here you could:
      // 1. Clean up store data
      // 2. Cancel subscriptions
      // 3. Send notification emails
      // 4. Update billing

      // For now, just mark the store as uninstalled
      const { error } = await (supabaseService as any).serviceClient
        .from('stores')
        .update({
          access_token: null,
          updated_at: new Date(),
        })
        .eq('shop_domain', shopDomain);

      if (error) {
        logger.error('Error updating store after uninstall:', error);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('App uninstall webhook error:', error);
      next(error);
    }
  }
);

// Generic webhook handler for other events
router.post(
  '/:topic',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const topic = (req as any).topic;
      const data = (req as any).webhookData;

      logger.info(`Webhook received for shop: ${shopDomain}`, {
        topic,
        dataKeys: Object.keys(data),
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, topic, data);

      // Handle other webhook types here as needed
      // Examples: orders/create, orders/updated, customers/create, etc.

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Generic webhook error:', error);
      next(error);
    }
  }
);

// Helper function to log webhook events
async function logWebhookEvent(
  shopDomain: string,
  topic: string,
  payload: any
): Promise<void> {
  try {
    const { error } = await (supabaseService as any).serviceClient
      .from('webhook_events')
      .insert({
        shop_domain: shopDomain,
        topic,
        payload,
        verified: true,
        processed: false,
      });

    if (error) {
      logger.error('Error logging webhook event:', error);
    }
  } catch (error) {
    logger.error('Failed to log webhook event:', error);
  }
}

// Webhook status endpoint
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      let query = (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('topic, verified, processed, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (shop) {
        query = query.eq('shop_domain', shop);
      }

      const { data: events, error } = await query;

      if (error) {
        throw new AppError(
          `Failed to fetch webhook events: ${error.message}`,
          500
        );
      }

      // Get summary stats
      const stats = {
        total: events?.length || 0,
        verified: events?.filter(e => e.verified).length || 0,
        processed: events?.filter(e => e.processed).length || 0,
        pending: events?.filter(e => e.verified && !e.processed).length || 0,
      };

      res.json({
        success: true,
        data: {
          stats,
          recentEvents: events?.slice(0, 10) || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
