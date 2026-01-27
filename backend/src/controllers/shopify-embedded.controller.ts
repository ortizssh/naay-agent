import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * GET /api/shopify/embedded/analytics
 * Get analytics for a shop in embedded Shopify context
 * This endpoint is designed to work without traditional auth,
 * relying on the fact that the shop parameter must match a valid store
 */
router.get(
  '/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!shopDomain) {
        return res.status(400).json({
          success: false,
          error: 'Shop domain is required',
        });
      }

      // Normalize shop domain
      let normalizedShop = shopDomain.toLowerCase().trim();
      if (!normalizedShop.includes('.myshopify.com')) {
        normalizedShop = `${normalizedShop}.myshopify.com`;
      }

      logger.info(`Embedded analytics request for: ${normalizedShop}`, {
        startDate,
        endDate,
      });

      // Build date filters
      const dateFilters = {
        start: startDate ? new Date(startDate).toISOString() : null,
        end: endDate
          ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
          : null,
      };

      // Verify the shop exists in our system (security check)
      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .select('shop_domain, installed_at, updated_at, widget_enabled')
        .eq('shop_domain', normalizedShop)
        .single();

      if (storeError || !store) {
        // Try client_stores as fallback
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select(
            'shop_domain, created_at, last_sync_at, widget_enabled, status, products_synced'
          )
          .eq('shop_domain', normalizedShop)
          .single();

        if (!clientStore) {
          return res.status(404).json({
            success: false,
            error: 'Store not found',
          });
        }

        // Use client_store data
        const storeData = {
          shop_domain: clientStore.shop_domain,
          status: clientStore.status,
          widget_enabled: clientStore.widget_enabled,
          products_synced: clientStore.products_synced || 0,
          last_sync_at: clientStore.last_sync_at,
          created_at: clientStore.created_at,
        };

        // Get analytics from chat_messages
        const analytics = await getAnalyticsForShop(
          normalizedShop,
          dateFilters
        );

        return res.json({
          success: true,
          data: {
            store: storeData,
            analytics,
          },
        });
      }

      // Get product count
      const { count: productCount } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', normalizedShop);

      const storeData = {
        shop_domain: store.shop_domain,
        status: 'active',
        widget_enabled: store.widget_enabled,
        products_synced: productCount || 0,
        last_sync_at: store.updated_at,
        created_at: store.installed_at,
      };

      // Get analytics
      const analytics = await getAnalyticsForShop(normalizedShop, dateFilters);

      return res.json({
        success: true,
        data: {
          store: storeData,
          analytics,
        },
      });
    } catch (error) {
      logger.error('Embedded analytics error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/shopify/embedded/widget/config
 * Update widget configuration from embedded Shopify context
 */
router.put(
  '/widget/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, config } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop domain is required',
        });
      }

      // Normalize shop domain
      let normalizedShop = shop.toLowerCase().trim();
      if (!normalizedShop.includes('.myshopify.com')) {
        normalizedShop = `${normalizedShop}.myshopify.com`;
      }

      logger.info(`Embedded widget config update for: ${normalizedShop}`);

      // Build update data
      const updateData: any = {};

      if (config.widgetPosition)
        updateData.widget_position = config.widgetPosition;
      if (config.widgetColor) updateData.widget_color = config.widgetColor;
      if (config.welcomeMessage !== undefined)
        updateData.welcome_message = config.welcomeMessage;
      if (config.widgetEnabled !== undefined)
        updateData.widget_enabled = config.widgetEnabled;
      if (config.widgetSecondaryColor)
        updateData.widget_secondary_color = config.widgetSecondaryColor;
      if (config.widgetAccentColor)
        updateData.widget_accent_color = config.widgetAccentColor;
      if (config.widgetButtonSize !== undefined)
        updateData.widget_button_size = config.widgetButtonSize;
      if (config.widgetButtonStyle)
        updateData.widget_button_style = config.widgetButtonStyle;
      if (config.widgetShowPulse !== undefined)
        updateData.widget_show_pulse = config.widgetShowPulse;
      if (config.widgetChatWidth !== undefined)
        updateData.widget_chat_width = config.widgetChatWidth;
      if (config.widgetChatHeight !== undefined)
        updateData.widget_chat_height = config.widgetChatHeight;
      if (config.widgetSubtitle !== undefined)
        updateData.widget_subtitle = config.widgetSubtitle;
      if (config.widgetPlaceholder !== undefined)
        updateData.widget_placeholder = config.widgetPlaceholder;
      if (config.widgetAvatar !== undefined)
        updateData.widget_avatar = config.widgetAvatar;
      if (config.widgetShowPromoMessage !== undefined)
        updateData.widget_show_promo_message = config.widgetShowPromoMessage;
      if (config.widgetShowCart !== undefined)
        updateData.widget_show_cart = config.widgetShowCart;
      if (config.widgetEnableAnimations !== undefined)
        updateData.widget_enable_animations = config.widgetEnableAnimations;
      if (config.widgetTheme) updateData.widget_theme = config.widgetTheme;
      if (config.widgetBrandName !== undefined)
        updateData.widget_brand_name = config.widgetBrandName;

      // Try to update client_stores first
      const { data: clientStore, error: clientError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('shop_domain', normalizedShop)
        .select()
        .single();

      if (!clientError && clientStore) {
        return res.json({
          success: true,
          data: clientStore,
        });
      }

      // If no client_store, update stores table (basic fields only)
      const basicUpdateData: any = {};
      if (config.widgetEnabled !== undefined)
        basicUpdateData.widget_enabled = config.widgetEnabled;

      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .update(basicUpdateData)
        .eq('shop_domain', normalizedShop)
        .select()
        .single();

      if (storeError) {
        logger.error('Error updating widget config:', storeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update widget configuration',
        });
      }

      return res.json({
        success: true,
        data: store,
      });
    } catch (error) {
      logger.error('Embedded widget config update error:', error);
      next(error);
    }
  }
);

/**
 * Helper function to get analytics for a shop with optional date filtering
 * Optimized with parallel queries for better performance
 */
async function getAnalyticsForShop(
  shopDomain: string,
  dateFilters: { start: string | null; end: string | null }
) {
  const client = (supabaseService as any).serviceClient;

  // Build all queries
  const buildMessagesQuery = () => {
    let query = client
      .from('chat_messages')
      .select('session_id, created_at')
      .eq('shop_domain', shopDomain);

    if (dateFilters.start) {
      query = query.gte('created_at', dateFilters.start);
    }
    if (dateFilters.end) {
      query = query.lte('created_at', dateFilters.end);
    }
    return query;
  };

  const buildRecommendationsQuery = () => {
    let query = client
      .from('simple_recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('shop_domain', shopDomain);

    if (dateFilters.start) {
      query = query.gte('created_at', dateFilters.start);
    }
    if (dateFilters.end) {
      query = query.lte('created_at', dateFilters.end);
    }
    return query;
  };

  const buildConversionsQuery = () => {
    let query = client
      .from('simple_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('shop_domain', shopDomain);

    if (dateFilters.start) {
      query = query.gte('created_at', dateFilters.start);
    }
    if (dateFilters.end) {
      query = query.lte('created_at', dateFilters.end);
    }
    return query;
  };

  // Execute all queries in parallel for better performance
  const [
    messagesResult,
    productCountResult,
    recommendationsResult,
    conversionsResult,
    storeInfoResult,
  ] = await Promise.all([
    buildMessagesQuery(),
    client
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('shop_domain', shopDomain),
    buildRecommendationsQuery(),
    buildConversionsQuery(),
    client
      .from('stores')
      .select('installed_at, updated_at')
      .eq('shop_domain', shopDomain)
      .single(),
  ]);

  const messagesData = messagesResult.data;
  const productCount = productCountResult.count;
  const recommendationCount = recommendationsResult.count;
  const conversionCount = conversionsResult.count;
  const storeInfo = storeInfoResult.data;

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

  return {
    conversations: conversationCount,
    messages: messageCount,
    products: productCount || 0,
    recommendations: recommendationCount || 0,
    conversions: conversionCount || 0,
    lastSync: storeInfo?.updated_at || null,
    storeCreated: storeInfo?.installed_at || null,
    conversationsByDay,
  };
}

export default router;
