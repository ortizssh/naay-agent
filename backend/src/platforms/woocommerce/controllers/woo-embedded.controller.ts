/**
 * WooCommerce Embedded Controller
 * Handles analytics, widget config, conversations and conversions for WooCommerce admin panel
 * Equivalent to shopify-embedded.controller.ts but for WooCommerce stores
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { SupabaseService } from '@/services/supabase.service';
import { knowledgeService } from '@/services/knowledge.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * Normalize WooCommerce site URL to host-only format
 * Must match registration format in woo-auth.controller.ts which stores shop_domain as url.host (e.g., "cactus.mx")
 */
function normalizeWooSiteUrl(siteUrl: string): string {
  try {
    const url = new URL(siteUrl);
    return url.host; // host only, e.g., "cactus.mx" — matches DB shop_domain
  } catch {
    // If URL parsing fails, try to add protocol
    if (!siteUrl.startsWith('http')) {
      return normalizeWooSiteUrl(`https://${siteUrl}`);
    }
    return siteUrl.toLowerCase().trim();
  }
}

/**
 * GET /api/woo/embedded/analytics
 * Get analytics for a WooCommerce store in embedded context
 */
router.get(
  '/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!siteUrl) {
        return res.status(400).json({
          success: false,
          error: 'Site URL is required',
        });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      logger.info(
        `WooCommerce embedded analytics request for: ${normalizedUrl}`,
        {
          startDate,
          endDate,
        }
      );

      // Build date filters - ensure end date includes the entire day
      const dateFilters = {
        start: startDate ? `${startDate}T00:00:00.000Z` : null,
        end: endDate ? `${endDate}T23:59:59.999Z` : null,
      };

      // Verify the store exists in our system (security check)
      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .select(
          'shop_domain, installed_at, updated_at, widget_enabled, platform'
        )
        .eq('shop_domain', normalizedUrl)
        .eq('platform', 'woocommerce')
        .single();

      if (storeError || !store) {
        // Try client_stores as fallback
        const { data: clientStore } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select(
            'shop_domain, created_at, last_sync_at, widget_enabled, status, products_synced, platform'
          )
          .eq('shop_domain', normalizedUrl)
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
          platform: clientStore.platform || 'woocommerce',
        };

        // Get analytics from chat_messages
        const analytics = await getAnalyticsForStore(
          normalizedUrl,
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
        .eq('shop_domain', normalizedUrl);

      const storeData = {
        shop_domain: store.shop_domain,
        status: 'active',
        widget_enabled: store.widget_enabled,
        products_synced: productCount || 0,
        last_sync_at: store.updated_at,
        created_at: store.installed_at,
        platform: store.platform || 'woocommerce',
      };

      // Get analytics
      const analytics = await getAnalyticsForStore(normalizedUrl, dateFilters);

      return res.json({
        success: true,
        data: {
          store: storeData,
          analytics,
        },
      });
    } catch (error) {
      logger.error('WooCommerce embedded analytics error:', error);
      return next(error);
    }
  }
);

/**
 * PUT /api/woo/embedded/widget/config
 * Update widget configuration from embedded WooCommerce context
 */
router.put(
  '/widget/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { siteUrl, config } = req.body;

      if (!siteUrl) {
        return res.status(400).json({
          success: false,
          error: 'Site URL is required',
        });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      logger.info(
        `WooCommerce embedded widget config update for: ${normalizedUrl}`
      );

      // Build update data
      const updateData: Record<string, unknown> = {};

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
      // Chatbot endpoint
      if (config.chatbotEndpoint !== undefined)
        updateData.chatbot_endpoint = config.chatbotEndpoint;

      // Try to update client_stores first
      const { data: clientStore, error: clientError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .update(updateData)
        .eq('shop_domain', normalizedUrl)
        .select()
        .single();

      if (!clientError && clientStore) {
        return res.json({
          success: true,
          data: clientStore,
        });
      }

      // If no client_store, update stores table (basic fields only)
      const basicUpdateData: Record<string, unknown> = {};
      if (config.widgetEnabled !== undefined)
        basicUpdateData.widget_enabled = config.widgetEnabled;

      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .update(basicUpdateData)
        .eq('shop_domain', normalizedUrl)
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
      logger.error('WooCommerce embedded widget config update error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/woo/embedded/conversations
 * Get chat conversations for a WooCommerce store with date filtering
 */
router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      const date = req.query.date as string | undefined; // Format: YYYY-MM-DD

      if (!siteUrl) {
        return res.status(400).json({
          success: false,
          error: 'Site URL is required',
        });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      // Build list of possible shop domain formats to try
      const shopVariants: string[] = [normalizedUrl];
      try {
        const url = new URL(normalizedUrl);
        shopVariants.push(url.host); // e.g., "imperionfc.cl"
        shopVariants.push(url.hostname); // e.g., "imperionfc.cl"
        shopVariants.push(`${normalizedUrl}/`); // with trailing slash
        shopVariants.push(`https://${url.host}`);
        shopVariants.push(`http://${url.host}`);
      } catch {
        // Ignore parse errors
      }

      logger.info(`Fetching conversations for WooCommerce: ${normalizedUrl}`, {
        date,
        shopVariants,
      });

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

      // Try each variant to find messages
      let messages: any[] = [];
      let error: any = null;

      for (const variant of shopVariants) {
        const result = await (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('session_id, role, content, timestamp')
          .eq('shop_domain', variant)
          .gte('timestamp', startOfDay)
          .lte('timestamp', endOfDay)
          .order('timestamp', { ascending: true });

        if (result.data && result.data.length > 0) {
          messages = result.data;
          logger.info(
            `Found ${messages.length} messages with variant: ${variant}`
          );
          break;
        }
        error = result.error;
      }

      if (messages.length === 0 && error) {
        logger.error('Error fetching conversations:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch conversations',
        });
      }

      logger.info(`Processing ${messages.length} messages for conversations`);

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
        .eq('shop_domain', normalizedUrl)
        .order('timestamp', { ascending: false })
        .limit(1000);

      const uniqueDates = [
        ...new Set(
          (availableDates || []).map(
            (d: { timestamp: string }) =>
              new Date(d.timestamp).toISOString().split('T')[0]
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
      logger.error('WooCommerce conversations endpoint error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/woo/embedded/conversions/dashboard
 * Get full conversion dashboard for a WooCommerce store
 */
router.get(
  '/conversions/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      const days = parseInt(req.query.days as string) || 7;

      if (!siteUrl) {
        return res.status(400).json({
          success: false,
          error: 'Site URL is required',
        });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      logger.info(
        `WooCommerce embedded conversions dashboard request for: ${normalizedUrl}`,
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
        .eq('shop_domain', normalizedUrl)
        .gte('recommended_at', startDate.toISOString())
        .lte('recommended_at', endDate.toISOString())
        .order('recommended_at', { ascending: false });

      // Get conversions for the period
      const { data: conversions } = await client
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', normalizedUrl)
        .gte('purchased_at', startDate.toISOString())
        .lte('purchased_at', endDate.toISOString())
        .order('purchased_at', { ascending: false });

      // Get previous period data for comparison
      const { data: previousConversions } = await client
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', normalizedUrl)
        .gte('purchased_at', previousStartDate.toISOString())
        .lt('purchased_at', startDate.toISOString());

      const { data: previousRecommendations } = await client
        .from('simple_recommendations')
        .select('id')
        .eq('shop_domain', normalizedUrl)
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
          (sum: number, c: { order_amount?: number }) =>
            sum + (c.order_amount || 0),
          0
        ) || 0;
      const averageOrderValue =
        totalConversions > 0 ? totalRevenue / totalConversions : 0;
      const averageTimeToConversion =
        conversions && conversions.length > 0
          ? conversions.reduce(
              (sum: number, c: { minutes_to_conversion?: number }) =>
                sum + (c.minutes_to_conversion || 0),
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

      recommendations?.forEach((r: { recommended_at: string }) => {
        const dateKey = new Date(r.recommended_at).toISOString().split('T')[0];
        const dayData = timelineMap.get(dateKey);
        if (dayData) dayData.recommendations++;
      });

      conversions?.forEach(
        (c: { purchased_at: string; order_amount?: number }) => {
          const dateKey = new Date(c.purchased_at).toISOString().split('T')[0];
          const dayData = timelineMap.get(dateKey);
          if (dayData) {
            dayData.conversions++;
            dayData.revenue += c.order_amount || 0;
          }
        }
      );

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

      recommendations?.forEach(
        (r: { product_id: string; product_title?: string }) => {
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
        }
      );

      conversions?.forEach(
        (c: { product_id: string; order_amount?: number }) => {
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
        }
      );

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

      recommendations
        ?.slice(0, 10)
        .forEach(
          (r: {
            recommended_at: string;
            product_title?: string;
            session_id: string;
          }) => {
            recentActivity.push({
              type: 'recommendation',
              timestamp: r.recommended_at,
              productTitle: r.product_title || 'Producto',
              sessionId: r.session_id,
            });
          }
        );

      conversions
        ?.slice(0, 10)
        .forEach(
          (c: {
            purchased_at: string;
            product_id: string;
            session_id: string;
            order_amount?: number;
          }) => {
            recentActivity.push({
              type: 'conversion',
              timestamp: c.purchased_at,
              productTitle: c.product_id,
              sessionId: c.session_id,
              amount: c.order_amount,
            });
          }
        );

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

      conversions?.forEach(
        (c: { minutes_to_conversion?: number; order_amount?: number }) => {
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
        }
      );

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
          (sum: number, c: { order_amount?: number }) =>
            sum + (c.order_amount || 0),
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
      logger.error('WooCommerce embedded conversions dashboard error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/woo/embedded/widget/config
 * Get widget configuration for a WooCommerce store
 */
router.get(
  '/widget/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;

      if (!siteUrl) {
        return res.status(400).json({
          success: false,
          error: 'Site URL is required',
        });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      logger.info(
        `WooCommerce embedded widget config request for: ${normalizedUrl}`
      );

      // Try client_stores first
      const { data: clientStore } = await (supabaseService as any).serviceClient
        .from('client_stores')
        .select('*')
        .eq('shop_domain', normalizedUrl)
        .single();

      if (clientStore) {
        return res.json({
          success: true,
          data: {
            shopDomain: clientStore.shop_domain,
            platform: 'woocommerce',
            widgetEnabled: clientStore.widget_enabled,
            widgetPosition: clientStore.widget_position,
            widgetColor: clientStore.widget_color,
            widgetSecondaryColor: clientStore.widget_secondary_color,
            widgetAccentColor: clientStore.widget_accent_color,
            welcomeMessage: clientStore.welcome_message,
            welcomeMessage2: clientStore.widget_welcome_message_2,
            subtitle2: clientStore.widget_subtitle_2,
            welcomeMessage3: clientStore.widget_welcome_message_3,
            subtitle3: clientStore.widget_subtitle_3,
            rotatingMessagesEnabled:
              clientStore.widget_rotating_messages_enabled,
            rotatingMessagesInterval:
              clientStore.widget_rotating_messages_interval,
            widgetButtonSize: clientStore.widget_button_size,
            widgetButtonStyle: clientStore.widget_button_style,
            widgetShowPulse: clientStore.widget_show_pulse,
            widgetChatWidth: clientStore.widget_chat_width,
            widgetChatHeight: clientStore.widget_chat_height,
            widgetSubtitle: clientStore.widget_subtitle,
            widgetPlaceholder: clientStore.widget_placeholder,
            widgetAvatar: clientStore.widget_avatar,
            widgetShowPromoMessage: clientStore.widget_show_promo_message,
            widgetShowCart: clientStore.widget_show_cart,
            widgetShowContact: clientStore.widget_show_contact,
            retellAgentId: clientStore.retell_agent_id,
            retellFromNumber: clientStore.retell_from_number,
            widgetEnableAnimations: clientStore.widget_enable_animations,
            widgetTheme: clientStore.widget_theme,
            widgetBrandName: clientStore.widget_brand_name,
            promoBadgeEnabled: clientStore.promo_badge_enabled,
            promoBadgeDiscount: clientStore.promo_badge_discount,
            promoBadgeText: clientStore.promo_badge_text,
            promoBadgeColor: clientStore.promo_badge_color,
            promoBadgeShape: clientStore.promo_badge_shape,
            promoBadgePosition: clientStore.promo_badge_position,
            promoBadgeSuffix: clientStore.promo_badge_suffix,
            promoBadgePrefix: clientStore.promo_badge_prefix,
            promoBadgeFontSize: clientStore.promo_badge_font_size,
            chatbotEndpoint: clientStore.chatbot_endpoint,
          },
        });
      }

      // Fallback to stores table
      const { data: store, error: storeError } = await (
        supabaseService as any
      ).serviceClient
        .from('stores')
        .select('*')
        .eq('shop_domain', normalizedUrl)
        .single();

      if (storeError || !store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
        });
      }

      return res.json({
        success: true,
        data: {
          shopDomain: store.shop_domain,
          platform: store.platform || 'woocommerce',
          widgetEnabled: store.widget_enabled,
        },
      });
    } catch (error) {
      logger.error('WooCommerce embedded widget config error:', error);
      return next(error);
    }
  }
);

// ==================== Multer Config ====================

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

// ==================== AI Config Endpoints ====================

/**
 * GET /api/woo/embedded/ai-config
 * Get AI agent configuration for a WooCommerce store
 */
router.get(
  '/ai-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

      const { data: store, error } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          'chat_mode, ai_model, agent_name, agent_tone, brand_description, agent_instructions, agent_language, chatbot_endpoint'
        )
        .eq('shop_domain', normalizedUrl)
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
      logger.error('WooCommerce embedded AI config get error:', error);
      return next(error);
    }
  }
);

/**
 * PUT /api/woo/embedded/ai-config
 * Update AI agent configuration for a WooCommerce store
 */
router.put(
  '/ai-config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { siteUrl, config } = req.body;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);

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

      const updateData: Record<string, unknown> = {};
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
        .eq('shop_domain', normalizedUrl)
        .select(
          'chat_mode, ai_model, agent_name, agent_tone, brand_description, agent_instructions, agent_language, chatbot_endpoint'
        )
        .single();

      if (error) {
        logger.error('Error updating WooCommerce AI config:', error);
        return res
          .status(500)
          .json({ success: false, error: 'Failed to update AI configuration' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      logger.error('WooCommerce embedded AI config update error:', error);
      return next(error);
    }
  }
);

// ==================== Knowledge Endpoints ====================

/**
 * GET /api/woo/embedded/knowledge
 * List knowledge documents for a WooCommerce store
 */
router.get(
  '/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);
      const documents = await knowledgeService.listDocuments(normalizedUrl);

      return res.json({ success: true, data: documents });
    } catch (error) {
      logger.error('WooCommerce embedded knowledge list error:', error);
      return next(error);
    }
  }
);

/**
 * POST /api/woo/embedded/knowledge
 * Create a text-based knowledge document
 */
router.post(
  '/knowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { siteUrl, title, content } = req.body;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }
      if (!title || !content) {
        return res
          .status(400)
          .json({ success: false, error: 'Title and content are required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);
      const document = await knowledgeService.createDocument(normalizedUrl, {
        title,
        content,
        sourceType: 'text',
      });

      return res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('WooCommerce embedded knowledge create error:', error);
      return next(error);
    }
  }
);

/**
 * POST /api/woo/embedded/knowledge/upload
 * Upload a file (PDF/TXT/MD) as knowledge document
 */
router.post(
  '/knowledge/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.body.siteUrl as string;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const file = req.file;
      if (!file) {
        return res
          .status(400)
          .json({ success: false, error: 'File is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);
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

      const document = await knowledgeService.createDocument(normalizedUrl, {
        title,
        content,
        sourceType: 'file',
        originalFilename: file.originalname,
      });

      return res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('WooCommerce embedded knowledge upload error:', error);
      return next(error);
    }
  }
);

/**
 * DELETE /api/woo/embedded/knowledge/:documentId
 * Delete a knowledge document
 */
router.delete(
  '/knowledge/:documentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);
      await knowledgeService.deleteDocument(
        req.params.documentId,
        normalizedUrl
      );

      return res.json({ success: true });
    } catch (error) {
      logger.error('WooCommerce embedded knowledge delete error:', error);
      return next(error);
    }
  }
);

/**
 * GET /api/woo/embedded/knowledge/:documentId/status
 * Get document processing status
 */
router.get(
  '/knowledge/:documentId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const siteUrl = req.query.siteUrl as string;
      if (!siteUrl) {
        return res
          .status(400)
          .json({ success: false, error: 'Site URL is required' });
      }

      const normalizedUrl = normalizeWooSiteUrl(siteUrl);
      const status = await knowledgeService.getDocumentStatus(
        req.params.documentId,
        normalizedUrl
      );

      if (!status) {
        return res
          .status(404)
          .json({ success: false, error: 'Document not found' });
      }

      return res.json({ success: true, data: status });
    } catch (error) {
      logger.error('WooCommerce embedded knowledge status error:', error);
      return next(error);
    }
  }
);

// ==================== Helper Functions ====================

/**
 * Helper function to fetch all records with pagination (bypasses 1000 row limit)
 */
async function fetchAllWithPagination(
  client: any,
  table: string,
  selectFields: string,
  filters: { column: string; value: unknown; operator?: string }[],
  orderBy: string = 'created_at'
): Promise<unknown[]> {
  const PAGE_SIZE = 1000;
  let allData: unknown[] = [];
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
 * Helper function to get analytics for a store with optional date filtering
 */
async function getAnalyticsForStore(
  shopDomain: string,
  dateFilters: { start: string | null; end: string | null }
) {
  const client = (supabaseService as any).serviceClient;

  logger.info('Fetching WooCommerce analytics with pagination');

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
  const chatFilters: { column: string; value: unknown; operator?: string }[] = [
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
  const chatMessagesData = (await fetchAllWithPagination(
    client,
    'chat_messages',
    'session_id, timestamp',
    chatFilters,
    'timestamp'
  )) as Array<{ session_id: string; timestamp: string }>;

  const uniqueSessions = new Set(
    chatMessagesData.map(m => m.session_id).filter(Boolean)
  );
  const conversationCount = uniqueSessions.size;
  const messageCount = chatMessagesData.length;

  logger.info(
    `WooCommerce Analytics: Found ${messageCount} messages, ${conversationCount} conversations`
  );

  // Group by day (sessions and messages)
  const sessionsByDay: Record<string, Set<string>> = {};
  const messagesByDay: Record<string, number> = {};
  chatMessagesData.forEach(msg => {
    if (!msg.timestamp) return;
    const date = new Date(msg.timestamp).toISOString().split('T')[0];
    messagesByDay[date] = (messagesByDay[date] || 0) + 1;
    if (!msg.session_id) return;
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
  const recFilters: { column: string; value: unknown; operator?: string }[] = [
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
  const recommendationsData = (await fetchAllWithPagination(
    client,
    'simple_recommendations',
    'id, created_at',
    recFilters,
    'created_at'
  )) as Array<{ id: string; created_at: string }>;
  const recommendationCount = recommendationsData.length;

  const recByDay: Record<string, number> = {};
  recommendationsData.forEach(rec => {
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
  const convFilters: { column: string; value: unknown; operator?: string }[] = [
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

  const conversionsData = (await fetchAllWithPagination(
    client,
    'simple_conversions',
    'id, purchased_at',
    convFilters,
    'purchased_at'
  )) as Array<{ id: string; purchased_at: string }>;
  const conversionCount = conversionsData.length;

  const convByDayData: Record<string, number> = {};
  conversionsData.forEach(conv => {
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
    const extractDateStr = (isoOrDate: string): string => {
      return isoOrDate.split('T')[0];
    };

    if (!start || !end) {
      const dataDates = new Set([
        ...conversationsByDayData.map(d => d.date),
        ...recommendationsByDayData.map(d => d.date),
        ...conversionsByDayData.map(d => d.date),
      ]);
      return Array.from(dataDates).sort();
    }

    const startDateStr = extractDateStr(start);
    const endDateStr = extractDateStr(end);

    const dates: string[] = [];
    const [startYear, startMonth, startDay] = startDateStr
      .split('-')
      .map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    while (current <= endDate) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  };

  const allDatesInRange = generateDateRange(dateFilters.start, dateFilters.end);

  const convByDayMap = new Map(
    conversationsByDayData.map(d => [d.date, d.count])
  );
  const msgByDayMap = new Map(Object.entries(messagesByDay));
  const recByDayMap = new Map(
    recommendationsByDayData.map(d => [d.date, d.count])
  );
  const conversionByDayMap = new Map(
    conversionsByDayData.map(d => [d.date, d.count])
  );

  const chartDataByDay = allDatesInRange.map(date => ({
    date,
    conversations: convByDayMap.get(date) || 0,
    messages: msgByDayMap.get(date) || 0,
    recommendations: recByDayMap.get(date) || 0,
    conversions: conversionByDayMap.get(date) || 0,
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

export default router;
