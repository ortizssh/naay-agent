import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyService } from '@/services/shopify.service';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';
import { webhookRateLimiter } from '@/middleware/rateLimiter';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const shopifyService = new ShopifyService();
const supabaseService = new SupabaseService();
const queueService = new QueueService();
const simpleConversionTracker = new SimpleConversionTracker();

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

// Orders created webhook - track new orders for conversion attribution
router.post(
  '/orders/create',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const order = (req as any).webhookData;

      logger.info(`Order created webhook received for shop: ${shopDomain}`, {
        orderId: order.id,
        orderNumber: order.order_number,
        totalPrice: order.total_price,
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, 'orders/create', order);

      // Track order completion for conversion attribution (both systems)
      await trackOrderCompletion(shopDomain, order);
      await trackSimpleOrderCompletion(shopDomain, order);

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Order create webhook error:', error);
      next(error);
    }
  }
);

// Orders paid webhook - track when orders are actually paid
router.post(
  '/orders/paid',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const order = (req as any).webhookData;

      logger.info(`Order paid webhook received for shop: ${shopDomain}`, {
        orderId: order.id,
        orderNumber: order.order_number,
        totalPrice: order.total_price,
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, 'orders/paid', order);

      // Update order status and recalculate attribution if needed
      await updateOrderStatus(shopDomain, order.id.toString(), 'paid');

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Order paid webhook error:', error);
      next(error);
    }
  }
);

// Orders updated webhook - track order status changes
router.post(
  '/orders/updated',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const order = (req as any).webhookData;

      logger.info(`Order updated webhook received for shop: ${shopDomain}`, {
        orderId: order.id,
        orderNumber: order.order_number,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, 'orders/updated', order);

      // Update order status
      await updateOrderStatus(
        shopDomain,
        order.id.toString(),
        order.financial_status,
        order.fulfillment_status
      );

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Order updated webhook error:', error);
      next(error);
    }
  }
);

// Carts update webhook - track cart modifications (if available)
router.post(
  '/carts/update',
  verifyWebhook,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = (req as any).shopDomain;
      const cart = (req as any).webhookData;

      logger.info(`Cart updated webhook received for shop: ${shopDomain}`, {
        cartId: cart.id,
        lineItemsCount: cart.line_items?.length || 0,
      });

      // Log webhook event
      await logWebhookEvent(shopDomain, 'carts/update', cart);

      // Track cart additions (this webhook might not be available in all Shopify plans)
      await trackCartUpdates(shopDomain, cart);

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Cart update webhook error:', error);
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
      // Examples: customers/create, checkouts/create, etc.

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

// Helper function to track order completion for conversion attribution
async function trackOrderCompletion(
  shopDomain: string,
  order: any
): Promise<void> {
  try {
    const lineItems =
      order.line_items?.map((item: any) => ({
        lineItemId: item.id?.toString(),
        productId: item.product_id?.toString(),
        variantId: item.variant_id?.toString(),
        quantity: parseInt(item.quantity) || 1,
        unitPrice: parseFloat(item.price) || 0,
        totalPrice: parseFloat(item.price) * (parseInt(item.quantity) || 1),
        productTitle: item.title,
        variantTitle: item.variant_title,
      })) || [];

    // Order tracking now handled by trackSimpleOrderCompletion above

    logger.info('Order completion tracked for conversion attribution', {
      shopDomain,
      orderId: order.id,
      lineItemsCount: lineItems.length,
    });
  } catch (error) {
    logger.error('Error tracking order completion:', error);
  }
}

// Helper function to update order status
async function updateOrderStatus(
  shopDomain: string,
  orderId: string,
  financialStatus?: string,
  fulfillmentStatus?: string
): Promise<void> {
  try {
    const updateData: any = {};
    if (financialStatus) updateData.financial_status = financialStatus;
    if (fulfillmentStatus) updateData.fulfillment_status = fulfillmentStatus;

    const { error } = await (supabaseService as any).serviceClient
      .from('order_completion_events')
      .update(updateData)
      .eq('shop_domain', shopDomain)
      .eq('order_id', orderId);

    if (error) {
      logger.error('Error updating order status:', error);
    } else {
      logger.info('Order status updated', {
        shopDomain,
        orderId,
        financialStatus,
        fulfillmentStatus,
      });
    }
  } catch (error) {
    logger.error('Error updating order status:', error);
  }
}

// Helper function to track cart updates (limited webhook availability)
async function trackCartUpdates(shopDomain: string, cart: any): Promise<void> {
  try {
    // This webhook might not be available in all Shopify plans
    // We'll track what we can from the cart data
    const lineItems = cart.line_items || [];

    for (const item of lineItems) {
      // We don't have the session context here, so we can't easily attribute to AI recommendations
      // This is mainly for tracking cart activity patterns
      // Cart tracking handled by simplified conversion system
    }

    logger.info('Cart updates tracked', {
      shopDomain,
      cartId: cart.id,
      lineItemsCount: lineItems.length,
    });
  } catch (error) {
    logger.error('Error tracking cart updates:', error);
  }
}

// Helper function to track order completion in simplified system
async function trackSimpleOrderCompletion(
  shopDomain: string,
  order: any
): Promise<void> {
  try {
    const orderEvent = {
      orderId: order.id.toString(),
      shopDomain,
      customerId: order.customer?.id?.toString(),
      products: (order.line_items || [])
        .map((item: any) => ({
          productId: (item.product_id || item.variant?.product_id)?.toString(),
          quantity: parseInt(item.quantity) || 1,
          price: parseFloat(item.price) || 0,
        }))
        .filter((p: any) => p.productId), // Only include items with product IDs
      totalAmount: parseFloat(order.total_price) || 0,
      createdAt: new Date(order.created_at),
    };

    logger.info('Processing order for simple conversions', {
      shopDomain,
      orderId: order.id,
      productsCount: orderEvent.products.length,
      totalAmount: orderEvent.totalAmount,
    });

    const conversions =
      await simpleConversionTracker.processOrderForConversions(orderEvent);

    if (conversions.length > 0) {
      logger.info('Simple conversions detected!', {
        shopDomain,
        orderId: order.id,
        conversionsCount: conversions.length,
        conversions: conversions.map(c => ({
          sessionId: c.sessionId,
          productId: c.productId,
          minutesToConversion: c.minutesToConversion,
          confidence: c.confidence,
        })),
      });
    } else {
      logger.info('No conversions found for order', {
        shopDomain,
        orderId: order.id,
      });
    }

    // Clean up expired recommendations
    await simpleConversionTracker.cleanupExpiredRecommendations(shopDomain);
  } catch (error) {
    logger.error('Error tracking simple order completion:', error);
  }
}

export default router;
