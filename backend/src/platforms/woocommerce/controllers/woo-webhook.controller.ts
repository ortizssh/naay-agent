/**
 * WooCommerce Webhook Controller
 * Handles incoming webhooks from WooCommerce stores
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { WooCommerceService } from '../services/woocommerce.service';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { logger } from '@/utils/logger';
import { WooProduct, WooOrder } from '../types';

const router = Router();
const supabaseService = new SupabaseService();
const queueService = new QueueService();

/**
 * Verify WooCommerce webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    logger.warn('Webhook secret not configured - skipping verification');
    return true;
  }

  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}


/**
 * Webhook middleware - verify signature and get store
 */
async function webhookMiddleware(
  req: Request,
  res: Response,
  next: () => void
): Promise<void> {
  const signature = req.headers['x-wc-webhook-signature'] as string;
  const sourceUrl = req.headers['x-wc-webhook-source'] as string;

  if (!sourceUrl) {
    res.status(400).json({ error: 'Missing source header' });
    return;
  }

  // Get store to verify signature
  try {
    const url = new URL(sourceUrl);
    const normalizedUrl = `${url.protocol}//${url.host}`;
    const store = await supabaseService.getStore(normalizedUrl);

    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const webhookSecret = (store as any).webhook_secret;

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const rawBody = (req as any).rawBody?.toString() || JSON.stringify(req.body);
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

      if (!isValid) {
        logger.warn('Invalid webhook signature', { sourceUrl: normalizedUrl });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Attach store to request
    (req as any).wooStore = store;
    next();
  } catch (error) {
    logger.error('Webhook middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/woo/webhooks/product/created
 * Handle product created webhook
 */
router.post('/product/created', webhookMiddleware, async (req: Request, res: Response) => {
  try {
    const product = req.body as WooProduct;
    const store = (req as any).wooStore;
    const siteUrl = store.shop_domain;

    logger.info('WooCommerce product created webhook received', {
      productId: product.id,
      productName: product.name,
      siteUrl,
    });

    // Get store credentials
    const credentials = store.credentials;
    const wooService = new WooCommerceService({
      siteUrl,
      consumerKey: credentials.consumer_key,
      consumerSecret: credentials.consumer_secret,
    });

    // Get full product with variations
    const normalizedProduct = await wooService.getProduct(siteUrl, product.id.toString());

    if (!normalizedProduct) {
      logger.error('Failed to fetch product details', { productId: product.id });
      return res.status(200).json({ received: true });
    }

    // Save product to database
    await supabaseService.saveProduct(siteUrl, {
      id: normalizedProduct.external_id,
      title: normalizedProduct.title,
      description: normalizedProduct.description,
      handle: normalizedProduct.handle,
      vendor: normalizedProduct.vendor || '',
      product_type: normalizedProduct.product_type || '',
      tags: normalizedProduct.tags,
      status: normalizedProduct.status,
      images: normalizedProduct.images.map(img => ({
        id: img.id,
        src: img.src,
        alt_text: img.alt_text,
        width: img.width || 0,
        height: img.height || 0,
      })),
      variants: normalizedProduct.variants.map(v => ({
        id: v.external_id,
        product_id: normalizedProduct.external_id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        compare_at_price: v.compare_at_price,
        inventory_quantity: v.inventory_quantity,
        weight: v.weight || 0,
        weight_unit: v.weight_unit || 'kg',
        requires_shipping: v.requires_shipping,
        taxable: v.taxable,
      })),
      created_at: normalizedProduct.created_at,
      updated_at: normalizedProduct.updated_at,
    });

    // Generate embeddings for product
    const embeddingContent = [
      normalizedProduct.title,
      normalizedProduct.description,
      normalizedProduct.tags.join(' '),
      normalizedProduct.product_type || '',
      normalizedProduct.vendor || '',
    ].filter(Boolean).join(' ');

    try {
      await queueService.addEmbeddingJob(
        siteUrl,
        normalizedProduct.external_id,
        embeddingContent,
        {
          title: normalizedProduct.title,
          description: normalizedProduct.description,
          tags: normalizedProduct.tags,
          price: normalizedProduct.variants[0]?.price || '0',
          vendor: normalizedProduct.vendor,
        }
      );
    } catch (embeddingError) {
      logger.error('Failed to queue embedding job:', embeddingError);
      // Don't fail the webhook if embedding fails
    }

    logger.info('Product created and synced', {
      productId: product.id,
      siteUrl,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing product created webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/woo/webhooks/product/updated
 * Handle product updated webhook
 */
router.post('/product/updated', webhookMiddleware, async (req: Request, res: Response) => {
  try {
    const product = req.body as WooProduct;
    const store = (req as any).wooStore;
    const siteUrl = store.shop_domain;

    logger.info('WooCommerce product updated webhook received', {
      productId: product.id,
      productName: product.name,
      siteUrl,
    });

    // Get store credentials
    const credentials = store.credentials;
    const wooService = new WooCommerceService({
      siteUrl,
      consumerKey: credentials.consumer_key,
      consumerSecret: credentials.consumer_secret,
    });

    // Get full product with variations
    const normalizedProduct = await wooService.getProduct(siteUrl, product.id.toString());

    if (!normalizedProduct) {
      logger.error('Failed to fetch product details', { productId: product.id });
      return res.status(200).json({ received: true });
    }

    // Update product in database
    await supabaseService.saveProduct(siteUrl, {
      id: normalizedProduct.external_id,
      title: normalizedProduct.title,
      description: normalizedProduct.description,
      handle: normalizedProduct.handle,
      vendor: normalizedProduct.vendor || '',
      product_type: normalizedProduct.product_type || '',
      tags: normalizedProduct.tags,
      status: normalizedProduct.status,
      images: normalizedProduct.images.map(img => ({
        id: img.id,
        src: img.src,
        alt_text: img.alt_text,
        width: img.width || 0,
        height: img.height || 0,
      })),
      variants: normalizedProduct.variants.map(v => ({
        id: v.external_id,
        product_id: normalizedProduct.external_id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        compare_at_price: v.compare_at_price,
        inventory_quantity: v.inventory_quantity,
        weight: v.weight || 0,
        weight_unit: v.weight_unit || 'kg',
        requires_shipping: v.requires_shipping,
        taxable: v.taxable,
      })),
      created_at: normalizedProduct.created_at,
      updated_at: normalizedProduct.updated_at,
    });

    // Regenerate embeddings
    const embeddingContent = [
      normalizedProduct.title,
      normalizedProduct.description,
      normalizedProduct.tags.join(' '),
      normalizedProduct.product_type || '',
      normalizedProduct.vendor || '',
    ].filter(Boolean).join(' ');

    try {
      await queueService.addEmbeddingJob(
        siteUrl,
        normalizedProduct.external_id,
        embeddingContent,
        {
          title: normalizedProduct.title,
          description: normalizedProduct.description,
          tags: normalizedProduct.tags,
          price: normalizedProduct.variants[0]?.price || '0',
          vendor: normalizedProduct.vendor,
        }
      );
    } catch (embeddingError) {
      logger.error('Failed to queue embedding job:', embeddingError);
    }

    logger.info('Product updated and synced', {
      productId: product.id,
      siteUrl,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing product updated webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/woo/webhooks/product/deleted
 * Handle product deleted webhook
 */
router.post('/product/deleted', webhookMiddleware, async (req: Request, res: Response) => {
  try {
    const product = req.body as { id: number };
    const store = (req as any).wooStore;
    const siteUrl = store.shop_domain;

    logger.info('WooCommerce product deleted webhook received', {
      productId: product.id,
      siteUrl,
    });

    // Delete product from database
    await (supabaseService as any).serviceClient
      .from('products')
      .delete()
      .eq('shop_domain', siteUrl)
      .eq('id', product.id.toString());

    // Delete associated variants
    await (supabaseService as any).serviceClient
      .from('product_variants')
      .delete()
      .eq('shop_domain', siteUrl)
      .eq('product_id', product.id.toString());

    // Delete associated embeddings
    await (supabaseService as any).serviceClient
      .from('product_embeddings')
      .delete()
      .eq('shop_domain', siteUrl)
      .eq('product_id', product.id.toString());

    logger.info('Product deleted', {
      productId: product.id,
      siteUrl,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing product deleted webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/woo/webhooks/order/created
 * Handle order created webhook (for conversion tracking)
 */
router.post('/order/created', webhookMiddleware, async (req: Request, res: Response) => {
  try {
    const order = req.body as WooOrder;
    const store = (req as any).wooStore;
    const siteUrl = store.shop_domain;

    logger.info('WooCommerce order created webhook received', {
      orderId: order.id,
      orderNumber: order.number,
      siteUrl,
    });

    // Log order for conversion tracking
    try {
      await (supabaseService as any).serviceClient
        .from('analytics_events')
        .insert({
          shop_domain: siteUrl,
          event_type: 'order_created',
          event_data: {
            order_id: order.id,
            order_number: order.number,
            total: order.total,
            currency: order.currency,
            line_items: order.line_items.map(item => ({
              product_id: item.product_id,
              variation_id: item.variation_id,
              quantity: item.quantity,
              total: item.total,
            })),
            customer_id: order.customer_id,
            customer_email: order.billing.email,
          },
        });
    } catch (analyticsError) {
      logger.error('Failed to log order analytics:', analyticsError);
    }

    // Try to attribute conversion to chat sessions
    try {
      // Look for recent chat sessions with cart activity for this customer
      const { data: recentSessions } = await (supabaseService as any).serviceClient
        .from('conversations')
        .select('id, session_id, metadata')
        .eq('shop_domain', siteUrl)
        .or(`metadata->>customer_email.eq.${order.billing.email},metadata->>customer_id.eq.${order.customer_id}`)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentSessions && recentSessions.length > 0) {
        // Mark these sessions as converted
        for (const session of recentSessions) {
          await (supabaseService as any).serviceClient
            .from('chat_conversions')
            .insert({
              shop_domain: siteUrl,
              session_id: session.session_id || session.id,
              order_id: order.id.toString(),
              order_total: order.total,
              currency: order.currency,
              converted_at: new Date().toISOString(),
            });
        }

        logger.info('Conversion attributed to chat sessions', {
          orderId: order.id,
          sessionsCount: recentSessions.length,
        });
      }
    } catch (conversionError) {
      logger.error('Failed to attribute conversion:', conversionError);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing order created webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/woo/webhooks/order/updated
 * Handle order updated webhook
 */
router.post('/order/updated', webhookMiddleware, async (req: Request, res: Response) => {
  try {
    const order = req.body as WooOrder;
    const store = (req as any).wooStore;
    const siteUrl = store.shop_domain;

    logger.info('WooCommerce order updated webhook received', {
      orderId: order.id,
      status: order.status,
      siteUrl,
    });

    // Log order status change
    await (supabaseService as any).serviceClient
      .from('analytics_events')
      .insert({
        shop_domain: siteUrl,
        event_type: 'order_updated',
        event_data: {
          order_id: order.id,
          order_number: order.number,
          status: order.status,
          date_paid: order.date_paid,
          date_completed: order.date_completed,
        },
      });

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing order updated webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Generic webhook handler for unknown topics
 */
router.post('/:resource/:action', async (req: Request, res: Response) => {
  const { resource, action } = req.params;

  logger.info('Unhandled WooCommerce webhook received', {
    resource,
    action,
    topic: `${resource}.${action}`,
  });

  // Log the webhook event for debugging
  try {
    const sourceUrl = req.headers['x-wc-webhook-source'] as string;
    if (sourceUrl) {
      const url = new URL(sourceUrl);
      const normalizedUrl = `${url.protocol}//${url.host}`;

      await (supabaseService as any).serviceClient
        .from('webhook_events')
        .insert({
          shop_domain: normalizedUrl,
          topic: `woo.${resource}.${action}`,
          payload: req.body,
          processed: false,
        });
    }
  } catch {
    // Ignore logging errors
  }

  return res.status(200).json({ received: true });
});

export default router;
