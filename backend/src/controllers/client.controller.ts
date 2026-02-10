import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { ShopifyService } from '@/services/shopify.service';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';
import { config } from '@/utils/config';

const router = Router();
const supabaseService = new SupabaseService();
const shopifyService = new ShopifyService();

const JWT_SECRET =
  process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

// Middleware to verify client auth
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

    // Verify user exists and is a client
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
 * GET /api/client/dashboard
 * Get client dashboard stats
 */
router.get(
  '/dashboard',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Get client's stores from client_stores (new flow)
      const { data: stores, error: storesError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('*')
        .eq('user_id', user.id);

      if (storesError) {
        throw new AppError('Error al obtener tiendas', 500);
      }

      let allStores = stores || [];
      let totalProducts = 0;

      // If user has a linked shop_domain but no client_stores, check legacy stores table
      if (allStores.length === 0 && user.shop_domain) {
        const { data: legacyStore } = await (
          supabaseService as any
        ).serviceClient
          .from('stores')
          .select('shop_domain, installed_at, widget_enabled')
          .eq('shop_domain', user.shop_domain)
          .single();

        if (legacyStore) {
          // Get product count
          const { count: productCount } = await (
            supabaseService as any
          ).serviceClient
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', legacyStore.shop_domain);

          allStores = [
            {
              shop_domain: legacyStore.shop_domain,
              status: 'active',
              products_synced: productCount || 0,
              created_at: legacyStore.installed_at,
            },
          ];
          totalProducts = productCount || 0;
        }
      } else {
        totalProducts = allStores.reduce(
          (sum: number, s: any) => sum + (s.products_synced || 0),
          0
        );
      }

      const activeStores = allStores.filter(
        (s: any) => s.status === 'active' || s.status === 'connected'
      );

      // Resolve real plan from tenants table
      let realPlan = user.plan;
      if (user.shop_domain) {
        const { data: tenant } = await (supabaseService as any).serviceClient
          .from('tenants')
          .select('plan')
          .eq('shop_domain', user.shop_domain)
          .single();
        if (tenant?.plan) realPlan = tenant.plan;
      }

      res.json({
        success: true,
        data: {
          totalStores: allStores.length,
          activeStores: activeStores.length,
          totalProducts,
          onboardingCompleted: user.onboarding_completed,
          onboardingStep: user.onboarding_step,
          plan: realPlan,
        },
      });
    } catch (error) {
      logger.error('Client dashboard error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/store
 * Get client's connected store
 */
router.get(
  '/store',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('Error al obtener tienda', 500);
      }

      res.json({
        success: true,
        data: store || null,
      });
    } catch (error) {
      logger.error('Get store error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/client/store/connect
 * Initialize store connection (start OAuth)
 */
router.post(
  '/store/connect',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { shopDomain, platform } = req.body;

      if (!shopDomain) {
        throw new AppError('Dominio de tienda requerido', 400);
      }

      // Normalize shop domain
      let normalizedDomain = shopDomain.toLowerCase().trim();
      if (!normalizedDomain.includes('.myshopify.com')) {
        normalizedDomain = `${normalizedDomain}.myshopify.com`;
      }

      // Check if store already exists for this user
      const { data: existingStore } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('shop_domain', normalizedDomain)
        .single();

      let store = existingStore;

      if (existingStore && existingStore.status === 'active') {
        throw new AppError('Esta tienda ya esta conectada', 409);
      }

      if (!existingStore) {
        // Create pending store record
        const { data: newStore, error } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .insert({
            user_id: user.id,
            shop_domain: normalizedDomain,
            platform: platform || 'shopify',
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          logger.error('Error creating store:', error);
          throw new AppError('Error al crear tienda', 500);
        }
        store = newStore;
      }

      // Generate OAuth URL
      const scopes = 'read_products,write_products,read_orders,read_customers';
      const redirectUri = `${config.shopify.appUrl}/api/client/oauth/callback`;
      const state = Buffer.from(
        JSON.stringify({ userId: user.id, storeId: store.id })
      ).toString('base64');

      const oauthUrl =
        `https://${normalizedDomain}/admin/oauth/authorize` +
        `?client_id=${config.shopify.apiKey}` +
        `&scope=${scopes}` +
        `&redirect_uri=${redirectUri}` +
        `&state=${state}`;

      res.json({
        success: true,
        data: {
          storeId: store.id,
          oauthUrl,
        },
      });
    } catch (error) {
      logger.error('Store connect error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/oauth/callback
 * Handle OAuth callback from Shopify
 */
router.get(
  '/oauth/callback',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { code, state, shop } = req.query;

      if (!code || !state || !shop) {
        return res.redirect('/admin?error=oauth_failed');
      }

      // Decode state
      let stateData;
      try {
        stateData = JSON.parse(
          Buffer.from(state as string, 'base64').toString()
        );
      } catch {
        return res.redirect('/admin?error=invalid_state');
      }

      const { userId, storeId } = stateData;

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: config.shopify.apiKey,
            client_secret: config.shopify.apiSecret,
            code,
          }),
        }
      );

      if (!tokenResponse.ok) {
        logger.error('OAuth token exchange failed');
        return res.redirect('/admin?error=token_exchange_failed');
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };
      const accessToken = tokenData.access_token;

      // Fetch shop info from Shopify API
      let shopInfo: {
        name: string;
        email: string;
        domain: string;
        currency: string;
        timezone: string;
        country: string;
        locale: string;
      } | null = null;
      try {
        shopInfo = await shopifyService.getShopInfo(
          shop as string,
          accessToken
        );
        logger.info('Fetched shop info', {
          shop,
          shopInfo: { name: shopInfo.name, currency: shopInfo.currency },
        });
      } catch (err) {
        logger.error('Failed to fetch shop info, continuing without it:', err);
      }

      // Update store with access token and shop metadata
      const clientStoreUpdate: any = {
        access_token: accessToken,
        status: 'connected',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000
        ).toISOString(), // 14 days trial
      };

      if (shopInfo) {
        clientStoreUpdate.shop_name = shopInfo.name;
        clientStoreUpdate.shop_email = shopInfo.email;
        clientStoreUpdate.shop_currency = shopInfo.currency;
        clientStoreUpdate.shop_country = shopInfo.country;
        clientStoreUpdate.shop_timezone = shopInfo.timezone;
        clientStoreUpdate.shop_locale = shopInfo.locale;
        clientStoreUpdate.widget_brand_name = shopInfo.name;
      }

      const { error: updateError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update(clientStoreUpdate)
        .eq('id', storeId);

      if (updateError) {
        logger.error('Error updating store:', updateError);
        return res.redirect('/admin?error=update_failed');
      }

      // Update user onboarding step
      await (supabaseService as any).serviceClient
        .from('admin_users')
        .update({
          onboarding_step: 2,
        })
        .eq('id', userId);

      // Also sync to main stores table
      const { data: existingShop } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .select('id')
        .eq('shop_domain', shop)
        .single();

      const storesData: any = {
        shop_domain: shop,
        access_token: accessToken,
        status: 'active',
      };
      if (shopInfo) {
        storesData.shop_name = shopInfo.name;
        storesData.shop_email = shopInfo.email;
        storesData.shop_currency = shopInfo.currency;
        storesData.shop_country = shopInfo.country;
        storesData.shop_timezone = shopInfo.timezone;
      }

      if (!existingShop) {
        await (supabaseService as any).serviceClient
          .from('stores')
          .insert(storesData);
      } else {
        await (supabaseService as any).serviceClient
          .from('stores')
          .update(storesData)
          .eq('shop_domain', shop);
      }

      // Update tenants table with shop metadata
      if (shopInfo) {
        await (supabaseService as any).serviceClient
          .from('tenants')
          .update({
            shop_name: shopInfo.name,
            shop_email: shopInfo.email,
          })
          .eq('shop_domain', shop);
      }

      logger.info('OAuth successful', { userId, storeId, shop });

      // Redirect to onboarding step 2 (StoreInfo)
      res.redirect('/admin?oauth=success&step=2');
    } catch (error) {
      logger.error('OAuth callback error:', error);
      res.redirect('/admin?error=oauth_error');
    }
  }
);

/**
 * GET /api/client/widget/config
 * Get widget configuration
 */
router.get(
  '/widget/config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'widget_position, widget_color, welcome_message, widget_enabled, chatbot_endpoint'
        )
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('Error al obtener configuracion', 500);
      }

      res.json({
        success: true,
        data: store || {
          widget_position: 'bottom-right',
          widget_color: '#6d5cff',
          welcome_message: 'Hola! Como puedo ayudarte?',
          widget_enabled: true,
          chatbot_endpoint: 'https://n8n.dustkey.com/webhook/kova-chat',
        },
      });
    } catch (error) {
      logger.error('Get widget config error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/client/widget/config
 * Update widget configuration
 */
router.put(
  '/widget/config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const {
        widgetPosition,
        widgetColor,
        welcomeMessage,
        widgetEnabled,
        widgetSecondaryColor,
        widgetAccentColor,
        widgetButtonSize,
        widgetButtonStyle,
        widgetShowPulse,
        widgetChatWidth,
        widgetChatHeight,
        widgetSubtitle,
        widgetPlaceholder,
        widgetAvatar,
        widgetShowPromoMessage,
        widgetShowCart,
        widgetShowContact,
        widgetEnableAnimations,
        widgetTheme,
        widgetBrandName,
        chatbotEndpoint,
      } = req.body;

      const updateData: any = {};

      // Basic settings
      if (widgetPosition) updateData.widget_position = widgetPosition;
      if (widgetColor) updateData.widget_color = widgetColor;
      if (welcomeMessage !== undefined)
        updateData.welcome_message = welcomeMessage;
      if (widgetEnabled !== undefined)
        updateData.widget_enabled = widgetEnabled;

      // Extended design settings
      if (widgetSecondaryColor)
        updateData.widget_secondary_color = widgetSecondaryColor;
      if (widgetAccentColor) updateData.widget_accent_color = widgetAccentColor;
      if (widgetButtonSize !== undefined)
        updateData.widget_button_size = widgetButtonSize;
      if (widgetButtonStyle) updateData.widget_button_style = widgetButtonStyle;
      if (widgetShowPulse !== undefined)
        updateData.widget_show_pulse = widgetShowPulse;
      if (widgetChatWidth !== undefined)
        updateData.widget_chat_width = widgetChatWidth;
      if (widgetChatHeight !== undefined)
        updateData.widget_chat_height = widgetChatHeight;
      if (widgetSubtitle !== undefined)
        updateData.widget_subtitle = widgetSubtitle;
      if (widgetPlaceholder !== undefined)
        updateData.widget_placeholder = widgetPlaceholder;
      if (widgetAvatar !== undefined) updateData.widget_avatar = widgetAvatar;
      if (widgetShowPromoMessage !== undefined)
        updateData.widget_show_promo_message = widgetShowPromoMessage;
      if (widgetShowCart !== undefined)
        updateData.widget_show_cart = widgetShowCart;
      if (widgetShowContact !== undefined)
        updateData.widget_show_contact = widgetShowContact;
      if (widgetEnableAnimations !== undefined)
        updateData.widget_enable_animations = widgetEnableAnimations;
      if (widgetTheme) updateData.widget_theme = widgetTheme;
      if (widgetBrandName !== undefined)
        updateData.widget_brand_name = widgetBrandName;
      if (chatbotEndpoint !== undefined)
        updateData.chatbot_endpoint = chatbotEndpoint;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating widget config:', error);
        throw new AppError('Error al actualizar configuracion', 500);
      }

      res.json({
        success: true,
        data: store,
      });
    } catch (error) {
      logger.error('Update widget config error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/onboarding
 * Get onboarding status
 */
router.get(
  '/onboarding',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Get store status
      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('user_id', user.id)
        .single();

      res.json({
        success: true,
        data: {
          step: user.onboarding_step || 0,
          completed: user.onboarding_completed || false,
          store: store || null,
        },
      });
    } catch (error) {
      logger.error('Get onboarding error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/client/onboarding/step
 * Update onboarding step
 */
router.post(
  '/onboarding/step',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { step, data } = req.body;

      if (step === undefined || step < 0 || step > 6) {
        throw new AppError('Paso invalido', 400);
      }

      const updateData: any = {
        onboarding_step: step,
        onboarding_completed: step >= 6,
      };

      // Update user
      const { error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw new AppError('Error al actualizar onboarding', 500);
      }

      // Step 2 (StoreInfo): update brand name and support email
      if (step === 2 && data) {
        const storeUpdate: any = {};
        if (data.brandName) storeUpdate.widget_brand_name = data.brandName;
        if (data.supportEmail) storeUpdate.shop_email = data.supportEmail;
        if (Object.keys(storeUpdate).length > 0) {
          await (supabaseService as any).serviceClient
            .from('client_stores')
            .update(storeUpdate)
            .eq('user_id', user.id);
        }
      }

      // Step 3 (SelectPlan): update plan on tenant
      if (step === 3 && data?.planSlug) {
        const { data: store } = await (supabaseService as any).serviceClient
          .from('client_stores')
          .select('shop_domain')
          .eq('user_id', user.id)
          .single();

        if (store?.shop_domain) {
          const { TenantService } = await import('@/services/tenant.service');
          const tenantSvc = new TenantService();
          await tenantSvc.updatePlan(store.shop_domain, data.planSlug);
        }
      }

      // Step 4 (widget config): update widget settings
      if (step === 4 && data) {
        await (supabaseService as any).serviceClient
          .from('client_stores')
          .update({
            widget_position: data.widgetPosition || 'bottom-right',
            widget_color: data.widgetColor || '#6d5cff',
            welcome_message:
              data.welcomeMessage || 'Hola! Como puedo ayudarte?',
            widget_brand_name: data.widgetBrandName || undefined,
            widget_subtitle: data.widgetSubtitle || undefined,
          })
          .eq('user_id', user.id);
      }

      // Step 6 (complete): mark store as active
      if (step >= 6) {
        await (supabaseService as any).serviceClient
          .from('client_stores')
          .update({
            status: 'active',
            is_active: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      res.json({
        success: true,
        data: {
          step,
          completed: step >= 6,
        },
      });
    } catch (error) {
      logger.error('Update onboarding error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/store/info
 * Get store info (name, email, currency, etc.)
 */
router.get(
  '/store/info',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'shop_domain, shop_name, shop_email, shop_currency, shop_country, shop_timezone, shop_locale, widget_brand_name, platform'
        )
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('Error al obtener info de tienda', 500);
      }

      res.json({
        success: true,
        data: store || null,
      });
    } catch (error) {
      logger.error('Get store info error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/client/store/info
 * Update store info (brand name, support email)
 */
router.put(
  '/store/info',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { brandName, supportEmail } = req.body;

      const updateData: any = {};
      if (brandName !== undefined) updateData.widget_brand_name = brandName;
      if (supportEmail !== undefined) updateData.shop_email = supportEmail;

      const { error } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        throw new AppError('Error al actualizar info de tienda', 500);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Update store info error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/client/store/sync
 * Trigger product sync
 */
router.post(
  '/store/sync',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('id, shop_domain, access_token, platform')
        .eq('user_id', user.id)
        .single();

      if (storeError || !store) {
        throw new AppError('Tienda no encontrada', 404);
      }

      // Mark sync as in_progress
      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({ sync_status: 'in_progress', sync_total: 0 })
        .eq('id', store.id);

      // Start async sync
      (async () => {
        try {
          const products = await shopifyService.getAllProducts(
            store.shop_domain,
            store.access_token
          );

          // Update total
          await (supabaseService as any).serviceClient
            .from('client_stores')
            .update({ sync_total: products.length })
            .eq('id', store.id);

          let syncedCount = 0;
          for (const product of products) {
            try {
              await supabaseService.saveProduct(store.shop_domain, product);
              syncedCount++;
              // Update progress every 10 products
              if (syncedCount % 10 === 0) {
                await (supabaseService as any).serviceClient
                  .from('client_stores')
                  .update({ products_synced: syncedCount })
                  .eq('id', store.id);
              }
            } catch (err) {
              logger.error(`Failed to save product ${product.id}:`, err);
            }
          }

          // Mark sync complete
          await (supabaseService as any).serviceClient
            .from('client_stores')
            .update({
              sync_status: 'completed',
              products_synced: syncedCount,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', store.id);

          // Create webhooks
          try {
            await shopifyService.createWebhooks(
              store.shop_domain,
              store.access_token
            );
            await (supabaseService as any).serviceClient
              .from('client_stores')
              .update({ webhooks_configured: true })
              .eq('id', store.id);
          } catch (err) {
            logger.error('Failed to create webhooks:', err);
          }

          logger.info(
            `Sync completed for ${store.shop_domain}: ${syncedCount}/${products.length}`
          );
        } catch (err) {
          logger.error('Product sync failed:', err);
          await (supabaseService as any).serviceClient
            .from('client_stores')
            .update({ sync_status: 'failed' })
            .eq('id', store.id);
        }
      })();

      res.json({
        success: true,
        data: { message: 'Sync started' },
      });
    } catch (error) {
      logger.error('Store sync error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/store/sync-status
 * Get sync status
 */
router.get(
  '/store/sync-status',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('sync_status, products_synced, sync_total, webhooks_configured')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new AppError('Error al obtener estado de sync', 500);
      }

      res.json({
        success: true,
        data: {
          status: store?.sync_status || 'pending',
          synced: store?.products_synced || 0,
          total: store?.sync_total || 0,
          webhooksConfigured: store?.webhooks_configured || false,
        },
      });
    } catch (error) {
      logger.error('Get sync status error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/widget-code
 * Get widget installation code snippet
 */
router.get(
  '/widget-code',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'shop_domain, widget_position, widget_color, welcome_message, chatbot_endpoint, chat_mode'
        )
        .eq('user_id', user.id)
        .single();

      if (error || !store) {
        throw new AppError('Tienda no encontrada', 404);
      }

      const chatEndpoint =
        store.chat_mode === 'external' && store.chatbot_endpoint
          ? store.chatbot_endpoint
          : `${config.shopify.appUrl}/api/simple-chat/`;

      const widgetCode = `<!-- Kova AI Chat Widget -->
<script>
  window.KovaConfig = {
    shopDomain: "${store.shop_domain}",
    apiEndpoint: "${config.shopify.appUrl}",
    chatEndpoint: "${chatEndpoint}",
    position: "${store.widget_position}",
    primaryColor: "${store.widget_color}",
    greeting: "${store.welcome_message}",
    placeholder: "Preguntanos sobre tu compra...",
    theme: "light",
    avatar: "🌿",
    enabled: true
  };
</script>
<script src="${config.shopify.appUrl}/widget/kova-widget.js" async></script>`;

      res.json({
        success: true,
        data: {
          code: widgetCode,
          shopDomain: store.shop_domain,
        },
      });
    } catch (error) {
      logger.error('Get widget code error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/analytics
 * Get basic analytics for the client's store
 * Optional query params:
 *   - shop: domain.myshopify.com
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
router.get(
  '/analytics',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const requestedShop = req.query.shop as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      let store: any = null;

      // If admin user requests specific shop, allow it
      if (requestedShop && user.role === 'admin') {
        const { data: legacyStore } = await (
          supabaseService as any
        ).serviceClient
          .from('stores')
          .select('shop_domain, installed_at, updated_at')
          .eq('shop_domain', requestedShop)
          .single();

        if (legacyStore) {
          const { count: productCount } = await (
            supabaseService as any
          ).serviceClient
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', legacyStore.shop_domain);

          store = {
            shop_domain: legacyStore.shop_domain,
            products_synced: productCount || 0,
            last_sync_at: legacyStore.updated_at,
            created_at: legacyStore.installed_at,
          };
        }
      }

      // First try to get store from client_stores (new flow)
      if (!store) {
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select('shop_domain, products_synced, last_sync_at, created_at')
          .eq('user_id', user.id)
          .single();

        if (clientStore) {
          store = clientStore;
        }
      }

      // If not found in client_stores, check if user has a linked shop_domain in their profile
      if (!store && user.shop_domain) {
        // Get store info from stores table (legacy OAuth flow)
        const { data: legacyStore } = await (
          supabaseService as any
        ).serviceClient
          .from('stores')
          .select('shop_domain, installed_at, updated_at')
          .eq('shop_domain', user.shop_domain)
          .single();

        if (legacyStore) {
          // Get product count from products table
          const { count: productCount } = await (
            supabaseService as any
          ).serviceClient
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', legacyStore.shop_domain);

          store = {
            shop_domain: legacyStore.shop_domain,
            products_synced: productCount || 0,
            last_sync_at: legacyStore.updated_at,
            created_at: legacyStore.installed_at,
          };
        }
      }

      if (!store) {
        return res.json({
          success: true,
          data: {
            conversations: 0,
            messages: 0,
            products: 0,
            recommendations: 0,
            conversions: 0,
            lastSync: null,
            storeCreated: null,
            conversationsByDay: [],
          },
        });
      }

      // Build date filters for queries
      const dateFilters = {
        start: startDate ? new Date(startDate).toISOString() : null,
        end: endDate
          ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
          : null,
      };

      // Get chat messages with optional date filter
      let messagesQuery = (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('session_id, created_at')
        .eq('shop_domain', store.shop_domain);

      if (dateFilters.start) {
        messagesQuery = messagesQuery.gte('created_at', dateFilters.start);
      }
      if (dateFilters.end) {
        messagesQuery = messagesQuery.lte('created_at', dateFilters.end);
      }

      const { data: messagesData } = await messagesQuery;

      // Calculate unique sessions (conversations)
      const uniqueSessions = new Set(
        messagesData?.map((m: any) => m.session_id) || []
      );
      const conversationCount = uniqueSessions.size;
      const messageCount = messagesData?.length || 0;

      // Calculate conversations by day for chart
      const conversationsByDay: { date: string; count: number }[] = [];
      if (messagesData && messagesData.length > 0) {
        const sessionsByDay: Record<string, Set<string>> = {};

        messagesData.forEach((msg: any) => {
          const date = new Date(msg.created_at).toISOString().split('T')[0];
          if (!sessionsByDay[date]) {
            sessionsByDay[date] = new Set();
          }
          sessionsByDay[date].add(msg.session_id);
        });

        Object.keys(sessionsByDay)
          .sort()
          .forEach(date => {
            conversationsByDay.push({
              date,
              count: sessionsByDay[date].size,
            });
          });
      }

      // Get recommendations count with date filter
      let recommendationsQuery = (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      if (dateFilters.start) {
        recommendationsQuery = recommendationsQuery.gte(
          'created_at',
          dateFilters.start
        );
      }
      if (dateFilters.end) {
        recommendationsQuery = recommendationsQuery.lte(
          'created_at',
          dateFilters.end
        );
      }

      const { count: recommendationCount } = await recommendationsQuery;

      // Get conversions count with date filter
      let conversionsQuery = (supabaseService as any).serviceClient
        .from('simple_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      if (dateFilters.start) {
        conversionsQuery = conversionsQuery.gte(
          'created_at',
          dateFilters.start
        );
      }
      if (dateFilters.end) {
        conversionsQuery = conversionsQuery.lte('created_at', dateFilters.end);
      }

      const { count: conversionCount } = await conversionsQuery;

      return res.json({
        success: true,
        data: {
          conversations: conversationCount,
          messages: messageCount,
          products: store.products_synced || 0,
          recommendations: recommendationCount || 0,
          conversions: conversionCount || 0,
          lastSync: store.last_sync_at,
          storeCreated: store.created_at,
          conversationsByDay,
        },
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/client/conversions/dashboard
 * Get conversion dashboard data
 */
router.get(
  '/conversions/dashboard',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const days = parseInt(req.query.days as string) || 7;

      // Get shop domain from user or client_stores
      let shopDomain = user.shop_domain;

      if (!shopDomain) {
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select('shop_domain')
          .eq('user_id', user.id)
          .single();
        shopDomain = clientStore?.shop_domain;
      }

      if (!shopDomain) {
        return res.json({
          success: true,
          data: {
            overview: {
              totalRecommendations: 0,
              totalConversions: 0,
              conversionRate: 0,
              totalRevenue: 0,
              averageOrderValue: 0,
              averageTimeToConversion: 0,
            },
            timeline: [],
            topProducts: [],
            recentActivity: [],
            attributionBreakdown: {
              direct: { count: 0, revenue: 0 },
              assisted: { count: 0, revenue: 0 },
              viewThrough: { count: 0, revenue: 0 },
            },
            periodComparison: {
              currentPeriod: { conversions: 0, revenue: 0, rate: 0 },
              previousPeriod: { conversions: 0, revenue: 0, rate: 0 },
              change: { conversions: 0, revenue: 0, rate: 0 },
            },
          },
        });
      }

      const conversionTracker = new SimpleConversionTracker();
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );
      const previousStartDate = new Date(
        startDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      // Get recommendations for the period
      const { data: recommendations } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', shopDomain)
        .gte('recommended_at', startDate.toISOString())
        .lte('recommended_at', endDate.toISOString())
        .order('recommended_at', { ascending: false });

      // Get conversions for the period
      const { data: conversions } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shopDomain)
        .gte('purchased_at', startDate.toISOString())
        .lte('purchased_at', endDate.toISOString())
        .order('purchased_at', { ascending: false });

      // Get previous period conversions for comparison
      const { data: previousConversions } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shopDomain)
        .gte('purchased_at', previousStartDate.toISOString())
        .lt('purchased_at', startDate.toISOString());

      const { data: previousRecommendations } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('id')
        .eq('shop_domain', shopDomain)
        .gte('recommended_at', previousStartDate.toISOString())
        .lt('recommended_at', startDate.toISOString());

      // Calculate overview metrics
      const totalRecommendations = recommendations?.length || 0;
      const totalConversions = conversions?.length || 0;
      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;
      const totalRevenue =
        conversions?.reduce(
          (sum: number, c: any) => sum + (c.order_amount || 0),
          0
        ) || 0;
      const averageOrderValue =
        totalConversions > 0 ? totalRevenue / totalConversions : 0;
      const averageTimeToConversion =
        conversions && conversions.length > 0
          ? conversions.reduce(
              (sum: number, c: any) => sum + (c.minutes_to_conversion || 0),
              0
            ) / conversions.length
          : 0;

      // Calculate timeline data (by day)
      const timelineMap = new Map<
        string,
        { recommendations: number; conversions: number; revenue: number }
      >();

      // Initialize all days in the range
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = d.toISOString().split('T')[0];
        timelineMap.set(dateKey, {
          recommendations: 0,
          conversions: 0,
          revenue: 0,
        });
      }

      // Fill in recommendations
      recommendations?.forEach((r: any) => {
        const dateKey = new Date(r.recommended_at).toISOString().split('T')[0];
        const dayData = timelineMap.get(dateKey);
        if (dayData) {
          dayData.recommendations++;
        }
      });

      // Fill in conversions
      conversions?.forEach((c: any) => {
        const dateKey = new Date(c.purchased_at).toISOString().split('T')[0];
        const dayData = timelineMap.get(dateKey);
        if (dayData) {
          dayData.conversions++;
          dayData.revenue += c.order_amount || 0;
        }
      });

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          recommendations: data.recommendations,
          conversions: data.conversions,
          revenue: Math.round(data.revenue * 100) / 100,
          conversionRate:
            data.recommendations > 0
              ? Math.round(
                  (data.conversions / data.recommendations) * 100 * 100
                ) / 100
              : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate top products
      const productStatsMap = new Map<
        string,
        {
          productId: string;
          productTitle: string;
          recommendations: number;
          conversions: number;
          revenue: number;
        }
      >();

      recommendations?.forEach((r: any) => {
        const key = r.product_id;
        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            productId: r.product_id,
            productTitle: r.product_title || 'Producto',
            recommendations: 0,
            conversions: 0,
            revenue: 0,
          });
        }
        productStatsMap.get(key)!.recommendations++;
      });

      conversions?.forEach((c: any) => {
        const key = c.product_id;
        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            productId: c.product_id,
            productTitle: 'Producto',
            recommendations: 0,
            conversions: 0,
            revenue: 0,
          });
        }
        const stats = productStatsMap.get(key)!;
        stats.conversions++;
        stats.revenue += c.order_amount || 0;
      });

      const topProducts = Array.from(productStatsMap.values())
        .filter(p => p.conversions > 0)
        .map(p => ({
          ...p,
          conversionRate:
            p.recommendations > 0
              ? Math.round((p.conversions / p.recommendations) * 100 * 100) /
                100
              : 0,
          revenue: Math.round(p.revenue * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate recent activity (last 20 items)
      const recentActivity: Array<{
        type: 'recommendation' | 'conversion';
        timestamp: string;
        productTitle: string;
        sessionId: string;
        amount?: number;
      }> = [];

      recommendations?.slice(0, 10).forEach((r: any) => {
        recentActivity.push({
          type: 'recommendation',
          timestamp: r.recommended_at,
          productTitle: r.product_title || 'Producto',
          sessionId: r.session_id,
        });
      });

      conversions?.slice(0, 10).forEach((c: any) => {
        recentActivity.push({
          type: 'conversion',
          timestamp: c.purchased_at,
          productTitle: c.product_id,
          sessionId: c.session_id,
          amount: c.order_amount,
        });
      });

      recentActivity.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Calculate attribution breakdown based on time to conversion
      const attributionBreakdown = {
        direct: { count: 0, revenue: 0 }, // 0-30 min
        assisted: { count: 0, revenue: 0 }, // 30min-24h
        viewThrough: { count: 0, revenue: 0 }, // 24h-7d
      };

      conversions?.forEach((c: any) => {
        const minutes = c.minutes_to_conversion || 0;
        const amount = c.order_amount || 0;

        if (minutes <= 30) {
          attributionBreakdown.direct.count++;
          attributionBreakdown.direct.revenue += amount;
        } else if (minutes <= 1440) {
          // 24 hours
          attributionBreakdown.assisted.count++;
          attributionBreakdown.assisted.revenue += amount;
        } else {
          attributionBreakdown.viewThrough.count++;
          attributionBreakdown.viewThrough.revenue += amount;
        }
      });

      // Round revenues
      attributionBreakdown.direct.revenue =
        Math.round(attributionBreakdown.direct.revenue * 100) / 100;
      attributionBreakdown.assisted.revenue =
        Math.round(attributionBreakdown.assisted.revenue * 100) / 100;
      attributionBreakdown.viewThrough.revenue =
        Math.round(attributionBreakdown.viewThrough.revenue * 100) / 100;

      // Calculate period comparison
      const prevTotalConversions = previousConversions?.length || 0;
      const prevTotalRevenue =
        previousConversions?.reduce(
          (sum: number, c: any) => sum + (c.order_amount || 0),
          0
        ) || 0;
      const prevTotalRecommendations = previousRecommendations?.length || 0;
      const prevConversionRate =
        prevTotalRecommendations > 0
          ? (prevTotalConversions / prevTotalRecommendations) * 100
          : 0;

      const periodComparison = {
        currentPeriod: {
          conversions: totalConversions,
          revenue: Math.round(totalRevenue * 100) / 100,
          rate: Math.round(conversionRate * 100) / 100,
        },
        previousPeriod: {
          conversions: prevTotalConversions,
          revenue: Math.round(prevTotalRevenue * 100) / 100,
          rate: Math.round(prevConversionRate * 100) / 100,
        },
        change: {
          conversions: totalConversions - prevTotalConversions,
          revenue: Math.round((totalRevenue - prevTotalRevenue) * 100) / 100,
          rate: Math.round((conversionRate - prevConversionRate) * 100) / 100,
        },
      };

      return res.json({
        success: true,
        data: {
          overview: {
            totalRecommendations,
            totalConversions,
            conversionRate: Math.round(conversionRate * 100) / 100,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            averageTimeToConversion:
              Math.round(averageTimeToConversion * 100) / 100,
          },
          timeline,
          topProducts,
          recentActivity: recentActivity.slice(0, 20),
          attributionBreakdown,
          periodComparison,
        },
      });
    } catch (error) {
      logger.error('Get conversion dashboard error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/client/conversions/stats
 * Get basic conversion stats
 */
router.get(
  '/conversions/stats',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const days = parseInt(req.query.days as string) || 7;

      let shopDomain = user.shop_domain;

      if (!shopDomain) {
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select('shop_domain')
          .eq('user_id', user.id)
          .single();
        shopDomain = clientStore?.shop_domain;
      }

      if (!shopDomain) {
        return res.json({
          success: true,
          data: {
            totalRecommendations: 0,
            totalConversions: 0,
            conversionRate: 0,
            averageMinutesToConversion: 0,
            totalRevenue: 0,
            topConvertingProducts: [],
          },
        });
      }

      const conversionTracker = new SimpleConversionTracker();
      const stats = await conversionTracker.getConversionStats(
        shopDomain,
        days
      );

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get conversion stats error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/client/conversions/recent
 * Get recent conversions
 */
router.get(
  '/conversions/recent',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const limit = parseInt(req.query.limit as string) || 10;

      let shopDomain = user.shop_domain;

      if (!shopDomain) {
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select('shop_domain')
          .eq('user_id', user.id)
          .single();
        shopDomain = clientStore?.shop_domain;
      }

      if (!shopDomain) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const { data: conversions, error } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shopDomain)
        .order('purchased_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new AppError('Error al obtener conversiones', 500);
      }

      return res.json({
        success: true,
        data: conversions || [],
      });
    } catch (error) {
      logger.error('Get recent conversions error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/client/ai-config
 * Get AI agent configuration for the tenant
 */
router.get(
  '/ai-config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const { data: stores, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'chat_mode, ai_model, agent_name, agent_tone, brand_description, agent_instructions, agent_language, chatbot_endpoint'
        )
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        throw new AppError('Error al obtener configuracion de IA', 500);
      }

      const store = stores?.[0];
      res.json({
        success: true,
        data: store || {
          chat_mode: 'internal',
          ai_model: 'gpt-4.1-mini',
          agent_name: null,
          agent_tone: 'friendly',
          brand_description: null,
          agent_instructions: null,
          agent_language: 'es',
          chatbot_endpoint: null,
        },
      });
    } catch (error) {
      logger.error('Get AI config error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/client/ai-config
 * Update AI agent configuration
 */
router.put(
  '/ai-config',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const {
        chatMode,
        aiModel,
        agentName,
        agentTone,
        brandDescription,
        agentInstructions,
        agentLanguage,
        chatbotEndpoint,
      } = req.body;

      // Validate: external mode requires endpoint
      if (chatMode === 'external' && !chatbotEndpoint) {
        throw new AppError(
          'URL del endpoint es requerida para modo externo',
          400
        );
      }

      const updateData: any = {};
      if (chatMode !== undefined) updateData.chat_mode = chatMode;
      if (aiModel !== undefined) updateData.ai_model = aiModel;
      if (agentName !== undefined) updateData.agent_name = agentName;
      if (agentTone !== undefined) updateData.agent_tone = agentTone;
      if (brandDescription !== undefined)
        updateData.brand_description = brandDescription;
      if (agentInstructions !== undefined)
        updateData.agent_instructions = agentInstructions;
      if (agentLanguage !== undefined)
        updateData.agent_language = agentLanguage;
      if (chatbotEndpoint !== undefined)
        updateData.chatbot_endpoint = chatbotEndpoint;

      // Update all stores for this user (handles duplicate rows)
      const { error } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error updating AI config:', error);
        throw new AppError('Error al actualizar configuracion de IA', 500);
      }

      // Fetch updated config
      const { data: updated } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      res.json({
        success: true,
        data: updated?.[0] || {},
      });
    } catch (error) {
      logger.error('Update AI config error:', error);
      next(error);
    }
  }
);

export default router;
