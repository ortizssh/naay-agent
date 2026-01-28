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
      if (config.welcomeMessage2 !== undefined)
        updateData.widget_welcome_message_2 = config.welcomeMessage2;
      if (config.welcomeMessage3 !== undefined)
        updateData.widget_welcome_message_3 = config.welcomeMessage3;
      if (config.rotatingMessagesEnabled !== undefined)
        updateData.widget_rotating_messages_enabled =
          config.rotatingMessagesEnabled;
      if (config.rotatingMessagesInterval !== undefined)
        updateData.widget_rotating_messages_interval =
          config.rotatingMessagesInterval;
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
 *
 * Uses chat_messages for conversation counting (all chats)
 * Uses simple_recommendations for recommendation counting (chats with product recommendations)
 */
async function getAnalyticsForShop(
  shopDomain: string,
  dateFilters: { start: string | null; end: string | null }
) {
  const client = (supabaseService as any).serviceClient;

  // Use direct queries with high limit instead of RPC functions (which may have internal limits)
  logger.info('Fetching analytics with direct queries (limit: 100000)');

  // Run parallel queries for better performance
  const [productCountResult, conversionsResult, storeInfoResult] =
    await Promise.all([
      // Product count
      client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', shopDomain),
      // Conversions count
      client
        .from('simple_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', shopDomain)
        .gte('purchased_at', dateFilters.start || '1970-01-01')
        .lte('purchased_at', dateFilters.end || '2100-01-01'),
      // Store info
      client
        .from('stores')
        .select('installed_at, updated_at')
        .eq('shop_domain', shopDomain)
        .single(),
    ]);

  // Fetch chat messages with high limit
  let chatQuery = client
    .from('chat_messages')
    .select('session_id, timestamp')
    .eq('shop_domain', shopDomain)
    .limit(100000);

  if (dateFilters.start)
    chatQuery = chatQuery.gte('timestamp', dateFilters.start);
  if (dateFilters.end) chatQuery = chatQuery.lte('timestamp', dateFilters.end);

  const chatResult = await chatQuery;
  const chatMessagesData = chatResult.data || [];

  const uniqueSessions = new Set(
    chatMessagesData.map((m: any) => m.session_id).filter(Boolean)
  );
  const conversationCount = uniqueSessions.size;
  const messageCount = chatMessagesData.length;

  logger.info(
    `Analytics: Found ${messageCount} messages, ${conversationCount} conversations`
  );

  // Group by day
  const sessionsByDay: Record<string, Set<string>> = {};
  chatMessagesData.forEach((msg: any) => {
    if (!msg.session_id || !msg.timestamp) return;
    const date = new Date(msg.timestamp).toISOString().split('T')[0];
    if (!sessionsByDay[date]) sessionsByDay[date] = new Set();
    sessionsByDay[date].add(msg.session_id);
  });

  const conversationsByDayData = Object.entries(sessionsByDay).map(
    ([date, sessions]) => ({
      date,
      count: sessions.size,
    })
  );

  // Fetch recommendations with high limit
  let recQuery = client
    .from('simple_recommendations')
    .select('id, created_at')
    .eq('shop_domain', shopDomain)
    .limit(100000);

  if (dateFilters.start)
    recQuery = recQuery.gte('created_at', dateFilters.start);
  if (dateFilters.end) recQuery = recQuery.lte('created_at', dateFilters.end);

  const recResult = await recQuery;
  const recommendationsData = recResult.data || [];
  const recommendationCount = recommendationsData.length;

  logger.info(`Analytics: Found ${recommendationCount} recommendations`);

  const recByDay: Record<string, number> = {};
  recommendationsData.forEach((rec: any) => {
    if (!rec.created_at) return;
    const date = new Date(rec.created_at).toISOString().split('T')[0];
    recByDay[date] = (recByDay[date] || 0) + 1;
  });

  const recommendationsByDayData = Object.entries(recByDay).map(
    ([date, count]) => ({
      date,
      count,
    })
  );

  const productCount = productCountResult.count || 0;
  const conversionCount = conversionsResult.count || 0;
  const storeInfo = storeInfoResult.data;

  // Combine conversations and recommendations into chart data
  const allDates = new Set([
    ...conversationsByDayData.map((d: any) => d.date),
    ...recommendationsByDayData.map((d: any) => d.date),
  ]);

  const convByDayMap = new Map(
    conversationsByDayData.map((d: any) => [d.date, d.count])
  );
  const recByDayMap = new Map(
    recommendationsByDayData.map((d: any) => [d.date, d.count])
  );

  const chartDataByDay = Array.from(allDates)
    .sort()
    .map(date => ({
      date,
      conversations: convByDayMap.get(date) || 0,
      recommendations: recByDayMap.get(date) || 0,
    }));

  return {
    conversations: conversationCount,
    messages: messageCount,
    products: productCount,
    recommendations: recommendationCount,
    conversions: conversionCount,
    lastSync: storeInfo?.updated_at || null,
    storeCreated: storeInfo?.installed_at || null,
    conversationsByDay: chartDataByDay,
  };
}

/**
 * GET /api/shopify/embedded/conversations
 * Get chat conversations for a shop with date filtering
 */
router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      const date = req.query.date as string | undefined; // Format: YYYY-MM-DD

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

      logger.info(`Fetching conversations for: ${normalizedShop}`, { date });

      // Build date filter
      let startOfDay: string;
      let endOfDay: string;

      if (date) {
        startOfDay = `${date}T00:00:00.000Z`;
        endOfDay = `${date}T23:59:59.999Z`;
      } else {
        // Default to today
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        startOfDay = `${todayStr}T00:00:00.000Z`;
        endOfDay = `${todayStr}T23:59:59.999Z`;
      }

      // Get unique sessions with their messages for the date
      const { data: messages, error } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, role, content, timestamp')
        .eq('shop_domain', normalizedShop)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: true });

      if (error) {
        logger.error('Error fetching conversations:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch conversations',
        });
      }

      // Group messages by session
      const sessionsMap = new Map<
        string,
        {
          sessionId: string;
          startedAt: string;
          messages: Array<{
            role: string;
            content: string;
            timestamp: string;
          }>;
        }
      >();

      for (const msg of messages || []) {
        if (!sessionsMap.has(msg.session_id)) {
          sessionsMap.set(msg.session_id, {
            sessionId: msg.session_id,
            startedAt: msg.timestamp,
            messages: [],
          });
        }
        sessionsMap.get(msg.session_id)!.messages.push({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        });
      }

      // Convert to array and sort by start time (newest first)
      const conversations = Array.from(sessionsMap.values()).sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      // Get available dates (for date picker)
      const { data: availableDates } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('timestamp')
        .eq('shop_domain', normalizedShop)
        .order('timestamp', { ascending: false })
        .limit(1000);

      const uniqueDates = [
        ...new Set(
          (availableDates || []).map(
            (d: any) => new Date(d.timestamp).toISOString().split('T')[0]
          )
        ),
      ].slice(0, 30); // Last 30 days with data

      return res.json({
        success: true,
        data: {
          conversations,
          totalConversations: conversations.length,
          totalMessages: messages?.length || 0,
          date: date || new Date().toISOString().split('T')[0],
          availableDates: uniqueDates,
        },
      });
    } catch (error) {
      logger.error('Conversations endpoint error:', error);
      next(error);
    }
  }
);

export default router;
