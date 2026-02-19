import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { SupabaseService } from '@/services/supabase.service';
import { knowledgeService } from '@/services/knowledge.service';
import { logger } from '@/utils/logger';
import { retellService } from '@/services/retell.service';
import { planService } from '@/services/plan.service';
import { tenantService } from '@/services/tenant.service';

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

      // Build date filters - ensure end date includes the entire day
      const dateFilters = {
        start: startDate ? `${startDate}T00:00:00.000Z` : null,
        end: endDate ? `${endDate}T23:59:59.999Z` : null,
      };

      logger.info('Date filters:', dateFilters);

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
      if (config.subtitle2 !== undefined)
        updateData.widget_subtitle_2 = config.subtitle2;
      if (config.welcomeMessage3 !== undefined)
        updateData.widget_welcome_message_3 = config.welcomeMessage3;
      if (config.subtitle3 !== undefined)
        updateData.widget_subtitle_3 = config.subtitle3;
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
      if (config.widgetShowContact !== undefined)
        updateData.widget_show_contact = config.widgetShowContact;
      if (config.retellAgentId !== undefined)
        updateData.retell_agent_id = config.retellAgentId;
      if (config.retellFromNumber !== undefined)
        updateData.retell_from_number = config.retellFromNumber;
      if (config.widgetEnableAnimations !== undefined)
        updateData.widget_enable_animations = config.widgetEnableAnimations;
      if (config.widgetTheme) updateData.widget_theme = config.widgetTheme;
      if (config.widgetBrandName !== undefined)
        updateData.widget_brand_name = config.widgetBrandName;
      // Promotion badge settings
      if (config.promoBadgeEnabled !== undefined)
        updateData.promo_badge_enabled = config.promoBadgeEnabled;
      if (config.promoBadgeType !== undefined)
        updateData.promo_badge_type = config.promoBadgeType;
      if (config.promoBadgeDiscount !== undefined)
        updateData.promo_badge_discount = config.promoBadgeDiscount;
      if (config.promoBadgeText !== undefined)
        updateData.promo_badge_text = config.promoBadgeText;
      if (config.promoBadgeColor !== undefined)
        updateData.promo_badge_color = config.promoBadgeColor;
      if (config.promoBadgeShape !== undefined)
        updateData.promo_badge_shape = config.promoBadgeShape;
      if (config.promoBadgePosition !== undefined)
        updateData.promo_badge_position = config.promoBadgePosition;
      if (config.promoBadgeSuffix !== undefined)
        updateData.promo_badge_suffix = config.promoBadgeSuffix;
      if (config.promoBadgePrefix !== undefined)
        updateData.promo_badge_prefix = config.promoBadgePrefix;
      if (config.promoBadgeFontSize !== undefined)
        updateData.promo_badge_font_size = config.promoBadgeFontSize;
      // Suggested questions settings
      if (config.suggestedQuestion1Text !== undefined)
        updateData.suggested_question_1_text = config.suggestedQuestion1Text;
      if (config.suggestedQuestion1Message !== undefined)
        updateData.suggested_question_1_message =
          config.suggestedQuestion1Message;
      if (config.suggestedQuestion2Text !== undefined)
        updateData.suggested_question_2_text = config.suggestedQuestion2Text;
      if (config.suggestedQuestion2Message !== undefined)
        updateData.suggested_question_2_message =
          config.suggestedQuestion2Message;
      if (config.suggestedQuestion3Text !== undefined)
        updateData.suggested_question_3_text = config.suggestedQuestion3Text;
      if (config.suggestedQuestion3Message !== undefined)
        updateData.suggested_question_3_message =
          config.suggestedQuestion3Message;

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
 * Helper function to fetch all records with pagination (bypasses 1000 row limit)
 */
async function fetchAllWithPagination(
  client: any,
  table: string,
  selectFields: string,
  filters: { column: string; value: any; operator?: string }[],
  orderBy: string = 'created_at'
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client
      .from(table)
      .select(selectFields)
      .order(orderBy, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    // Apply filters
    for (const filter of filters) {
      if (filter.operator === 'gte') {
        query = query.gte(filter.column, filter.value);
      } else if (filter.operator === 'lte') {
        query = query.lte(filter.column, filter.value);
      } else {
        query = query.eq(filter.column, filter.value);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Pagination error for ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

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

  logger.info('Fetching analytics with pagination (bypassing 1000 row limit)');

  // Run parallel queries for counts and store info
  const [productCountResult, storeInfoResult] = await Promise.all([
    // Product count
    client
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('shop_domain', shopDomain),
    // Store info
    client
      .from('stores')
      .select('installed_at, updated_at')
      .eq('shop_domain', shopDomain)
      .single(),
  ]);

  // Build filters for chat messages
  const chatFilters: { column: string; value: any; operator?: string }[] = [
    { column: 'shop_domain', value: shopDomain },
  ];
  if (dateFilters.start) {
    chatFilters.push({
      column: 'timestamp',
      value: dateFilters.start,
      operator: 'gte',
    });
  }
  if (dateFilters.end) {
    chatFilters.push({
      column: 'timestamp',
      value: dateFilters.end,
      operator: 'lte',
    });
  }

  // Fetch all chat messages with pagination
  const chatMessagesData = await fetchAllWithPagination(
    client,
    'chat_messages',
    'session_id, timestamp',
    chatFilters,
    'timestamp'
  );

  const uniqueSessions = new Set(
    chatMessagesData.map((m: any) => m.session_id).filter(Boolean)
  );
  const conversationCount = uniqueSessions.size;
  const messageCount = chatMessagesData.length;

  logger.info(
    `Analytics: Found ${messageCount} messages, ${conversationCount} conversations (with pagination)`
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

  // Build filters for recommendations
  const recFilters: { column: string; value: any; operator?: string }[] = [
    { column: 'shop_domain', value: shopDomain },
  ];
  if (dateFilters.start) {
    recFilters.push({
      column: 'created_at',
      value: dateFilters.start,
      operator: 'gte',
    });
  }
  if (dateFilters.end) {
    recFilters.push({
      column: 'created_at',
      value: dateFilters.end,
      operator: 'lte',
    });
  }

  // Fetch all recommendations with pagination
  const recommendationsData = await fetchAllWithPagination(
    client,
    'simple_recommendations',
    'id, created_at',
    recFilters,
    'created_at'
  );
  const recommendationCount = recommendationsData.length;

  logger.info(
    `Analytics: Found ${recommendationCount} recommendations (with pagination)`
  );

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

  // Fetch all conversions with pagination
  const convFilters: { column: string; value: any; operator?: string }[] = [
    { column: 'shop_domain', value: shopDomain },
  ];
  if (dateFilters.start) {
    convFilters.push({
      column: 'purchased_at',
      value: dateFilters.start,
      operator: 'gte',
    });
  }
  if (dateFilters.end) {
    convFilters.push({
      column: 'purchased_at',
      value: dateFilters.end,
      operator: 'lte',
    });
  }

  const conversionsData = await fetchAllWithPagination(
    client,
    'simple_conversions',
    'id, purchased_at',
    convFilters,
    'purchased_at'
  );
  const conversionCount = conversionsData.length;

  logger.info(
    `Analytics: Found ${conversionCount} conversions (with pagination)`
  );

  const convByDayData: Record<string, number> = {};
  conversionsData.forEach((conv: any) => {
    if (!conv.purchased_at) return;
    const date = new Date(conv.purchased_at).toISOString().split('T')[0];
    convByDayData[date] = (convByDayData[date] || 0) + 1;
  });

  const conversionsByDayData = Object.entries(convByDayData).map(
    ([date, count]) => ({
      date,
      count,
    })
  );

  const productCount = productCountResult.count || 0;
  const storeInfo = storeInfoResult.data;

  // Generate all dates in the range (including today even if no data)
  const generateDateRange = (
    start: string | null,
    end: string | null
  ): string[] => {
    // Extract YYYY-MM-DD from ISO strings or use directly
    const extractDateStr = (isoOrDate: string): string => {
      return isoOrDate.split('T')[0];
    };

    // If no filters, use data dates only
    if (!start || !end) {
      const dataDates = new Set([
        ...conversationsByDayData.map((d: any) => d.date),
        ...recommendationsByDayData.map((d: any) => d.date),
        ...conversionsByDayData.map((d: any) => d.date),
      ]);
      return Array.from(dataDates).sort();
    }

    const startDateStr = extractDateStr(start);
    const endDateStr = extractDateStr(end);

    logger.info(`Generating date range from ${startDateStr} to ${endDateStr}`);

    // Generate all dates from start to end using simple date math
    const dates: string[] = [];
    const [startYear, startMonth, startDay] = startDateStr
      .split('-')
      .map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

    // Use UTC to avoid timezone issues
    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    while (current <= endDate) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    logger.info(
      `Generated ${dates.length} dates, first: ${dates[0]}, last: ${dates[dates.length - 1]}`
    );

    return dates;
  };

  const allDatesInRange = generateDateRange(dateFilters.start, dateFilters.end);

  const convByDayMap = new Map(
    conversationsByDayData.map((d: any) => [d.date, d.count])
  );
  const recByDayMap = new Map(
    recommendationsByDayData.map((d: any) => [d.date, d.count])
  );
  const conversionByDayMap = new Map(
    conversionsByDayData.map((d: any) => [d.date, d.count])
  );

  // Include all dates in range, even if they have 0 data
  const chartDataByDay = allDatesInRange.map(date => ({
    date,
    conversations: convByDayMap.get(date) || 0,
    recommendations: recByDayMap.get(date) || 0,
    conversions: conversionByDayMap.get(date) || 0,
  }));

  logger.info(
    `Chart data includes ${chartDataByDay.length} days, last date: ${chartDataByDay[chartDataByDay.length - 1]?.date}`
  );

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

/**
 * GET /api/shopify/embedded/conversions/dashboard
 * Get full conversion dashboard for a shop in embedded Shopify context
 */
router.get(
  '/conversions/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      const days = parseInt(req.query.days as string) || 7;

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

      logger.info(
        `Embedded conversions dashboard request for: ${normalizedShop}`,
        { days }
      );

      const client = (supabaseService as any).serviceClient;
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );
      const previousStartDate = new Date(
        startDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      // Get recommendations for the period
      const { data: recommendations } = await client
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .gte('recommended_at', startDate.toISOString())
        .lte('recommended_at', endDate.toISOString())
        .order('recommended_at', { ascending: false });

      // Get conversions for the period
      const { data: conversions } = await client
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .gte('purchased_at', startDate.toISOString())
        .lte('purchased_at', endDate.toISOString())
        .order('purchased_at', { ascending: false });

      // Get previous period data for comparison
      const { data: previousConversions } = await client
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .gte('purchased_at', previousStartDate.toISOString())
        .lt('purchased_at', startDate.toISOString());

      const { data: previousRecommendations } = await client
        .from('simple_recommendations')
        .select('id')
        .eq('shop_domain', normalizedShop)
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

      recommendations?.forEach((r: any) => {
        const dateKey = new Date(r.recommended_at).toISOString().split('T')[0];
        const dayData = timelineMap.get(dateKey);
        if (dayData) dayData.recommendations++;
      });

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

      // Recent activity
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

      // Attribution breakdown
      const attributionBreakdown = {
        direct: { count: 0, revenue: 0 },
        assisted: { count: 0, revenue: 0 },
        viewThrough: { count: 0, revenue: 0 },
      };

      conversions?.forEach((c: any) => {
        const minutes = c.minutes_to_conversion || 0;
        const amount = c.order_amount || 0;

        if (minutes <= 30) {
          attributionBreakdown.direct.count++;
          attributionBreakdown.direct.revenue += amount;
        } else if (minutes <= 1440) {
          attributionBreakdown.assisted.count++;
          attributionBreakdown.assisted.revenue += amount;
        } else {
          attributionBreakdown.viewThrough.count++;
          attributionBreakdown.viewThrough.revenue += amount;
        }
      });

      attributionBreakdown.direct.revenue =
        Math.round(attributionBreakdown.direct.revenue * 100) / 100;
      attributionBreakdown.assisted.revenue =
        Math.round(attributionBreakdown.assisted.revenue * 100) / 100;
      attributionBreakdown.viewThrough.revenue =
        Math.round(attributionBreakdown.viewThrough.revenue * 100) / 100;

      // Period comparison
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
      logger.error('Embedded conversions dashboard error:', error);
      next(error);
    }
  }
);

// Multer config for knowledge file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|md|pdf)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .md and .pdf files are allowed'));
    }
  },
});

/**
 * Helper: normalize Shopify shop domain
 */
function normalizeShopDomain(shop: string): string {
  let normalized = shop.toLowerCase().trim();
  if (!normalized.includes('.myshopify.com')) {
    normalized = `${normalized}.myshopify.com`;
  }
  return normalized;
}

/**
 * Helper: verify store exists (returns normalized shop or throws)
 */
async function verifyShopExists(
  shopDomain: string,
  res: Response
): Promise<string | null> {
  const normalizedShop = normalizeShopDomain(shopDomain);

  const { data: clientStore } = await (supabaseService as any).serviceClient
    .from('client_stores')
    .select('shop_domain')
    .eq('shop_domain', normalizedShop)
    .single();

  if (clientStore) return normalizedShop;

  const { data: store } = await (supabaseService as any).serviceClient
    .from('stores')
    .select('shop_domain')
    .eq('shop_domain', normalizedShop)
    .single();

  if (store) return normalizedShop;

  res.status(404).json({ success: false, error: 'Store not found' });
  return null;
}

// ==================== AI Config Endpoints ====================

/**
 * GET /api/shopify/embedded/ai-config
 * Get AI agent configuration for a shop
 */
router.get(
  '/ai-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'chat_mode, ai_model, agent_name, agent_tone, brand_description, agent_instructions, agent_language, chatbot_endpoint'
        )
        .eq('shop_domain', normalizedShop)
        .single();

      if (error || !store) {
        return res.json({
          success: true,
          data: {
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
      }

      return res.json({ success: true, data: store });
    } catch (error) {
      logger.error('Embedded AI config get error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/shopify/embedded/ai-config
 * Update AI agent configuration for a shop
 */
router.put(
  '/ai-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, config } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);

      const {
        chatMode,
        aiModel,
        agentName,
        agentTone,
        brandDescription,
        agentInstructions,
        agentLanguage,
        chatbotEndpoint,
      } = config || {};

      if (chatMode === 'external' && !chatbotEndpoint) {
        return res.status(400).json({
          success: false,
          error: 'URL del endpoint es requerida para modo externo',
        });
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

      const { data, error } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('shop_domain', normalizedShop)
        .select(
          'chat_mode, ai_model, agent_name, agent_tone, brand_description, agent_instructions, agent_language, chatbot_endpoint'
        )
        .single();

      if (error) {
        logger.error('Error updating AI config:', error);
        return res
          .status(500)
          .json({ success: false, error: 'Failed to update AI configuration' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      logger.error('Embedded AI config update error:', error);
      next(error);
    }
  }
);

// ==================== Knowledge Endpoints ====================

/**
 * GET /api/shopify/embedded/knowledge
 * List knowledge documents for a shop
 */
router.get(
  '/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);
      const documents = await knowledgeService.listDocuments(normalizedShop);

      return res.json({ success: true, data: documents });
    } catch (error) {
      logger.error('Embedded knowledge list error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/shopify/embedded/knowledge
 * Create a text-based knowledge document
 */
router.post(
  '/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, title, content } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }
      if (!title || !content) {
        return res
          .status(400)
          .json({ success: false, error: 'Title and content are required' });
      }

      const normalizedShop = normalizeShopDomain(shop);
      const document = await knowledgeService.createDocument(normalizedShop, {
        title,
        content,
        sourceType: 'text',
      });

      return res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Embedded knowledge create error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/shopify/embedded/knowledge/upload
 * Upload a file (PDF/TXT/MD) as knowledge document
 */
router.post(
  '/knowledge/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = req.body.shop as string;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, error: 'File is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);
      const title = req.body.title || file.originalname;
      let content: string;

      if (
        file.mimetype === 'application/pdf' ||
        file.originalname.endsWith('.pdf')
      ) {
        const pdfData = await pdfParse(file.buffer);
        content = pdfData.text;
      } else {
        content = file.buffer.toString('utf-8');
      }

      if (!content.trim()) {
        return res
          .status(400)
          .json({ success: false, error: 'File contains no extractable text' });
      }

      const document = await knowledgeService.createDocument(normalizedShop, {
        title,
        content,
        sourceType: 'file',
        originalFilename: file.originalname,
      });

      return res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Embedded knowledge upload error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/shopify/embedded/knowledge/:documentId
 * Delete a knowledge document
 */
router.delete(
  '/knowledge/:documentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);
      await knowledgeService.deleteDocument(
        req.params.documentId,
        normalizedShop
      );

      return res.json({ success: true });
    } catch (error) {
      logger.error('Embedded knowledge delete error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/shopify/embedded/knowledge/:documentId/status
 * Get document processing status
 */
router.get(
  '/knowledge/:documentId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);
      const status = await knowledgeService.getDocumentStatus(
        req.params.documentId,
        normalizedShop
      );

      if (!status) {
        return res
          .status(404)
          .json({ success: false, error: 'Document not found' });
      }

      return res.json({ success: true, data: status });
    } catch (error) {
      logger.error('Embedded knowledge status error:', error);
      next(error);
    }
  }
);

// ==================== Voice Agent Endpoints ====================

/**
 * GET /api/shopify/embedded/voice-config
 */
router.get(
  '/voice-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .single();

      if (error || !store) {
        return res
          .status(404)
          .json({ success: false, error: 'Store not found' });
      }

      const plan = store.plan || 'free';
      const limits = await planService.getPlanLimits(plan);
      const planAllowsVoiceAgent = limits.features?.voice_agents === true;

      const voiceCallsUsed =
        await tenantService.getMonthlyVoiceCallCount(normalizedShop);
      const voiceCallsLimit = limits.monthly_voice_calls;

      return res.json({
        success: true,
        data: {
          planAllowsVoiceAgent,
          plan,
          voiceAgentEnabled: store.voice_agent_enabled || false,
          retellAgentId: store.retell_agent_id || null,
          retellLlmId: store.retell_llm_id || null,
          retellPhoneNumber: store.retell_phone_number || null,
          retellFromNumber: store.retell_from_number || null,
          voiceCallsUsed,
          voiceCallsLimit,
          voiceId: store.voice_agent_voice_id || null,
          language: store.voice_agent_language || 'en-US',
          voiceSpeed: store.voice_agent_voice_speed ?? 1.0,
          voiceTemperature: store.voice_agent_voice_temperature ?? 1.0,
          responsiveness: store.voice_agent_responsiveness ?? 0.7,
          interruptionSensitivity:
            store.voice_agent_interruption_sensitivity ?? 0.5,
          enableBackchannel: store.voice_agent_enable_backchannel ?? true,
          ambientSound: store.voice_agent_ambient_sound || null,
          maxCallDurationMs: store.voice_agent_max_call_duration_ms ?? 1800000,
          endCallAfterSilenceMs:
            store.voice_agent_end_call_after_silence_ms ?? 30000,
          boostedKeywords: store.voice_agent_boosted_keywords || [],
          prompt: store.voice_agent_prompt || '',
          beginMessage: store.voice_agent_begin_message || '',
          model: store.voice_agent_model || 'gpt-4.1-mini',
          modelTemperature: store.voice_agent_model_temperature ?? null,
        },
      });
    } catch (error) {
      logger.error('Embedded voice config get error:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/shopify/embedded/voice-config
 */
router.put(
  '/voice-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, config } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);

      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .single();

      if (!store) {
        return res
          .status(404)
          .json({ success: false, error: 'Store not found' });
      }

      if (!store.voice_agent_enabled) {
        return res
          .status(400)
          .json({ success: false, error: 'Voice agent is not enabled' });
      }

      const {
        voiceId,
        language,
        voiceSpeed,
        voiceTemperature,
        responsiveness,
        interruptionSensitivity,
        enableBackchannel,
        ambientSound,
        maxCallDurationMs,
        endCallAfterSilenceMs,
        boostedKeywords,
        prompt,
        beginMessage,
        model,
        modelTemperature,
      } = config || {};

      const dbUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (voiceId !== undefined) dbUpdate.voice_agent_voice_id = voiceId;
      if (language !== undefined) dbUpdate.voice_agent_language = language;
      if (voiceSpeed !== undefined)
        dbUpdate.voice_agent_voice_speed = voiceSpeed;
      if (voiceTemperature !== undefined)
        dbUpdate.voice_agent_voice_temperature = voiceTemperature;
      if (responsiveness !== undefined)
        dbUpdate.voice_agent_responsiveness = responsiveness;
      if (interruptionSensitivity !== undefined)
        dbUpdate.voice_agent_interruption_sensitivity = interruptionSensitivity;
      if (enableBackchannel !== undefined)
        dbUpdate.voice_agent_enable_backchannel = enableBackchannel;
      if (ambientSound !== undefined)
        dbUpdate.voice_agent_ambient_sound = ambientSound;
      if (maxCallDurationMs !== undefined)
        dbUpdate.voice_agent_max_call_duration_ms = maxCallDurationMs;
      if (endCallAfterSilenceMs !== undefined)
        dbUpdate.voice_agent_end_call_after_silence_ms = endCallAfterSilenceMs;
      if (boostedKeywords !== undefined)
        dbUpdate.voice_agent_boosted_keywords = boostedKeywords;
      if (prompt !== undefined) dbUpdate.voice_agent_prompt = prompt;
      if (beginMessage !== undefined)
        dbUpdate.voice_agent_begin_message = beginMessage;
      if (model !== undefined) dbUpdate.voice_agent_model = model;
      if (modelTemperature !== undefined)
        dbUpdate.voice_agent_model_temperature = modelTemperature;

      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update(dbUpdate)
        .eq('shop_domain', normalizedShop);

      // Push changes to Retell if agent exists
      if (store.retell_agent_id) {
        try {
          await retellService.updateAgent(store.retell_agent_id, {
            voiceId,
            language,
            voiceSpeed,
            voiceTemperature,
            responsiveness,
            interruptionSensitivity,
            enableBackchannel,
            ambientSound,
            maxCallDurationMs,
            endCallAfterSilenceMs,
            boostedKeywords,
          });
        } catch (e) {
          logger.error('Failed to update Retell agent from embedded', {
            agentId: store.retell_agent_id,
            e,
          });
        }
      }

      if (store.retell_llm_id) {
        try {
          await retellService.updateLlm(store.retell_llm_id, {
            prompt,
            model,
            beginMessage,
            temperature: modelTemperature,
          });
        } catch (e) {
          logger.error('Failed to update Retell LLM from embedded', {
            llmId: store.retell_llm_id,
            e,
          });
        }
      }

      return res.json({
        success: true,
        message: 'Voice agent configuration updated',
      });
    } catch (error) {
      logger.error('Embedded voice config update error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/shopify/embedded/voice-enable
 */
router.post(
  '/voice-enable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);

      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .single();

      if (!store) {
        return res
          .status(404)
          .json({ success: false, error: 'Store not found' });
      }

      const plan = store.plan || 'free';
      const limits = await planService.getPlanLimits(plan);
      if (!limits.features?.voice_agents) {
        return res.status(403).json({
          success: false,
          error:
            'Your plan does not include Voice Agents. Upgrade to Professional or Enterprise.',
        });
      }

      if (store.voice_agent_enabled && store.retell_agent_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Voice agent is already enabled' });
      }

      const result = await retellService.provisionVoiceAgent(normalizedShop, {
        prompt: store.voice_agent_prompt || undefined,
        beginMessage: store.voice_agent_begin_message || undefined,
        model: store.voice_agent_model || 'gpt-4.1-mini',
        modelTemperature: store.voice_agent_model_temperature ?? undefined,
        voiceId: store.voice_agent_voice_id || undefined,
        language: store.voice_agent_language || 'en-US',
        voiceSpeed: store.voice_agent_voice_speed ?? undefined,
        voiceTemperature: store.voice_agent_voice_temperature ?? undefined,
        responsiveness: store.voice_agent_responsiveness ?? undefined,
        interruptionSensitivity:
          store.voice_agent_interruption_sensitivity ?? undefined,
        enableBackchannel: store.voice_agent_enable_backchannel ?? undefined,
        ambientSound: store.voice_agent_ambient_sound || undefined,
        maxCallDurationMs: store.voice_agent_max_call_duration_ms ?? undefined,
        endCallAfterSilenceMs:
          store.voice_agent_end_call_after_silence_ms ?? undefined,
        boostedKeywords: store.voice_agent_boosted_keywords || undefined,
      });

      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({
          voice_agent_enabled: true,
          retell_llm_id: result.llmId,
          retell_agent_id: result.agentId,
          retell_phone_number: result.phoneNumber,
          retell_from_number: result.phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', normalizedShop);

      logger.info('Voice agent enabled (embedded)', {
        shopDomain: normalizedShop,
        ...result,
      });

      return res.json({
        success: true,
        data: {
          agentId: result.agentId,
          llmId: result.llmId,
          phoneNumber: result.phoneNumber,
        },
      });
    } catch (error) {
      logger.error('Embedded voice enable error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/shopify/embedded/voice-disable
 */
router.post(
  '/voice-disable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);

      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .single();

      if (!store) {
        return res
          .status(404)
          .json({ success: false, error: 'Store not found' });
      }

      if (!store.voice_agent_enabled) {
        return res
          .status(400)
          .json({ success: false, error: 'Voice agent is not enabled' });
      }

      await retellService.deprovisionVoiceAgent({
        phoneNumber:
          store.retell_phone_number || store.retell_from_number || undefined,
        agentId: store.retell_agent_id || undefined,
        llmId: store.retell_llm_id || undefined,
      });

      await (supabaseService as any).serviceClient
        .from('client_stores')
        .update({
          voice_agent_enabled: false,
          retell_llm_id: null,
          retell_agent_id: null,
          retell_phone_number: null,
          retell_from_number: null,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', normalizedShop);

      logger.info('Voice agent disabled (embedded)', {
        shopDomain: normalizedShop,
      });

      return res.json({ success: true, message: 'Voice agent disabled' });
    } catch (error) {
      logger.error('Embedded voice disable error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/shopify/embedded/voice-voices
 */
router.get(
  '/voice-voices',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const voices = await retellService.listVoices();
      return res.json({ success: true, data: voices });
    } catch (error) {
      logger.error('Embedded voice voices error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/shopify/embedded/voice-test-call
 */
router.post(
  '/voice-test-call',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, toNumber } = req.body;
      if (!shop) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }
      if (!toNumber || typeof toNumber !== 'string') {
        return res
          .status(400)
          .json({ success: false, error: 'Phone number is required' });
      }

      const normalizedShop = normalizeShopDomain(shop);

      const { data: store } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedShop)
        .single();

      if (!store || !store.voice_agent_enabled || !store.retell_agent_id) {
        return res
          .status(400)
          .json({ success: false, error: 'Voice agent is not enabled' });
      }

      const fromNumber = store.retell_phone_number || store.retell_from_number;
      if (!fromNumber) {
        return res
          .status(400)
          .json({ success: false, error: 'No phone number configured' });
      }

      const cleaned = toNumber.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{10,15}$/.test(cleaned)) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid phone number format' });
      }

      // Check monthly voice call limit
      const plan = store.plan || 'free';
      const limits = await planService.getPlanLimits(plan);
      if (limits.monthly_voice_calls > 0) {
        const callCount =
          await tenantService.getMonthlyVoiceCallCount(normalizedShop);
        if (callCount >= limits.monthly_voice_calls) {
          return res.status(403).json({
            success: false,
            error:
              'Monthly voice call limit reached. Please upgrade your plan.',
          });
        }
      }

      const { dynamicVariables } = req.body;

      const call = await retellService.createPhoneCall({
        fromNumber,
        toNumber: cleaned.startsWith('+') ? cleaned : `+${cleaned}`,
        overrideAgentId: store.retell_agent_id,
        dynamicVariables: dynamicVariables || undefined,
        metadata: { type: 'test_call', shop_domain: normalizedShop },
      });

      logger.info('Test call initiated (embedded)', {
        shopDomain: normalizedShop,
        callId: call.call_id,
      });

      return res.json({
        success: true,
        data: { callId: call.call_id, status: call.call_status },
      });
    } catch (error: any) {
      logger.error('Embedded voice test call error:', {
        message: error?.message,
        status: error?.status,
        error: error?.error,
      });

      if (error?.status && error?.error) {
        return res.status(error.status).json({
          success: false,
          error: error.message || 'Retell API error',
          details: error.error,
        });
      }

      next(error);
    }
  }
);

/**
 * GET /api/shopify/embedded/voice-calls
 */
router.get(
  '/voice-calls',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = req.query.shop as string;
      if (!shopDomain) {
        return res
          .status(400)
          .json({ success: false, error: 'Shop domain is required' });
      }

      const normalizedShop = normalizeShopDomain(shopDomain);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const {
        data: calls,
        error,
        count,
      } = await (supabaseService as any).serviceClient
        .from('voice_call_logs')
        .select('*', { count: 'exact' })
        .eq('shop_domain', normalizedShop)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return res
          .status(500)
          .json({ success: false, error: 'Error fetching call history' });
      }

      return res.json({
        success: true,
        data: calls || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      logger.error('Embedded voice calls error:', error);
      next(error);
    }
  }
);

export default router;
