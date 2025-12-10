import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';

interface HistoricalRecommendation {
  id: string;
  session_id: string;
  shop_domain: string;
  message_id?: string;
  recommended_product_id: string;
  recommendation_type: string;
  recommendation_context: any;
  created_at: string;
  customer_id?: string;
  cart_id?: string;
}

interface HistoricalOrder {
  id: string;
  order_id: string;
  shop_domain: string;
  customer_id?: string;
  total_amount: number;
  order_created_at: string;
  line_items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

interface ConversionMatch {
  recommendationId: string;
  sessionId: string;
  orderId: string;
  productId: string;
  shopDomain: string;
  recommendedAt: Date;
  purchasedAt: Date;
  minutesToConversion: number;
  confidence: number;
  orderQuantity: number;
  orderAmount: number;
  totalOrderAmount: number;
}

export class HistoricalConversionMigrator {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;

  // 10-minute attribution window (same as new system)
  private static readonly ATTRIBUTION_WINDOW_MINUTES = 10;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Main migration function - processes all historical data
   */
  async migrateHistoricalConversions(
    shopDomain?: string,
    daysBack: number = 30,
    dryRun: boolean = true
  ): Promise<{
    processed: {
      recommendations: number;
      orders: number;
      conversions: number;
    };
    conversions: ConversionMatch[];
    summary: {
      totalRevenue: number;
      averageMinutesToConversion: number;
      conversionRate: number;
    };
  }> {
    logger.info('Starting historical conversion migration', {
      shopDomain,
      daysBack,
      dryRun,
      attributionWindowMinutes:
        HistoricalConversionMigrator.ATTRIBUTION_WINDOW_MINUTES,
    });

    try {
      // 1. Get historical recommendations
      const recommendations = await this.getHistoricalRecommendations(
        shopDomain,
        daysBack
      );
      logger.info('Retrieved historical recommendations', {
        count: recommendations.length,
      });

      // 2. Get historical orders
      const orders = await this.getHistoricalOrders(shopDomain, daysBack);
      logger.info('Retrieved historical orders', { count: orders.length });

      // 3. Find conversions
      const conversions = await this.findHistoricalConversions(
        recommendations,
        orders
      );
      logger.info('Found historical conversions', {
        count: conversions.length,
      });

      // 4. Save conversions (if not dry run)
      if (!dryRun) {
        await this.saveHistoricalConversions(conversions);
        logger.info('Saved historical conversions to database');
      } else {
        logger.info('DRY RUN: Conversions would be saved', {
          count: conversions.length,
        });
      }

      // 5. Calculate summary stats
      const summary = this.calculateSummaryStats(
        conversions,
        recommendations.length
      );

      const result = {
        processed: {
          recommendations: recommendations.length,
          orders: orders.length,
          conversions: conversions.length,
        },
        conversions,
        summary,
      };

      logger.info('Historical conversion migration completed', {
        ...result.processed,
        summary,
        dryRun,
      });

      return result;
    } catch (error) {
      logger.error('Error in historical conversion migration:', error);
      throw error;
    }
  }

  /**
   * Get historical AI recommendations from existing system
   */
  private async getHistoricalRecommendations(
    shopDomain?: string,
    daysBack: number = 30
  ): Promise<HistoricalRecommendation[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      let query = (this.supabaseService as any).serviceClient
        .from('ai_recommendation_events')
        .select(
          `
          id,
          session_id,
          shop_domain,
          message_id,
          recommended_product_id,
          recommendation_type,
          recommendation_context,
          created_at,
          customer_id,
          cart_id
        `
        )
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true });

      if (shopDomain) {
        query = query.eq('shop_domain', shopDomain);
      }

      const { data: recommendations, error } = await query;

      if (error) {
        logger.error('Error fetching historical recommendations:', error);
        return [];
      }

      return recommendations || [];
    } catch (error) {
      logger.error('Error in getHistoricalRecommendations:', error);
      return [];
    }
  }

  /**
   * Get historical orders from existing system
   */
  private async getHistoricalOrders(
    shopDomain?: string,
    daysBack: number = 30
  ): Promise<HistoricalOrder[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      let orderQuery = (this.supabaseService as any).serviceClient
        .from('order_completion_events')
        .select(
          `
          id,
          order_id,
          shop_domain,
          customer_id,
          total_amount,
          order_created_at
        `
        )
        .gte('order_created_at', cutoffDate.toISOString())
        .order('order_created_at', { ascending: true });

      if (shopDomain) {
        orderQuery = orderQuery.eq('shop_domain', shopDomain);
      }

      const { data: orders, error: orderError } = await orderQuery;

      if (orderError) {
        logger.error('Error fetching historical orders:', orderError);
        return [];
      }

      if (!orders || orders.length === 0) {
        return [];
      }

      // Get line items for each order
      const enrichedOrders: HistoricalOrder[] = [];

      for (const order of orders) {
        const { data: lineItems, error: lineError } = await (
          this.supabaseService as any
        ).serviceClient
          .from('order_line_items')
          .select(
            `
            product_id,
            quantity,
            unit_price,
            total_price
          `
          )
          .eq('order_event_id', order.id);

        if (lineError) {
          logger.warn('Error fetching line items for order:', {
            orderId: order.order_id,
            error: lineError,
          });
          continue;
        }

        enrichedOrders.push({
          ...order,
          line_items: (lineItems || [])
            .map(item => ({
              product_id: item.product_id?.toString(),
              quantity: parseInt(item.quantity) || 1,
              unit_price: parseFloat(item.unit_price) || 0,
              total_price: parseFloat(item.total_price) || 0,
            }))
            .filter(item => item.product_id), // Only items with valid product IDs
        });
      }

      return enrichedOrders;
    } catch (error) {
      logger.error('Error in getHistoricalOrders:', error);
      return [];
    }
  }

  /**
   * Find conversions by matching recommendations with orders within time window
   */
  private async findHistoricalConversions(
    recommendations: HistoricalRecommendation[],
    orders: HistoricalOrder[]
  ): Promise<ConversionMatch[]> {
    const conversions: ConversionMatch[] = [];
    let matchesFound = 0;

    logger.info('Processing conversion matches', {
      recommendations: recommendations.length,
      orders: orders.length,
    });

    // Group recommendations by shop and session for faster lookup
    const recsByShopAndSession = new Map<
      string,
      Map<string, HistoricalRecommendation[]>
    >();

    recommendations.forEach(rec => {
      if (!recsByShopAndSession.has(rec.shop_domain)) {
        recsByShopAndSession.set(rec.shop_domain, new Map());
      }
      const shopMap = recsByShopAndSession.get(rec.shop_domain)!;

      if (!shopMap.has(rec.session_id)) {
        shopMap.set(rec.session_id, []);
      }
      shopMap.get(rec.session_id)!.push(rec);
    });

    for (const order of orders) {
      const orderTime = new Date(order.order_created_at);
      const shopRecommendations = recsByShopAndSession.get(order.shop_domain);

      if (!shopRecommendations) {
        continue;
      }

      // Check each product in the order
      for (const lineItem of order.line_items) {
        if (!lineItem.product_id) continue;

        // Look for recommendations for this product within the attribution window
        for (const [sessionId, sessionRecs] of shopRecommendations) {
          for (const rec of sessionRecs) {
            if (rec.recommended_product_id === lineItem.product_id) {
              const recTime = new Date(rec.created_at);
              const timeDiffMs = orderTime.getTime() - recTime.getTime();
              const minutesToConversion = Math.round(timeDiffMs / (1000 * 60));

              // Check if within attribution window (10 minutes)
              if (
                minutesToConversion >= 0 &&
                minutesToConversion <=
                  HistoricalConversionMigrator.ATTRIBUTION_WINDOW_MINUTES
              ) {
                // Calculate confidence based on time proximity
                const confidence = Math.max(
                  0.1,
                  1 -
                    minutesToConversion /
                      HistoricalConversionMigrator.ATTRIBUTION_WINDOW_MINUTES
                );

                conversions.push({
                  recommendationId: rec.id,
                  sessionId: rec.session_id,
                  orderId: order.order_id,
                  productId: lineItem.product_id,
                  shopDomain: order.shop_domain,
                  recommendedAt: recTime,
                  purchasedAt: orderTime,
                  minutesToConversion,
                  confidence: Math.round(confidence * 100) / 100,
                  orderQuantity: lineItem.quantity,
                  orderAmount: lineItem.total_price,
                  totalOrderAmount: order.total_amount,
                });

                matchesFound++;

                if (matchesFound % 10 === 0) {
                  logger.info('Conversion matches progress', { matchesFound });
                }
              }
            }
          }
        }
      }
    }

    logger.info('Conversion matching completed', {
      totalMatches: conversions.length,
      uniqueSessions: new Set(conversions.map(c => c.sessionId)).size,
      uniqueOrders: new Set(conversions.map(c => c.orderId)).size,
    });

    return conversions;
  }

  /**
   * Save historical conversions to the new simple_conversions table
   */
  private async saveHistoricalConversions(
    conversions: ConversionMatch[]
  ): Promise<void> {
    if (conversions.length === 0) {
      return;
    }

    // Batch insert conversions
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < conversions.length; i += batchSize) {
      const batch = conversions.slice(i, i + batchSize);

      const insertData = batch.map(conv => ({
        session_id: conv.sessionId,
        order_id: conv.orderId,
        product_id: conv.productId,
        shop_domain: conv.shopDomain,
        recommended_at: conv.recommendedAt.toISOString(),
        purchased_at: conv.purchasedAt.toISOString(),
        minutes_to_conversion: conv.minutesToConversion,
        confidence: conv.confidence,
        order_quantity: conv.orderQuantity,
        order_amount: conv.orderAmount,
        total_order_amount: conv.totalOrderAmount,
      }));

      const { error } = await (this.supabaseService as any).serviceClient
        .from('simple_conversions')
        .upsert(insertData, {
          onConflict: 'session_id,order_id,product_id',
          ignoreDuplicates: true,
        });

      if (error) {
        logger.error('Error inserting conversion batch:', {
          batchStart: i,
          batchSize: batch.length,
          error,
        });
      } else {
        inserted += batch.length;
        logger.info('Inserted conversion batch', {
          batchStart: i,
          batchSize: batch.length,
          totalInserted: inserted,
        });
      }
    }

    logger.info('Historical conversions save completed', {
      totalConversions: conversions.length,
      inserted,
    });
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummaryStats(
    conversions: ConversionMatch[],
    totalRecommendations: number
  ): {
    totalRevenue: number;
    averageMinutesToConversion: number;
    conversionRate: number;
  } {
    const totalRevenue = conversions.reduce(
      (sum, conv) => sum + conv.orderAmount,
      0
    );
    const averageMinutesToConversion =
      conversions.length > 0
        ? conversions.reduce((sum, conv) => sum + conv.minutesToConversion, 0) /
          conversions.length
        : 0;
    const conversionRate =
      totalRecommendations > 0
        ? (conversions.length / totalRecommendations) * 100
        : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageMinutesToConversion:
        Math.round(averageMinutesToConversion * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  /**
   * Get migration progress for a specific shop
   */
  async getMigrationStatus(shopDomain: string): Promise<{
    hasHistoricalRecommendations: boolean;
    hasHistoricalOrders: boolean;
    hasSimpleConversions: boolean;
    counts: {
      recommendations: number;
      orders: number;
      simpleConversions: number;
    };
    lastRecommendation?: string;
    lastOrder?: string;
    lastConversion?: string;
  }> {
    try {
      const [recCount, orderCount, conversionCount] = await Promise.all([
        // Count historical recommendations
        (this.supabaseService as any).serviceClient
          .from('ai_recommendation_events')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain),

        // Count historical orders
        (this.supabaseService as any).serviceClient
          .from('order_completion_events')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain),

        // Count simple conversions
        (this.supabaseService as any).serviceClient
          .from('simple_conversions')
          .select('*', { count: 'exact', head: true })
          .eq('shop_domain', shopDomain),
      ]);

      // Get latest timestamps
      const [lastRec, lastOrder, lastConv] = await Promise.all([
        (this.supabaseService as any).serviceClient
          .from('ai_recommendation_events')
          .select('created_at')
          .eq('shop_domain', shopDomain)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),

        (this.supabaseService as any).serviceClient
          .from('order_completion_events')
          .select('order_created_at')
          .eq('shop_domain', shopDomain)
          .order('order_created_at', { ascending: false })
          .limit(1)
          .single(),

        (this.supabaseService as any).serviceClient
          .from('simple_conversions')
          .select('purchased_at')
          .eq('shop_domain', shopDomain)
          .order('purchased_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      return {
        hasHistoricalRecommendations: (recCount.count || 0) > 0,
        hasHistoricalOrders: (orderCount.count || 0) > 0,
        hasSimpleConversions: (conversionCount.count || 0) > 0,
        counts: {
          recommendations: recCount.count || 0,
          orders: orderCount.count || 0,
          simpleConversions: conversionCount.count || 0,
        },
        lastRecommendation: lastRec.data?.created_at,
        lastOrder: lastOrder.data?.order_created_at,
        lastConversion: lastConv.data?.purchased_at,
      };
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    }
  }
}
