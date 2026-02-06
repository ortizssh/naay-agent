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

    // Also create/update client_stores entry for widget config
    const { data: existingClient } = await (
      supabaseService as any
    ).serviceClient
      .from('client_stores')
      .select('id')
      .eq('shop_domain', normalizedUrl)
      .single();

    if (!existingClient) {
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .insert({
          shop_domain: normalizedUrl,
          platform: 'woocommerce',
          widget_enabled: true,
          widget_position: 'bottom-right',
          widget_color: '#6366f1',
          widget_brand_name: connectionResult.storeName || 'Store',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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

/**
 * POST /api/woo/widget-config
 * Update widget configuration for a WooCommerce store
 */
router.post('/widget-config', async (req: Request, res: Response) => {
  try {
    const { siteUrl, config } = req.body;

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

    logger.info('Updating WooCommerce widget config', {
      siteUrl: normalizedUrl,
      config,
    });

    // Build list of possible shop domain formats to try
    const shopVariants: string[] = [normalizedUrl];
    try {
      const url = new URL(normalizedUrl);
      shopVariants.push(url.host); // e.g., "example.com"
      shopVariants.push(url.hostname); // e.g., "example.com" (without port)
      shopVariants.push(`${normalizedUrl}/`); // With trailing slash
    } catch {
      // Ignore parse errors
    }

    logger.info('Trying shop domain variants for update:', { shopVariants });

    // Check if store exists in client_stores (try all variants)
    let existingClient = null;
    let matchedVariant = normalizedUrl;

    for (const variant of shopVariants) {
      const { data } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('id, shop_domain')
        .eq('shop_domain', variant)
        .single();

      if (data) {
        existingClient = data;
        matchedVariant = data.shop_domain; // Use the exact domain from DB
        logger.info('Found existing client_stores with variant:', {
          variant,
          matchedVariant,
        });
        break;
      }
    }

    // Use the matched variant (existing domain in DB) or normalizedUrl for new entries
    const shopDomainToUse = existingClient ? matchedVariant : normalizedUrl;

    const widgetConfig = {
      shop_domain: shopDomainToUse,
      platform: 'woocommerce',
      widget_enabled: config.enabled ?? true,
      widget_position: config.position || 'bottom-right',
      widget_color: config.primaryColor || config.widget_color || '#6366f1',
      widget_secondary_color: config.secondaryColor || '#212120',
      widget_accent_color: config.accentColor || '#cf795e',
      welcome_message: config.greeting || config.welcome_message || '',
      widget_welcome_message_2: config.greeting2 || '',
      widget_subtitle_2: config.subtitle2 || '',
      widget_welcome_message_3: config.greeting3 || '',
      widget_subtitle_3: config.subtitle3 || '',
      widget_rotating_messages_enabled: config.rotatingMessagesEnabled ?? false,
      widget_rotating_messages_interval: config.rotatingMessagesInterval || 5,
      widget_subtitle: config.subtitle || 'Asistente de compras con IA',
      widget_placeholder: config.placeholder || 'Escribe tu mensaje...',
      widget_avatar: config.avatar || '🌿',
      widget_brand_name: config.brandName || 'Kova',
      widget_button_size: config.buttonSize || 72,
      widget_button_style: config.buttonStyle || 'circle',
      widget_show_pulse: config.showPulse ?? true,
      widget_chat_width: config.chatWidth || 420,
      widget_chat_height: config.chatHeight || 600,
      widget_show_promo_message: config.showPromoMessage ?? true,
      widget_show_cart: config.showCart ?? true,
      widget_enable_animations: config.enableAnimations ?? true,
      widget_theme: config.theme || 'light',
      promo_badge_enabled: config.promoBadgeEnabled ?? false,
      promo_badge_discount: config.promoBadgeDiscount || 10,
      promo_badge_text: config.promoBadgeText || 'Descuento especial',
      promo_badge_color: config.promoBadgeColor || '#ef4444',
      promo_badge_shape: config.promoBadgeShape || 'circle',
      promo_badge_position: config.promoBadgePosition || 'right',
      promo_badge_suffix: config.promoBadgeSuffix ?? 'OFF',
      promo_badge_prefix: config.promoBadgePrefix ?? '',
      promo_badge_font_size: config.promoBadgeFontSize || 12,
      suggested_question_1_text:
        config.suggestedQuestion1Text || 'Recomendaciones personalizadas',
      suggested_question_1_message:
        config.suggestedQuestion1Message ||
        '¿Qué productos recomiendas para mí?',
      suggested_question_2_text:
        config.suggestedQuestion2Text || 'Ayuda con mi compra',
      suggested_question_2_message:
        config.suggestedQuestion2Message ||
        '¿Puedes ayudarme a elegir productos?',
      suggested_question_3_text:
        config.suggestedQuestion3Text || 'Información de envío',
      suggested_question_3_message:
        config.suggestedQuestion3Message ||
        '¿Cuáles son las opciones de envío?',
      updated_at: new Date().toISOString(),
    };

    if (existingClient) {
      // Update existing - use the matched variant from DB
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(widgetConfig)
        .eq('shop_domain', matchedVariant);
    } else {
      // Insert new
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .insert({
          ...widgetConfig,
          created_at: new Date().toISOString(),
        });
    }

    logger.info('Widget config updated successfully', {
      siteUrl: normalizedUrl,
    });

    return res.json({
      success: true,
      message: 'Widget configuration updated',
    });
  } catch (error) {
    logger.error('Error updating widget config:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/woo/widget-config/:siteUrl
 * Get widget configuration for a WooCommerce store
 */
router.get('/widget-config/:siteUrl', async (req: Request, res: Response) => {
  try {
    const siteUrl = decodeURIComponent(req.params.siteUrl);

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

    const { data: clientStore, error } = await (
      supabaseService as any
    ).serviceClient
      .from('client_stores')
      .select('*')
      .eq('shop_domain', normalizedUrl)
      .single();

    if (error || !clientStore) {
      return res.status(404).json({
        success: false,
        error: 'Widget configuration not found',
      });
    }

    return res.json({
      success: true,
      data: {
        enabled: clientStore.widget_enabled ?? true,
        position: clientStore.widget_position || 'bottom-right',
        primaryColor: clientStore.widget_color || '#6366f1',
        secondaryColor: clientStore.widget_secondary_color || '#212120',
        accentColor: clientStore.widget_accent_color || '#cf795e',
        greeting: clientStore.welcome_message || '',
        greeting2: clientStore.widget_welcome_message_2 || '',
        subtitle2: clientStore.widget_subtitle_2 || '',
        greeting3: clientStore.widget_welcome_message_3 || '',
        subtitle3: clientStore.widget_subtitle_3 || '',
        rotatingMessagesEnabled:
          clientStore.widget_rotating_messages_enabled ?? false,
        rotatingMessagesInterval:
          clientStore.widget_rotating_messages_interval || 5,
        subtitle: clientStore.widget_subtitle || 'Asistente de compras con IA',
        placeholder: clientStore.widget_placeholder || 'Escribe tu mensaje...',
        avatar: clientStore.widget_avatar || '🌿',
        brandName: clientStore.widget_brand_name || 'Kova',
        buttonSize: clientStore.widget_button_size || 72,
        buttonStyle: clientStore.widget_button_style || 'circle',
        showPulse: clientStore.widget_show_pulse ?? true,
        chatWidth: clientStore.widget_chat_width || 420,
        chatHeight: clientStore.widget_chat_height || 600,
        showPromoMessage: clientStore.widget_show_promo_message ?? true,
        showCart: clientStore.widget_show_cart ?? true,
        enableAnimations: clientStore.widget_enable_animations ?? true,
        theme: clientStore.widget_theme || 'light',
        promoBadgeEnabled: clientStore.promo_badge_enabled ?? false,
        promoBadgeDiscount: clientStore.promo_badge_discount || 10,
        promoBadgeText: clientStore.promo_badge_text || 'Descuento especial',
        promoBadgeColor: clientStore.promo_badge_color || '#ef4444',
        promoBadgeShape: clientStore.promo_badge_shape || 'circle',
        promoBadgePosition: clientStore.promo_badge_position || 'right',
        promoBadgeSuffix: clientStore.promo_badge_suffix ?? 'OFF',
        promoBadgePrefix: clientStore.promo_badge_prefix ?? '',
        promoBadgeFontSize: clientStore.promo_badge_font_size || 12,
      },
    });
  } catch (error) {
    logger.error('Error fetching widget config:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
