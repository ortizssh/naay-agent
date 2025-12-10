import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';

interface RealOrder {
  id: string;
  name: string;
  created_at: string;
  total_price: string;
  currency: string;
  line_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    title: string;
    quantity: number;
    price: string;
  }>;
  customer?: {
    id: string;
    email: string;
  };
}

interface RecommendationMatch {
  recommendationId: string;
  sessionId: string;
  orderId: string;
  orderName: string;
  productId: string;
  productTitle: string;
  shopDomain: string;
  recommendedAt: Date;
  purchasedAt: Date;
  minutesToConversion: number;
  confidence: number;
  orderAmount: number;
  orderQuantity: number;
  totalOrderAmount: number;
  customerId?: string;
  customerEmail?: string;
}

export class RealConversionAnalyzer {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;
  
  private static readonly ATTRIBUTION_WINDOW_MINUTES = 10;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Analyze real conversions for a shop using Shopify API data
   */
  async analyzeRealConversions(
    shopDomain: string,
    daysBack: number = 7,
    saveResults: boolean = true
  ): Promise<{
    ordersAnalyzed: number;
    conversionsFound: number;
    totalRevenue: number;
    conversions: RecommendationMatch[];
    summary: {
      conversionRate: number;
      averageMinutesToConversion: number;
      averageOrderValue: number;
      topProducts: Array<{
        productId: string;
        productTitle: string;
        conversions: number;
        revenue: number;
      }>;
    };
  }> {
    logger.info('Starting real conversion analysis', {
      shopDomain,
      daysBack,
      saveResults,
      attributionWindow: RealConversionAnalyzer.ATTRIBUTION_WINDOW_MINUTES
    });

    try {
      // 1. Get store access token
      const store = await this.supabaseService.getStore(shopDomain);
      if (!store) {
        throw new Error(`Store ${shopDomain} not found`);
      }

      // 2. Get recent recommendations from our system
      const recommendations = await this.getRecentRecommendations(shopDomain, daysBack);
      logger.info('Retrieved recommendations', { 
        count: recommendations.length,
        shopDomain 
      });

      if (recommendations.length === 0) {
        logger.info('No recommendations found, returning empty analysis');
        return {
          ordersAnalyzed: 0,
          conversionsFound: 0,
          totalRevenue: 0,
          conversions: [],
          summary: {
            conversionRate: 0,
            averageMinutesToConversion: 0,
            averageOrderValue: 0,
            topProducts: []
          }
        };
      }

      // 3. Get real orders from Shopify for the same period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const endDate = new Date();

      const realOrders = await this.getRealOrdersFromShopify(
        shopDomain,
        store.access_token,
        startDate,
        endDate
      );

      logger.info('Retrieved real orders from Shopify', { 
        count: realOrders.length,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`
      });

      // 4. Find matches between recommendations and real orders
      const conversions = this.findRealConversions(recommendations, realOrders, shopDomain);
      
      logger.info('Found real conversions', { 
        conversions: conversions.length,
        uniqueSessions: new Set(conversions.map(c => c.sessionId)).size,
        uniqueOrders: new Set(conversions.map(c => c.orderId)).size
      });

      // 5. Save results if requested
      if (saveResults && conversions.length > 0) {
        await this.saveRealConversions(conversions);
      }

      // 6. Calculate summary statistics
      const summary = this.calculateRealConversionSummary(
        conversions,
        recommendations.length,
        realOrders
      );

      const result = {
        ordersAnalyzed: realOrders.length,
        conversionsFound: conversions.length,
        totalRevenue: summary.totalRevenue,
        conversions,
        summary: {
          conversionRate: summary.conversionRate,
          averageMinutesToConversion: summary.averageMinutesToConversion,
          averageOrderValue: summary.averageOrderValue,
          topProducts: summary.topProducts
        }
      };

      logger.info('Real conversion analysis completed', {
        shopDomain,
        ...result,
        summary: result.summary
      });

      return result;

    } catch (error) {
      logger.error('Error in real conversion analysis:', error);
      throw error;
    }
  }

  /**
   * Get recent AI recommendations from our database
   */
  private async getRecentRecommendations(
    shopDomain: string,
    daysBack: number
  ): Promise<Array<{
    id: string;
    session_id: string;
    product_id: string;
    product_title: string;
    recommended_at: string;
    message_id?: string;
  }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: recommendations, error } = await (this.supabaseService as any).serviceClient
      .from('simple_recommendations')
      .select('*')
      .eq('shop_domain', shopDomain)
      .gte('recommended_at', cutoffDate.toISOString())
      .order('recommended_at', { ascending: true });

    if (error) {
      logger.error('Error fetching recommendations:', error);
      return [];
    }

    return recommendations || [];
  }

  /**
   * Get real orders from Shopify API
   */
  private async getRealOrdersFromShopify(
    shopDomain: string,
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<RealOrder[]> {
    try {
      // Use the existing Shopify service method
      const orders = await this.shopifyService.getOrdersByDateRange(
        shopDomain,
        accessToken,
        startDate.toISOString(),
        endDate.toISOString()
      );

      // Transform to our interface
      const transformedOrders: RealOrder[] = orders.map(order => ({
        id: order.id,
        name: order.name,
        created_at: order.created_at,
        total_price: order.total_price,
        currency: order.currency || 'EUR',
        line_items: (order.line_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product?.id || '',
          variant_id: item.variant?.id || '',
          title: item.title,
          quantity: item.quantity,
          price: item.variant?.price || '0'
        })),
        customer: order.customer ? {
          id: order.customer.id,
          email: order.customer.email
        } : undefined
      }));

      return transformedOrders;
    } catch (error) {
      logger.error('Error fetching orders from Shopify:', error);
      return [];
    }
  }

  /**
   * Find matches between AI recommendations and real orders
   */
  private findRealConversions(
    recommendations: Array<{
      id: string;
      session_id: string;
      product_id: string;
      product_title: string;
      recommended_at: string;
    }>,
    realOrders: RealOrder[],
    shopDomain: string
  ): RecommendationMatch[] {
    const conversions: RecommendationMatch[] = [];

    logger.info('Processing real conversion matches', {
      recommendations: recommendations.length,
      orders: realOrders.length
    });

    // Create a map for faster lookups
    const recsBySession = new Map<string, typeof recommendations>();
    recommendations.forEach(rec => {
      if (!recsBySession.has(rec.session_id)) {
        recsBySession.set(rec.session_id, []);
      }
      recsBySession.get(rec.session_id)!.push(rec);
    });

    for (const order of realOrders) {
      const orderTime = new Date(order.created_at);

      for (const lineItem of order.line_items) {
        if (!lineItem.product_id) continue;

        // Look for recommendations that match this product
        for (const [sessionId, sessionRecs] of recsBySession) {
          for (const rec of sessionRecs) {
            // Match by product ID or title similarity
            const isMatch = this.isProductMatch(rec, lineItem);

            if (isMatch) {
              const recTime = new Date(rec.recommended_at);
              const timeDiffMs = orderTime.getTime() - recTime.getTime();
              const minutesToConversion = Math.round(timeDiffMs / (1000 * 60));

              // Check if within attribution window
              if (minutesToConversion >= 0 && minutesToConversion <= RealConversionAnalyzer.ATTRIBUTION_WINDOW_MINUTES) {
                const confidence = Math.max(0.1, 1 - (minutesToConversion / RealConversionAnalyzer.ATTRIBUTION_WINDOW_MINUTES));
                const orderAmount = parseFloat(lineItem.price) * lineItem.quantity;

                conversions.push({
                  recommendationId: rec.id,
                  sessionId: rec.session_id,
                  orderId: order.id,
                  orderName: order.name,
                  productId: lineItem.product_id,
                  productTitle: lineItem.title,
                  shopDomain: shopDomain, // Pass from parameter
                  recommendedAt: recTime,
                  purchasedAt: orderTime,
                  minutesToConversion,
                  confidence: Math.round(confidence * 100) / 100,
                  orderAmount,
                  orderQuantity: lineItem.quantity,
                  totalOrderAmount: parseFloat(order.total_price),
                  customerId: order.customer?.id,
                  customerEmail: order.customer?.email
                });

                logger.info('Real conversion match found', {
                  sessionId: rec.session_id,
                  orderId: order.id,
                  productId: lineItem.product_id,
                  minutesToConversion,
                  confidence,
                  orderAmount
                });
              }
            }
          }
        }
      }
    }

    return conversions;
  }

  /**
   * Check if a recommendation matches an order line item
   */
  private isProductMatch(
    recommendation: { product_id: string; product_title: string },
    lineItem: { product_id: string; title: string }
  ): boolean {
    // Direct product ID match (if we have Shopify product IDs)
    if (recommendation.product_id === lineItem.product_id) {
      return true;
    }

    // Fuzzy title matching
    const recTitle = recommendation.product_title.toLowerCase();
    const itemTitle = lineItem.title.toLowerCase();

    // Check for significant overlap in product names
    const recWords = recTitle.split(/\s+/).filter(w => w.length > 3);
    const itemWords = itemTitle.split(/\s+/).filter(w => w.length > 3);

    const matchingWords = recWords.filter(word => 
      itemWords.some(itemWord => 
        itemWord.includes(word) || word.includes(itemWord)
      )
    );

    // If at least 60% of significant words match, consider it a match
    const matchRatio = matchingWords.length / Math.max(recWords.length, 1);
    
    if (matchRatio >= 0.6) {
      logger.debug('Fuzzy product match found', {
        recTitle,
        itemTitle,
        matchRatio,
        matchingWords
      });
      return true;
    }

    return false;
  }

  /**
   * Save real conversions to database
   */
  private async saveRealConversions(conversions: RecommendationMatch[]): Promise<void> {
    if (conversions.length === 0) return;

    const insertData = conversions.map(conv => ({
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
      customer_id: conv.customerId,
      customer_email: conv.customerEmail,
      is_real_conversion: true // Flag to distinguish from simulated
    }));

    const batchSize = 50;
    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      
      const { error } = await (this.supabaseService as any).serviceClient
        .from('simple_conversions')
        .upsert(batch, {
          onConflict: 'session_id,order_id,product_id',
          ignoreDuplicates: true
        });

      if (error) {
        logger.error('Error saving real conversion batch:', { 
          error: error.message,
          batchIndex: Math.floor(i / batchSize) + 1
        });
      } else {
        logger.info('Saved real conversion batch', { 
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length
        });
      }
    }
  }

  /**
   * Calculate summary statistics for real conversions
   */
  private calculateRealConversionSummary(
    conversions: RecommendationMatch[],
    totalRecommendations: number,
    realOrders: RealOrder[]
  ) {
    const totalRevenue = conversions.reduce((sum, conv) => sum + conv.orderAmount, 0);
    const averageMinutesToConversion = conversions.length > 0 
      ? conversions.reduce((sum, conv) => sum + conv.minutesToConversion, 0) / conversions.length
      : 0;
    const conversionRate = totalRecommendations > 0 
      ? (conversions.length / totalRecommendations) * 100 
      : 0;
    const averageOrderValue = realOrders.length > 0
      ? realOrders.reduce((sum, order) => sum + parseFloat(order.total_price), 0) / realOrders.length
      : 0;

    // Calculate top converting products
    const productStats = new Map<string, { conversions: number; revenue: number; title: string }>();
    conversions.forEach(conv => {
      const key = conv.productId;
      if (!productStats.has(key)) {
        productStats.set(key, { conversions: 0, revenue: 0, title: conv.productTitle });
      }
      const stats = productStats.get(key)!;
      stats.conversions++;
      stats.revenue += conv.orderAmount;
    });

    const topProducts = Array.from(productStats.entries())
      .map(([productId, stats]) => ({
        productId,
        productTitle: stats.title,
        conversions: stats.conversions,
        revenue: Math.round(stats.revenue * 100) / 100
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageMinutesToConversion: Math.round(averageMinutesToConversion * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      topProducts
    };
  }

  /**
   * Get real conversion analytics for a time period
   */
  async getRealConversionAnalytics(
    shopDomain: string,
    daysBack: number = 30
  ): Promise<{
    realConversions: number;
    simulatedConversions: number;
    totalRevenue: number;
    realVsSimulatedRatio: number;
    accuracy: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: conversions, error } = await (this.supabaseService as any).serviceClient
      .from('simple_conversions')
      .select('*')
      .eq('shop_domain', shopDomain)
      .gte('purchased_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Error fetching conversion analytics:', error);
      throw error;
    }

    const realConversions = (conversions || []).filter(c => c.is_real_conversion).length;
    const simulatedConversions = (conversions || []).filter(c => !c.is_real_conversion).length;
    const totalRevenue = (conversions || []).reduce((sum, c) => sum + (c.order_amount || 0), 0);
    
    const realVsSimulatedRatio = simulatedConversions > 0 
      ? realConversions / simulatedConversions 
      : 0;

    // Simple accuracy measure: how close real conversions are to simulated predictions
    const accuracy = simulatedConversions > 0 
      ? Math.min(100, (realConversions / simulatedConversions) * 100)
      : 0;

    return {
      realConversions,
      simulatedConversions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      realVsSimulatedRatio: Math.round(realVsSimulatedRatio * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100
    };
  }
}