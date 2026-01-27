import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';
import { config } from '@/utils/config';

const router = Router();
const supabaseService = new SupabaseService();

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

      res.json({
        success: true,
        data: {
          totalStores: allStores.length,
          activeStores: activeStores.length,
          totalProducts,
          onboardingCompleted: user.onboarding_completed,
          onboardingStep: user.onboarding_step,
          plan: user.plan,
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
        .select('id')
        .eq('user_id', user.id)
        .eq('shop_domain', normalizedDomain)
        .single();

      if (existingStore) {
        throw new AppError('Esta tienda ya esta conectada', 409);
      }

      // Create pending store record
      const { data: store, error } = await (
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

      // Update store with access token
      const { error: updateError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update({
          access_token: accessToken,
          status: 'connected',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toISOString(), // 14 days trial
        })
        .eq('id', storeId);

      if (updateError) {
        logger.error('Error updating store:', updateError);
        return res.redirect('/admin?error=update_failed');
      }

      // Update user onboarding step
      await (supabaseService as any).serviceClient
        .from('admin_users')
        .update({
          onboarding_step: 3,
        })
        .eq('id', userId);

      // Also sync to main shops table
      const { data: existingShop } = await (
        supabaseService as any
      ).serviceClient
        .from('shops')
        .select('id')
        .eq('shop_domain', shop)
        .single();

      if (!existingShop) {
        await (supabaseService as any).serviceClient.from('shops').insert({
          shop_domain: shop,
          access_token: accessToken,
          status: 'active',
        });
      }

      logger.info('OAuth successful', { userId, storeId, shop });

      // Redirect to onboarding step 3
      res.redirect('/admin?oauth=success&step=3');
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
          'widget_position, widget_color, welcome_message, widget_enabled'
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
      const { widgetPosition, widgetColor, welcomeMessage, widgetEnabled } =
        req.body;

      const updateData: any = {};
      if (widgetPosition) updateData.widget_position = widgetPosition;
      if (widgetColor) updateData.widget_color = widgetColor;
      if (welcomeMessage !== undefined)
        updateData.welcome_message = welcomeMessage;
      if (widgetEnabled !== undefined)
        updateData.widget_enabled = widgetEnabled;

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
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

      if (step === undefined || step < 0 || step > 4) {
        throw new AppError('Paso invalido', 400);
      }

      const updateData: any = {
        onboarding_step: step,
        onboarding_completed: step >= 4,
      };

      // Update user
      const { error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw new AppError('Error al actualizar onboarding', 500);
      }

      // If step 3 (widget config), also update store
      if (step === 3 && data) {
        await (supabaseService as any).serviceClient
          .from('client_stores')
          .update({
            widget_position: data.widgetPosition || 'bottom-right',
            widget_color: data.widgetColor || '#6d5cff',
            welcome_message:
              data.welcomeMessage || 'Hola! Como puedo ayudarte?',
          })
          .eq('user_id', user.id);
      }

      // If step 4 (activate), mark store as active
      if (step === 4) {
        await (supabaseService as any).serviceClient
          .from('client_stores')
          .update({
            status: 'active',
            is_active: true,
          })
          .eq('user_id', user.id);
      }

      res.json({
        success: true,
        data: {
          step,
          completed: step >= 4,
        },
      });
    } catch (error) {
      logger.error('Update onboarding error:', error);
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
        .select('shop_domain, widget_position, widget_color, welcome_message')
        .eq('user_id', user.id)
        .single();

      if (error || !store) {
        throw new AppError('Tienda no encontrada', 404);
      }

      const widgetCode = `<!-- Kova AI Chat Widget -->
<script>
  window.KovaConfig = {
    shopDomain: "${store.shop_domain}",
    apiEndpoint: "${config.shopify.appUrl}",
    chatEndpoint: "https://n8n.dustkey.com/webhook/chat-naay",
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
 * Optional query param: ?shop=domain.myshopify.com
 */
router.get(
  '/analytics',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const requestedShop = req.query.shop as string | undefined;

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
          },
        });
      }

      // Get unique sessions count (conversations) from chat_messages
      const { data: sessionsData } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id')
        .eq('shop_domain', store.shop_domain);

      const uniqueSessions = new Set(
        sessionsData?.map((m: any) => m.session_id) || []
      );
      const conversationCount = uniqueSessions.size;

      // Get total messages count
      const { count: messageCount } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      // Get recommendations count
      const { count: recommendationCount } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      // Get conversions count
      const { count: conversionCount } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      return res.json({
        success: true,
        data: {
          conversations: conversationCount,
          messages: messageCount || 0,
          products: store.products_synced || 0,
          recommendations: recommendationCount || 0,
          conversions: conversionCount || 0,
          lastSync: store.last_sync_at,
          storeCreated: store.created_at,
        },
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
      return next(error);
    }
  }
);

export default router;
