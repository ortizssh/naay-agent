import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';
import { config } from '@/utils/config';

const router = Router();
const supabaseService = new SupabaseService();

const JWT_SECRET = process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

// Middleware to verify client auth
async function requireClientAuth(req: Request, _res: Response, next: NextFunction) {
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
router.get('/dashboard', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    // Get client's stores
    const { data: stores, error: storesError } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select('*')
      .eq('user_id', user.id);

    if (storesError) {
      throw new AppError('Error al obtener tiendas', 500);
    }

    const activeStores = stores?.filter((s: any) => s.status === 'active') || [];
    const totalProducts = stores?.reduce((sum: number, s: any) => sum + (s.products_synced || 0), 0) || 0;

    res.json({
      success: true,
      data: {
        totalStores: stores?.length || 0,
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
});

/**
 * GET /api/client/store
 * Get client's connected store
 */
router.get('/store', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const { data: store, error } = await (supabaseService as any).serviceClient
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
});

/**
 * POST /api/client/store/connect
 * Initialize store connection (start OAuth)
 */
router.post('/store/connect', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
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
    const { data: existingStore } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select('id')
      .eq('user_id', user.id)
      .eq('shop_domain', normalizedDomain)
      .single();

    if (existingStore) {
      throw new AppError('Esta tienda ya esta conectada', 409);
    }

    // Create pending store record
    const { data: store, error } = await (supabaseService as any).serviceClient
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
    const state = Buffer.from(JSON.stringify({ userId: user.id, storeId: store.id })).toString('base64');

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
});

/**
 * GET /api/client/oauth/callback
 * Handle OAuth callback from Shopify
 */
router.get('/oauth/callback', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { code, state, shop } = req.query;

    if (!code || !state || !shop) {
      return res.redirect('/admin?error=oauth_failed');
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect('/admin?error=invalid_state');
    }

    const { userId, storeId } = stateData;

    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.shopify.apiKey,
        client_secret: config.shopify.apiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('OAuth token exchange failed');
      return res.redirect('/admin?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Update store with access token
    const { error: updateError } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .update({
        access_token: accessToken,
        status: 'connected',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
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
    const { data: existingShop } = await (supabaseService as any).serviceClient
      .from('shops')
      .select('id')
      .eq('shop_domain', shop)
      .single();

    if (!existingShop) {
      await (supabaseService as any).serviceClient
        .from('shops')
        .insert({
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
});

/**
 * GET /api/client/widget/config
 * Get widget configuration
 */
router.get('/widget/config', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const { data: store, error } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select('widget_position, widget_color, welcome_message, widget_enabled')
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
});

/**
 * PUT /api/client/widget/config
 * Update widget configuration
 */
router.put('/widget/config', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { widgetPosition, widgetColor, welcomeMessage, widgetEnabled } = req.body;

    const updateData: any = {};
    if (widgetPosition) updateData.widget_position = widgetPosition;
    if (widgetColor) updateData.widget_color = widgetColor;
    if (welcomeMessage !== undefined) updateData.welcome_message = welcomeMessage;
    if (widgetEnabled !== undefined) updateData.widget_enabled = widgetEnabled;

    const { data: store, error } = await (supabaseService as any).serviceClient
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
});

/**
 * GET /api/client/onboarding
 * Get onboarding status
 */
router.get('/onboarding', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
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
});

/**
 * POST /api/client/onboarding/step
 * Update onboarding step
 */
router.post('/onboarding/step', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
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
          welcome_message: data.welcomeMessage || 'Hola! Como puedo ayudarte?',
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
});

/**
 * GET /api/client/widget-code
 * Get widget installation code snippet
 */
router.get('/widget-code', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const { data: store, error } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select('shop_domain, widget_position, widget_color, welcome_message')
      .eq('user_id', user.id)
      .single();

    if (error || !store) {
      throw new AppError('Tienda no encontrada', 404);
    }

    const widgetCode = `<!-- Naay Chat Widget -->
<script>
  window.naayConfig = {
    shop: "${store.shop_domain}",
    position: "${store.widget_position}",
    primaryColor: "${store.widget_color}",
    welcomeMessage: "${store.welcome_message}"
  };
</script>
<script src="${config.shopify.appUrl}/widget/naay-widget.js" async></script>`;

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
});

/**
 * GET /api/client/analytics
 * Get basic analytics
 */
router.get('/analytics', requireClientAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;

    const { data: store } = await (supabaseService as any).serviceClient
      .from('client_stores')
      .select('shop_domain, products_synced, last_sync_at, created_at')
      .eq('user_id', user.id)
      .single();

    if (!store) {
      return res.json({
        success: true,
        data: {
          conversations: 0,
          messages: 0,
          products: 0,
        },
      });
    }

    // Get conversation count
    const { count: conversationCount } = await (supabaseService as any).serviceClient
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('shop_domain', store.shop_domain);

    return res.json({
      success: true,
      data: {
        conversations: conversationCount || 0,
        products: store.products_synced || 0,
        lastSync: store.last_sync_at,
        storeCreated: store.created_at,
      },
    });
  } catch (error) {
    logger.error('Get analytics error:', error);
    return next(error);
  }
});

export default router;
