/**
 * WooCommerce Authentication Controller
 * Handles store connection and API key validation
 */

import { Router, Request, Response } from 'express';
import { WooCommerceService } from '../services/woocommerce.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * POST /api/woo/connect
 * Connect a WooCommerce store
 *
 * Body:
 * - siteUrl: WooCommerce store URL
 * - consumerKey: WooCommerce REST API Consumer Key
 * - consumerSecret: WooCommerce REST API Consumer Secret
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { siteUrl, consumerKey, consumerSecret } = req.body;

    if (!siteUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: siteUrl, consumerKey, consumerSecret',
      });
    }

    // Validate URL format
    let normalizedUrl: string;
    try {
      const url = new URL(siteUrl);
      normalizedUrl = `${url.protocol}//${url.host}`;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid site URL format',
      });
    }

    logger.info('Attempting WooCommerce connection', {
      siteUrl: normalizedUrl,
    });

    // Test connection with provided credentials
    const wooService = new WooCommerceService({
      siteUrl: normalizedUrl,
      consumerKey,
      consumerSecret,
    });

    const connectionResult = await wooService.testConnection();

    if (!connectionResult.success) {
      return res.status(401).json({
        success: false,
        error: 'Failed to connect to WooCommerce store',
        details: connectionResult.error,
      });
    }

    // Generate webhook secret for this store
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Store credentials in database
    // First check if store already exists
    const existingStore = await supabaseService.getStore(normalizedUrl);

    if (existingStore) {
      // Update existing store
      await (supabaseService as any).serviceClient
        .from('stores')
        .update({
          platform: 'woocommerce',
          site_url: normalizedUrl,
          credentials: {
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
          },
          webhook_secret: webhookSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', normalizedUrl);
    } else {
      // Create new store
      await (supabaseService as any).serviceClient.from('stores').insert({
        shop_domain: normalizedUrl,
        platform: 'woocommerce',
        site_url: normalizedUrl,
        access_token: 'woocommerce', // Placeholder, actual auth uses credentials
        credentials: {
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        },
        webhook_secret: webhookSecret,
        installed_at: new Date().toISOString(),
        scopes: 'read_write',
      });
    }

    logger.info('WooCommerce store connected successfully', {
      siteUrl: normalizedUrl,
      storeName: connectionResult.storeName,
    });

    return res.json({
      success: true,
      data: {
        siteUrl: normalizedUrl,
        storeName: connectionResult.storeName,
        woocommerceVersion: connectionResult.woocommerceVersion,
        currency: connectionResult.currency,
        webhookSecret, // Return so it can be configured in WooCommerce
      },
    });
  } catch (error) {
    logger.error('Error connecting WooCommerce store:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/woo/test-connection
 * Test connection to a WooCommerce store without storing credentials
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { siteUrl, consumerKey, consumerSecret } = req.body;

    if (!siteUrl || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: siteUrl, consumerKey, consumerSecret',
      });
    }

    // Validate URL format
    let normalizedUrl: string;
    try {
      const url = new URL(siteUrl);
      normalizedUrl = `${url.protocol}//${url.host}`;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid site URL format',
      });
    }

    const wooService = new WooCommerceService({
      siteUrl: normalizedUrl,
      consumerKey,
      consumerSecret,
    });

    const connectionResult = await wooService.testConnection();

    if (!connectionResult.success) {
      return res.status(401).json({
        success: false,
        error: 'Failed to connect to WooCommerce store',
        details: connectionResult.error,
      });
    }

    return res.json({
      success: true,
      data: {
        siteUrl: normalizedUrl,
        storeName: connectionResult.storeName,
        woocommerceVersion: connectionResult.woocommerceVersion,
        currency: connectionResult.currency,
      },
    });
  } catch (error) {
    logger.error('Error testing WooCommerce connection:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/woo/disconnect
 * Disconnect a WooCommerce store
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.body;

    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: siteUrl',
      });
    }

    // Normalize URL
    let normalizedUrl: string;
    try {
      const url = new URL(siteUrl);
      normalizedUrl = `${url.protocol}//${url.host}`;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid site URL format',
      });
    }

    // Get store to verify it exists and get credentials for webhook cleanup
    const store = await supabaseService.getStore(normalizedUrl);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
      });
    }

    // Try to delete webhooks from WooCommerce
    try {
      const credentials = (store as any).credentials;
      if (credentials?.consumer_key && credentials?.consumer_secret) {
        const wooService = new WooCommerceService({
          siteUrl: normalizedUrl,
          consumerKey: credentials.consumer_key,
          consumerSecret: credentials.consumer_secret,
        });

        const webhooks = await wooService.listWebhooks(normalizedUrl);
        for (const webhook of webhooks) {
          try {
            await wooService.deleteWebhook(normalizedUrl, webhook.id);
          } catch {
            // Ignore individual webhook deletion errors
          }
        }
      }
    } catch {
      // Ignore webhook cleanup errors
    }

    // Delete store and all associated data
    await (supabaseService as any).serviceClient
      .from('stores')
      .delete()
      .eq('shop_domain', normalizedUrl);

    // Delete products
    await (supabaseService as any).serviceClient
      .from('products')
      .delete()
      .eq('shop_domain', normalizedUrl);

    // Delete embeddings
    await (supabaseService as any).serviceClient
      .from('product_embeddings')
      .delete()
      .eq('shop_domain', normalizedUrl);

    logger.info('WooCommerce store disconnected', { siteUrl: normalizedUrl });

    return res.json({
      success: true,
      message: 'Store disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting WooCommerce store:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/woo/store/:siteUrl
 * Get store information
 */
router.get('/store/:siteUrl', async (req: Request, res: Response) => {
  try {
    const siteUrl = decodeURIComponent(req.params.siteUrl);

    const store = await supabaseService.getStore(siteUrl);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
      });
    }

    // Don't expose credentials
    const { access_token, ...safeStore } = store as any;

    return res.json({
      success: true,
      data: {
        ...safeStore,
        credentials: undefined, // Remove credentials from response
      },
    });
  } catch (error) {
    logger.error('Error fetching WooCommerce store:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/woo/sync-products
 * Trigger product sync for a WooCommerce store
 */
router.post('/sync-products', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.body;

    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: siteUrl',
      });
    }

    // Get store credentials
    const store = await supabaseService.getStore(siteUrl);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
      });
    }

    const credentials = (store as any).credentials;
    if (!credentials?.consumer_key || !credentials?.consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'Store credentials not found',
      });
    }

    // Create WooCommerce service
    const wooService = new WooCommerceService({
      siteUrl,
      consumerKey: credentials.consumer_key,
      consumerSecret: credentials.consumer_secret,
    });

    // Fetch all products
    const products = await wooService.getAllProducts(siteUrl);

    logger.info(`Syncing ${products.length} products from WooCommerce`, {
      siteUrl,
    });

    // Save products to database
    let syncedCount = 0;
    for (const product of products) {
      try {
        // Convert normalized product to Shopify format for compatibility
        // with existing supabase.service.saveProduct method
        await supabaseService.saveProduct(siteUrl, {
          id: product.external_id,
          title: product.title,
          description: product.description,
          handle: product.handle,
          vendor: product.vendor || '',
          product_type: product.product_type || '',
          tags: product.tags,
          status: product.status,
          images: product.images.map(img => ({
            id: img.id,
            src: img.src,
            alt_text: img.alt_text,
            width: img.width || 0,
            height: img.height || 0,
          })),
          variants: product.variants.map(v => ({
            id: v.external_id,
            product_id: product.external_id,
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
          created_at: product.created_at,
          updated_at: product.updated_at,
        });
        syncedCount++;
      } catch (err) {
        logger.error(`Failed to save product ${product.id}:`, err);
      }
    }

    logger.info(`Product sync completed`, {
      siteUrl,
      syncedCount,
      total: products.length,
    });

    return res.json({
      success: true,
      data: {
        synced: syncedCount,
        total: products.length,
      },
    });
  } catch (error) {
    logger.error('Error syncing WooCommerce products:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/woo/setup-webhooks
 * Set up webhooks for a WooCommerce store
 */
router.post('/setup-webhooks', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.body;

    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: siteUrl',
      });
    }

    // Get store credentials
    const store = await supabaseService.getStore(siteUrl);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
      });
    }

    const credentials = (store as any).credentials;
    const webhookSecret = (store as any).webhook_secret;

    if (!credentials?.consumer_key || !credentials?.consumer_secret) {
      return res.status(400).json({
        success: false,
        error: 'Store credentials not found',
      });
    }

    // Create WooCommerce service
    const wooService = new WooCommerceService({
      siteUrl,
      consumerKey: credentials.consumer_key,
      consumerSecret: credentials.consumer_secret,
      webhookSecret,
    });

    // Create webhooks
    const webhooks = await wooService.createWebhooks(siteUrl);

    logger.info(`Created ${webhooks.length} webhooks for WooCommerce store`, {
      siteUrl,
    });

    return res.json({
      success: true,
      data: {
        webhooks: webhooks.map(w => ({
          id: w.id,
          topic: w.topic,
          callbackUrl: w.callback_url,
        })),
      },
    });
  } catch (error) {
    logger.error('Error setting up WooCommerce webhooks:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

export default router;
