import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';

interface SimpleConversionEvent {
  sessionId: string;
  shopDomain: string;
  productId: string;
  productTitle?: string;
  recommendedAt: Date;
  messageId?: string;
}

interface OrderEvent {
  orderId: string;
  shopDomain: string;
  customerId?: string;
  browserIp?: string; // IP from Shopify order for matching with chat sessions
  userAgent?: string; // User agent from Shopify order for matching with chat sessions
  products: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  createdAt: Date;
}

interface ConversionResult {
  sessionId: string;
  orderId: string;
  productId: string;
  minutesToConversion: number;
  confidence: number;
}

export class SimpleConversionTracker {
  private supabaseService: SupabaseService;

  // Attribution window: 24 hours (1440 minutes)
  private static readonly ATTRIBUTION_WINDOW_MINUTES = 1440;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Track AI product recommendation - simplified version
   */
  async trackRecommendation(event: SimpleConversionEvent): Promise<void> {
    try {
      const row = {
        session_id: event.sessionId,
        shop_domain: event.shopDomain,
        product_id: event.productId,
        product_title: event.productTitle,
        recommended_at: event.recommendedAt.toISOString(),
        message_id: event.messageId,
        expires_at: new Date(
          event.recommendedAt.getTime() +
            SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES * 60 * 1000
        ).toISOString(),
      };

      const { error } = await (this.supabaseService as any).serviceClient
        .from('simple_recommendations')
        .insert(row);

      if (error) {
        if (error.code === '23505') {
          // Duplicate — update existing record with fresh timestamps
          const { error: updateError } = await (
            this.supabaseService as any
          ).serviceClient
            .from('simple_recommendations')
            .update({
              product_title: row.product_title,
              recommended_at: row.recommended_at,
              message_id: row.message_id,
              expires_at: row.expires_at,
            })
            .eq('session_id', row.session_id)
            .eq('product_id', row.product_id)
            .eq('shop_domain', row.shop_domain);

          if (updateError) {
            logger.error('Error updating recommendation:', updateError);
          } else {
            logger.info('Recommendation updated (dedup)', {
              sessionId: event.sessionId,
              productId: event.productId,
              shopDomain: event.shopDomain,
            });
          }
        } else {
          logger.error('Error tracking recommendation:', error);
        }
      } else {
        logger.info('Recommendation tracked', {
          sessionId: event.sessionId,
          productId: event.productId,
          shopDomain: event.shopDomain,
          expiresIn: `${SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES} minutes`,
        });
      }
    } catch (error) {
      logger.error('Error tracking recommendation:', error);
    }
  }

  /**
   * Process order and find conversions - uses IP matching first, then time window as fallback
   * @param order The order event to process
   * @param dryRun If true, don't save conversions to database (for testing)
   */
  async processOrderForConversions(
    order: OrderEvent,
    dryRun: boolean = false
  ): Promise<ConversionResult[]> {
    try {
      const conversions: ConversionResult[] = [];
      const orderTime = order.createdAt;

      logger.info('Processing order for conversions', {
        orderId: order.orderId,
        shopDomain: order.shopDomain,
        orderTime: orderTime.toISOString(),
        browserIp: order.browserIp,
        productsInOrder: order.products.length,
      });

      // Strategy 1: Try IP-based matching first (most accurate)
      if (order.browserIp) {
        const ipConversions = await this.findConversionsByIP(order, dryRun);
        if (ipConversions.length > 0) {
          logger.info('Found conversions via IP matching', {
            orderId: order.orderId,
            conversionsCount: ipConversions.length,
          });
          return ipConversions;
        }
      }

      // Strategy 2: Try user-agent matching (good for mobile users with changing IPs)
      if (order.userAgent) {
        const uaConversions = await this.findConversionsByUserAgent(
          order,
          dryRun
        );
        if (uaConversions.length > 0) {
          logger.info('Found conversions via user-agent matching', {
            orderId: order.orderId,
            conversionsCount: uaConversions.length,
          });
          return uaConversions;
        }
      }

      // Strategy 3: Time-window matching (15 min, high confidence)
      const windowStart = new Date(
        orderTime.getTime() -
          SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES * 60 * 1000
      );

      // Get recent recommendations within time window
      const { data: recommendations, error } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', order.shopDomain)
        .gte('recommended_at', windowStart.toISOString())
        .lte('recommended_at', orderTime.toISOString());

      if (error) {
        logger.error('Error fetching recommendations for order:', error);
      }

      if (recommendations && recommendations.length > 0) {
        logger.info('Found recommendations via time window', {
          orderId: order.orderId,
          recommendationsCount: recommendations.length,
        });

        // Check each product in the order against recommendations (deduplicate by product)
        const attributedProducts = new Set<string>();

        for (const orderProduct of order.products) {
          // Skip if already attributed this product
          if (attributedProducts.has(orderProduct.productId)) {
            continue;
          }

          // Find the most recent recommendation for this product within time window
          const matchingRecs = recommendations
            .filter((r: any) => r.product_id === orderProduct.productId)
            .sort(
              (a: any, b: any) =>
                new Date(b.recommended_at).getTime() -
                new Date(a.recommended_at).getTime()
            );

          if (matchingRecs.length > 0) {
            attributedProducts.add(orderProduct.productId);
            const rec = matchingRecs[0]; // Most recent
            const recommendedAt = new Date(rec.recommended_at);
            const minutesToConversion = Math.round(
              (orderTime.getTime() - recommendedAt.getTime()) / (1000 * 60)
            );

            const confidence = Math.max(
              0.5,
              1 -
                minutesToConversion /
                  SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES
            );

            const conversionResult = await this.createConversion(
              order,
              orderProduct,
              rec,
              minutesToConversion,
              confidence,
              'time_window',
              dryRun
            );
            if (conversionResult) {
              conversions.push(conversionResult);
            }
          }
        }

        if (conversions.length > 0) {
          return conversions;
        }
      }

      // Strategy 4: DISABLED - Product-based attribution was too weak
      // Only IP, User-Agent, and Time-Window matching are used for accurate attribution
      logger.info('No conversion found with strong matching methods', {
        orderId: order.orderId,
        strategies: ['ip_match', 'user_agent_match', 'time_window'],
      });

      return conversions;
    } catch (error) {
      logger.error('Error processing order for conversions:', error);
      return [];
    }
  }

  /**
   * Find conversions by matching browser IP with chat session IPs
   */
  private async findConversionsByIP(
    order: OrderEvent,
    dryRun: boolean = false
  ): Promise<ConversionResult[]> {
    const conversions: ConversionResult[] = [];

    if (!order.browserIp) return conversions;

    try {
      // Find chat sessions from this IP (last 7 days)
      const sevenDaysAgo = new Date(
        order.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      const { data: chatMessages, error: chatError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, timestamp, metadata')
        .eq('shop_domain', order.shopDomain)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .lte('timestamp', order.createdAt.toISOString());

      if (chatError || !chatMessages) {
        logger.warn('Error fetching chat messages for IP matching:', chatError);
        return conversions;
      }

      // Filter sessions that match the browser IP
      const matchingSessionIds = new Set<string>();
      for (const msg of chatMessages) {
        const msgIp = msg.metadata?.['x-forwarded-for'] || msg.metadata?.ip;
        if (msgIp === order.browserIp) {
          matchingSessionIds.add(msg.session_id);
        }
      }

      if (matchingSessionIds.size === 0) {
        logger.info('No chat sessions found for IP', {
          orderId: order.orderId,
          browserIp: order.browserIp,
        });
        return conversions;
      }

      logger.info('Found chat sessions matching IP', {
        orderId: order.orderId,
        browserIp: order.browserIp,
        sessionsCount: matchingSessionIds.size,
      });

      // Get recommendations from those sessions
      const { data: recommendations, error: recError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', order.shopDomain)
        .in('session_id', Array.from(matchingSessionIds))
        .gte('recommended_at', sevenDaysAgo.toISOString())
        .lte('recommended_at', order.createdAt.toISOString());

      if (recError || !recommendations || recommendations.length === 0) {
        logger.info('No recommendations found for matching sessions', {
          orderId: order.orderId,
        });
        return conversions;
      }

      // Match order products with recommendations (deduplicate by product)
      const attributedProducts = new Set<string>();

      for (const orderProduct of order.products) {
        // Skip if already attributed this product
        if (attributedProducts.has(orderProduct.productId)) {
          continue;
        }

        // Find the most recent recommendation for this product
        const matchingRecs = recommendations
          .filter((r: any) => r.product_id === orderProduct.productId)
          .sort(
            (a: any, b: any) =>
              new Date(b.recommended_at).getTime() -
              new Date(a.recommended_at).getTime()
          );

        if (matchingRecs.length > 0) {
          attributedProducts.add(orderProduct.productId);
          const rec = matchingRecs[0]; // Most recent
          const recommendedAt = new Date(rec.recommended_at);
          const minutesToConversion = Math.round(
            (order.createdAt.getTime() - recommendedAt.getTime()) / (1000 * 60)
          );

          // Higher confidence for IP-based matching (0.7-0.95 based on time)
          const timeDecay = Math.min(1, minutesToConversion / (7 * 24 * 60)); // 7 days max
          const confidence = Math.max(0.7, 0.95 - timeDecay * 0.25);

          const conversionResult = await this.createConversion(
            order,
            orderProduct,
            rec,
            minutesToConversion,
            confidence,
            'ip_match',
            dryRun
          );
          if (conversionResult) {
            conversions.push(conversionResult);
          }
        }
      }

      return conversions;
    } catch (error) {
      logger.error('Error in IP-based conversion matching:', error);
      return conversions;
    }
  }

  /**
   * Extract device fingerprint from user-agent for flexible matching
   */
  private extractDeviceFingerprint(userAgent: string): string | null {
    if (!userAgent) return null;

    // Extract key device characteristics
    const patterns = {
      // Mobile devices - extract model
      samsungModel: /SM-[A-Z0-9]+/i,
      xiaomiModel: /\d+[A-Z]+\d+[A-Z]+/i,
      iphoneModel: /iPhone/i,
      // OS info
      androidVersion: /Android \d+/i,
      iosVersion: /iPhone OS \d+_\d+/i,
      windowsVersion: /Windows NT \d+\.\d+/i,
      // Browser
      chrome: /Chrome\/\d+/i,
      safari: /Safari\/\d+/i,
      edge: /Edg\/\d+/i,
    };

    const fingerprint: string[] = [];

    // Extract device model if available
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = userAgent.match(pattern);
      if (match) {
        fingerprint.push(match[0]);
      }
    }

    return fingerprint.length > 0 ? fingerprint.join('|') : null;
  }

  /**
   * Find conversions by matching user-agent with chat session user-agents
   * Uses flexible matching based on device fingerprint
   */
  private async findConversionsByUserAgent(
    order: OrderEvent,
    dryRun: boolean = false
  ): Promise<ConversionResult[]> {
    const conversions: ConversionResult[] = [];

    if (!order.userAgent) return conversions;

    try {
      // Find chat sessions (last 7 days)
      const sevenDaysAgo = new Date(
        order.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000
      );

      const { data: chatMessages, error: chatError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, timestamp, metadata')
        .eq('shop_domain', order.shopDomain)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .lte('timestamp', order.createdAt.toISOString());

      if (chatError || !chatMessages) {
        logger.warn(
          'Error fetching chat messages for user-agent matching:',
          chatError
        );
        return conversions;
      }

      // Extract fingerprint from order user-agent
      const orderFingerprint = this.extractDeviceFingerprint(order.userAgent);

      // Filter sessions that match the user-agent (exact or fingerprint)
      const matchingSessionIds = new Set<string>();
      for (const msg of chatMessages) {
        const msgUserAgent = msg.metadata?.['user-agent'];
        if (!msgUserAgent) continue;

        // Try exact match first
        if (msgUserAgent === order.userAgent) {
          matchingSessionIds.add(msg.session_id);
          continue;
        }

        // Try fingerprint match for mobile devices
        if (orderFingerprint) {
          const msgFingerprint = this.extractDeviceFingerprint(msgUserAgent);
          if (msgFingerprint && msgFingerprint === orderFingerprint) {
            matchingSessionIds.add(msg.session_id);
          }
        }
      }

      if (matchingSessionIds.size === 0) {
        logger.info('No chat sessions found for user-agent', {
          orderId: order.orderId,
          userAgent: order.userAgent?.substring(0, 50) + '...',
        });
        return conversions;
      }

      logger.info('Found chat sessions matching user-agent', {
        orderId: order.orderId,
        sessionsCount: matchingSessionIds.size,
      });

      // Get recommendations from those sessions
      const { data: recommendations, error: recError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', order.shopDomain)
        .in('session_id', Array.from(matchingSessionIds))
        .gte('recommended_at', sevenDaysAgo.toISOString())
        .lte('recommended_at', order.createdAt.toISOString());

      if (recError || !recommendations || recommendations.length === 0) {
        logger.info(
          'No recommendations found for user-agent matching sessions',
          {
            orderId: order.orderId,
          }
        );
        return conversions;
      }

      // Match order products with recommendations (deduplicate by product)
      const attributedProducts = new Set<string>();

      for (const orderProduct of order.products) {
        // Skip if already attributed this product
        if (attributedProducts.has(orderProduct.productId)) {
          continue;
        }

        // Find the most recent recommendation for this product
        const matchingRecs = recommendations
          .filter((r: any) => r.product_id === orderProduct.productId)
          .sort(
            (a: any, b: any) =>
              new Date(b.recommended_at).getTime() -
              new Date(a.recommended_at).getTime()
          );

        if (matchingRecs.length > 0) {
          attributedProducts.add(orderProduct.productId);
          const rec = matchingRecs[0]; // Most recent
          const recommendedAt = new Date(rec.recommended_at);
          const minutesToConversion = Math.round(
            (order.createdAt.getTime() - recommendedAt.getTime()) / (1000 * 60)
          );

          // Confidence for user-agent matching (0.6-0.9 based on time)
          const timeDecay = Math.min(1, minutesToConversion / (7 * 24 * 60)); // 7 days max
          const confidence = Math.max(0.6, 0.9 - timeDecay * 0.3);

          const conversionResult = await this.createConversion(
            order,
            orderProduct,
            rec,
            minutesToConversion,
            confidence,
            'user_agent_match',
            dryRun
          );
          if (conversionResult) {
            conversions.push(conversionResult);
          }
        }
      }

      return conversions;
    } catch (error) {
      logger.error('Error in user-agent-based conversion matching:', error);
      return conversions;
    }
  }

  /**
   * Create and save a conversion record
   */
  private async createConversion(
    order: OrderEvent,
    orderProduct: { productId: string; quantity: number; price: number },
    recommendation: any,
    minutesToConversion: number,
    confidence: number,
    matchMethod:
      | 'ip_match'
      | 'user_agent_match'
      | 'time_window'
      | 'product_attribution',
    dryRun: boolean = false
  ): Promise<ConversionResult | null> {
    try {
      if (!dryRun) {
        await this.saveConversion({
          session_id: recommendation.session_id,
          order_id: order.orderId,
          product_id: orderProduct.productId,
          shop_domain: order.shopDomain,
          recommended_at: recommendation.recommended_at,
          purchased_at: order.createdAt.toISOString(),
          minutes_to_conversion: minutesToConversion,
          confidence: confidence,
          order_quantity: orderProduct.quantity,
          order_amount: orderProduct.price * orderProduct.quantity,
          total_order_amount: order.totalAmount,
          // Use order date as created_at for proper historical reporting
          created_at: order.createdAt.toISOString(),
        });
      }

      logger.info(
        `Conversion detected${dryRun ? ' (dry run)' : ' and saved'}`,
        {
          sessionId: recommendation.session_id,
          orderId: order.orderId,
          productId: orderProduct.productId,
          minutesToConversion,
          confidence,
          matchMethod,
          dryRun,
        }
      );

      return {
        sessionId: recommendation.session_id,
        orderId: order.orderId,
        productId: orderProduct.productId,
        minutesToConversion,
        confidence: Math.round(confidence * 100) / 100,
      };
    } catch (error) {
      logger.error('Error creating conversion:', error);
      return null;
    }
  }

  /**
   * Save conversion to database
   */
  private async saveConversion(conversion: any): Promise<void> {
    try {
      const { error } = await (this.supabaseService as any).serviceClient
        .from('simple_conversions')
        .insert(conversion);

      if (error) {
        logger.error('Error saving conversion:', error);
      }
    } catch (error) {
      logger.error('Error saving conversion:', error);
    }
  }

  /**
   * Get conversion stats for a shop
   */
  async getConversionStats(
    shopDomain: string,
    daysBack: number = 7
  ): Promise<{
    totalRecommendations: number;
    totalConversions: number;
    conversionRate: number;
    averageMinutesToConversion: number;
    totalRevenue: number;
    topConvertingProducts: Array<{
      productId: string;
      productTitle: string;
      conversions: number;
      revenue: number;
    }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - daysBack * 24 * 60 * 60 * 1000
      );

      // Get unique recommendations count (distinct session+product combos)
      const { data: recommendations, error: recError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('session_id, product_id')
        .eq('shop_domain', shopDomain)
        .gte('recommended_at', startDate.toISOString());

      // Get conversions with details
      const { data: conversions, error: convError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shopDomain)
        .gte('purchased_at', startDate.toISOString());

      // Count unique session+product combos (not raw rows)
      const uniqueRecSet = new Set(
        (recommendations || []).map(
          (r: any) => `${r.session_id}:${r.product_id}`
        )
      );
      const totalRecommendations = uniqueRecSet.size;
      const totalConversions = conversions?.length || 0;
      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;

      const averageMinutesToConversion =
        conversions && conversions.length > 0
          ? conversions.reduce((sum, c) => sum + c.minutes_to_conversion, 0) /
            conversions.length
          : 0;

      const totalRevenue =
        conversions?.reduce((sum, c) => sum + (c.order_amount || 0), 0) || 0;

      // Group by product for top converting products
      const productStats = new Map();
      conversions?.forEach(c => {
        const key = c.product_id;
        if (!productStats.has(key)) {
          productStats.set(key, {
            productId: c.product_id,
            productTitle: 'Product', // We'll need to fetch this separately if needed
            conversions: 0,
            revenue: 0,
          });
        }
        const stats = productStats.get(key);
        stats.conversions++;
        stats.revenue += c.order_amount || 0;
      });

      const topConvertingProducts = Array.from(productStats.values())
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 10);

      logger.info('Conversion stats calculated', {
        shopDomain,
        daysBack,
        totalRecommendations,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      });

      return {
        totalRecommendations,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageMinutesToConversion:
          Math.round(averageMinutesToConversion * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        topConvertingProducts,
      };
    } catch (error) {
      logger.error('Error getting conversion stats:', error);
      return {
        totalRecommendations: 0,
        totalConversions: 0,
        conversionRate: 0,
        averageMinutesToConversion: 0,
        totalRevenue: 0,
        topConvertingProducts: [],
      };
    }
  }

  /**
   * Clean up expired recommendations
   * Disabled: recommendations are preserved for analytics/dashboard.
   * The expires_at field is still used for conversion attribution window filtering.
   */
  async cleanupExpiredRecommendations(shopDomain?: string): Promise<void> {
    // No-op: keep all recommendations for analytics reporting
    logger.debug('Skipping recommendation cleanup (preserved for analytics)', {
      shopDomain,
    });
  }
}
