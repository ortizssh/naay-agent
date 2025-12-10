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

  // Simplified: 10 minutes attribution window
  private static readonly ATTRIBUTION_WINDOW_MINUTES = 10;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Track AI product recommendation - simplified version
   */
  async trackRecommendation(event: SimpleConversionEvent): Promise<void> {
    try {
      const { error } = await (this.supabaseService as any).serviceClient
        .from('simple_recommendations')
        .insert({
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
        });

      if (error) {
        logger.error('Error tracking recommendation:', error);
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
   * Process order and find conversions - simplified version
   */
  async processOrderForConversions(
    order: OrderEvent
  ): Promise<ConversionResult[]> {
    try {
      const conversions: ConversionResult[] = [];
      const orderTime = order.createdAt;

      // Look for recommendations in the last 10 minutes
      const windowStart = new Date(
        orderTime.getTime() -
          SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES * 60 * 1000
      );

      logger.info('Processing order for conversions', {
        orderId: order.orderId,
        shopDomain: order.shopDomain,
        orderTime: orderTime.toISOString(),
        windowStart: windowStart.toISOString(),
        productsInOrder: order.products.length,
      });

      // Get recent recommendations that haven't expired
      const { data: recommendations, error } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', order.shopDomain)
        .gte('recommended_at', windowStart.toISOString())
        .lte('recommended_at', orderTime.toISOString())
        .gt('expires_at', orderTime.toISOString()); // Not expired yet

      if (error) {
        logger.error('Error fetching recommendations for order:', error);
        return conversions;
      }

      if (!recommendations || recommendations.length === 0) {
        logger.info('No recent recommendations found for order', {
          orderId: order.orderId,
          windowStart: windowStart.toISOString(),
          orderTime: orderTime.toISOString(),
        });
        return conversions;
      }

      logger.info('Found recent recommendations', {
        orderId: order.orderId,
        recommendationsCount: recommendations.length,
        recommendations: recommendations.map(r => ({
          sessionId: r.session_id,
          productId: r.product_id,
          recommendedAt: r.recommended_at,
        })),
      });

      // Check each product in the order against recommendations
      for (const orderProduct of order.products) {
        for (const rec of recommendations) {
          if (rec.product_id === orderProduct.productId) {
            const recommendedAt = new Date(rec.recommended_at);
            const minutesToConversion = Math.round(
              (orderTime.getTime() - recommendedAt.getTime()) / (1000 * 60)
            );

            // Simple confidence: closer to recommendation = higher confidence
            const confidence = Math.max(
              0.1,
              1 -
                minutesToConversion /
                  SimpleConversionTracker.ATTRIBUTION_WINDOW_MINUTES
            );

            conversions.push({
              sessionId: rec.session_id,
              orderId: order.orderId,
              productId: orderProduct.productId,
              minutesToConversion,
              confidence: Math.round(confidence * 100) / 100,
            });

            // Save the conversion
            await this.saveConversion({
              session_id: rec.session_id,
              order_id: order.orderId,
              product_id: orderProduct.productId,
              shop_domain: order.shopDomain,
              recommended_at: rec.recommended_at,
              purchased_at: orderTime.toISOString(),
              minutes_to_conversion: minutesToConversion,
              confidence: confidence,
              order_quantity: orderProduct.quantity,
              order_amount: orderProduct.price * orderProduct.quantity,
              total_order_amount: order.totalAmount,
            });

            logger.info('Conversion detected and saved', {
              sessionId: rec.session_id,
              orderId: order.orderId,
              productId: orderProduct.productId,
              minutesToConversion,
              confidence,
            });
          }
        }
      }

      return conversions;
    } catch (error) {
      logger.error('Error processing order for conversions:', error);
      return [];
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

      // Get total recommendations
      const { data: recommendations, error: recError } = await (
        this.supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('id')
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

      const totalRecommendations = recommendations?.length || 0;
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
   * Clean up expired recommendations (older than 10 minutes)
   */
  async cleanupExpiredRecommendations(shopDomain?: string): Promise<void> {
    try {
      const now = new Date();
      let query = (this.supabaseService as any).serviceClient
        .from('simple_recommendations')
        .delete()
        .lt('expires_at', now.toISOString());

      if (shopDomain) {
        query = query.eq('shop_domain', shopDomain);
      }

      const { error } = await query;

      if (error) {
        logger.error('Error cleaning up expired recommendations:', error);
      } else {
        logger.info('Expired recommendations cleaned up', { shopDomain });
      }
    } catch (error) {
      logger.error('Error cleaning up expired recommendations:', error);
    }
  }
}
