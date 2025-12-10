import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { ChatMessage, AgentResponse, ShopifyProduct } from '@/types';

interface AIRecommendationEvent {
  sessionId: string;
  shopDomain: string;
  messageId?: string;
  recommendedProductId: string;
  recommendedVariantId?: string;
  recommendationType:
    | 'search_result'
    | 'related_product'
    | 'complementary'
    | 'upsell'
    | 'popular'
    | 'semantic_match';
  recommendationContext: Record<string, any>;
  recommendationPosition?: number;
  recommendationScore?: number;
  customerId?: string;
  cartId?: string;
}

interface CartAdditionEvent {
  shopDomain: string;
  cartId: string;
  customerId?: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice?: number;
  source: 'ai_recommendation' | 'direct_add' | 'search' | 'browse' | 'unknown';
  sessionId?: string;
  recommendationEventId?: string;
  metadata?: Record<string, any>;
}

interface OrderCompletionEvent {
  shopDomain: string;
  orderId: string;
  orderNumber?: string;
  customerId?: string;
  totalAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  currencyCode?: string;
  orderCreatedAt: Date;
  financialStatus?: string;
  fulfillmentStatus?: string;
  lineItems: OrderLineItem[];
}

interface OrderLineItem {
  lineItemId?: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productTitle?: string;
  variantTitle?: string;
}

interface ConversionMetrics {
  dateRange: {
    from: Date;
    to: Date;
  };
  totalRecommendations: number;
  totalCartAdditions: number;
  totalOrders: number;
  totalRevenue: number;
  attributedCartAdditions: number;
  attributedOrders: number;
  attributedRevenue: number;
  conversionRates: {
    recommendationToCart: number;
    recommendationToPurchase: number;
    cartToPurchase: number;
  };
  topPerformingProducts: Array<{
    productId: string;
    title: string;
    recommendations: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  recommendationTypePerformance: Record<
    string,
    {
      recommendations: number;
      conversions: number;
      revenue: number;
      conversionRate: number;
    }
  >;
}

export class ConversionTrackingService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Extract and log AI recommendations from agent responses
   */
  async trackAIRecommendations(
    sessionId: string,
    shopDomain: string,
    agentResponse: AgentResponse,
    messageId?: string,
    customerId?: string,
    cartId?: string
  ): Promise<string[]> {
    try {
      const recommendationEvents: AIRecommendationEvent[] = [];

      // Extract product recommendations from metadata
      if (agentResponse.metadata?.products) {
        agentResponse.metadata.products.forEach(
          (product: any, index: number) => {
            recommendationEvents.push({
              sessionId,
              shopDomain,
              messageId,
              recommendedProductId: product.id,
              recommendedVariantId: product.variants?.[0]?.id,
              recommendationType: this.classifyRecommendationType(
                agentResponse.metadata
              ),
              recommendationContext: {
                intent: agentResponse.metadata?.intent,
                searchQuery: agentResponse.metadata?.search_query,
                searchType: agentResponse.metadata?.search_type,
                productsFound: agentResponse.metadata?.products_found,
                originalMessage: agentResponse.messages[0]?.substring(0, 200),
              },
              recommendationPosition: index + 1,
              recommendationScore: product.score,
              customerId,
              cartId,
            });
          }
        );
      }

      // Extract recommendations from recommendation-specific responses
      if (agentResponse.metadata?.recommendations) {
        agentResponse.metadata.recommendations.forEach(
          (rec: any, index: number) => {
            recommendationEvents.push({
              sessionId,
              shopDomain,
              messageId,
              recommendedProductId: rec.id,
              recommendedVariantId: undefined, // Recommendations usually don't include variant
              recommendationType:
                (agentResponse.metadata?.recommendation_type as
                  | 'complementary'
                  | 'upsell'
                  | 'popular'
                  | 'search_result'
                  | 'related_product'
                  | 'semantic_match') || 'popular',
              recommendationContext: {
                baseProductId: agentResponse.metadata?.base_product_id,
                reason: rec.reason,
                score: rec.score,
                recommendationType: agentResponse.metadata?.recommendation_type,
              },
              recommendationPosition: index + 1,
              recommendationScore: rec.score,
              customerId,
              cartId,
            });
          }
        );
      }

      // Parse recommendations from message content using regex patterns
      const messageRecommendations = this.extractRecommendationsFromText(
        agentResponse.messages.join(' '),
        sessionId,
        shopDomain,
        messageId,
        customerId,
        cartId
      );
      recommendationEvents.push(...messageRecommendations);

      // Save all recommendation events to database
      const eventIds: string[] = [];
      for (const event of recommendationEvents) {
        const eventId = await this.saveRecommendationEvent(event);
        if (eventId) eventIds.push(eventId);
      }

      logger.info(`Tracked ${eventIds.length} AI recommendations`, {
        sessionId,
        shopDomain,
        recommendationCount: eventIds.length,
      });

      return eventIds;
    } catch (error) {
      logger.error('Error tracking AI recommendations:', error);
      throw error;
    }
  }

  /**
   * Track cart addition events with potential AI attribution
   */
  async trackCartAddition(
    cartEvent: CartAdditionEvent
  ): Promise<string | null> {
    try {
      const { data, error } = await (this.supabaseService as any).serviceClient
        .from('cart_addition_events')
        .insert({
          shop_domain: cartEvent.shopDomain,
          cart_id: cartEvent.cartId,
          customer_id: cartEvent.customerId,
          product_id: cartEvent.productId,
          variant_id: cartEvent.variantId,
          quantity: cartEvent.quantity,
          unit_price: cartEvent.unitPrice,
          source: cartEvent.source,
          session_id: cartEvent.sessionId,
          recommendation_event_id: cartEvent.recommendationEventId,
          metadata: cartEvent.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Error saving cart addition event:', error);
        return null;
      }

      // Trigger attribution calculation for this cart addition
      await this.calculateAttributionForCartEvent(
        data.id,
        cartEvent.shopDomain
      );

      logger.info('Cart addition tracked', {
        eventId: data.id,
        shopDomain: cartEvent.shopDomain,
        productId: cartEvent.productId,
        source: cartEvent.source,
      });

      return data.id;
    } catch (error) {
      logger.error('Error tracking cart addition:', error);
      return null;
    }
  }

  /**
   * Track order completion events
   */
  async trackOrderCompletion(
    orderEvent: OrderCompletionEvent
  ): Promise<string | null> {
    try {
      const client = (this.supabaseService as any).serviceClient;

      // Insert order completion event
      const { data: orderData, error: orderError } = await client
        .from('order_completion_events')
        .insert({
          shop_domain: orderEvent.shopDomain,
          order_id: orderEvent.orderId,
          order_number: orderEvent.orderNumber,
          customer_id: orderEvent.customerId,
          total_amount: orderEvent.totalAmount,
          subtotal_amount: orderEvent.subtotalAmount,
          tax_amount: orderEvent.taxAmount,
          currency_code: orderEvent.currencyCode || 'USD',
          order_created_at: orderEvent.orderCreatedAt,
          financial_status: orderEvent.financialStatus,
          fulfillment_status: orderEvent.fulfillmentStatus,
        })
        .select('id')
        .single();

      if (orderError) {
        logger.error('Error saving order completion event:', orderError);
        return null;
      }

      // Insert line items
      const lineItemsData = orderEvent.lineItems.map(item => ({
        order_event_id: orderData.id,
        shop_domain: orderEvent.shopDomain,
        line_item_id: item.lineItemId,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        product_title: item.productTitle,
        variant_title: item.variantTitle,
      }));

      const { error: lineItemsError } = await client
        .from('order_line_items')
        .insert(lineItemsData);

      if (lineItemsError) {
        logger.error('Error saving order line items:', lineItemsError);
      }

      // Trigger attribution calculation for this order
      await this.calculateAttributionForOrder(
        orderData.id,
        orderEvent.shopDomain
      );

      logger.info('Order completion tracked', {
        orderEventId: orderData.id,
        shopDomain: orderEvent.shopDomain,
        orderId: orderEvent.orderId,
        totalAmount: orderEvent.totalAmount,
        lineItemsCount: orderEvent.lineItems.length,
      });

      return orderData.id;
    } catch (error) {
      logger.error('Error tracking order completion:', error);
      return null;
    }
  }

  /**
   * Get conversion metrics for a shop within a date range
   */
  async getConversionMetrics(
    shopDomain: string,
    dateFrom: Date,
    dateTo: Date,
    includeBreakdowns: boolean = true
  ): Promise<ConversionMetrics> {
    try {
      const client = (this.supabaseService as any).serviceClient;

      // Get basic metrics
      const [
        recommendationsResult,
        cartAdditionsResult,
        ordersResult,
        attributionResult,
      ] = await Promise.all([
        // Total recommendations
        client
          .from('ai_recommendation_events')
          .select('id')
          .eq('shop_domain', shopDomain)
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString()),

        // Total cart additions
        client
          .from('cart_addition_events')
          .select('id')
          .eq('shop_domain', shopDomain)
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString()),

        // Total orders and revenue
        client
          .from('order_completion_events')
          .select('total_amount')
          .eq('shop_domain', shopDomain)
          .gte('order_created_at', dateFrom.toISOString())
          .lte('order_created_at', dateTo.toISOString()),

        // Attribution metrics
        client.rpc('get_conversion_metrics', {
          p_shop_domain: shopDomain,
          p_date_from: dateFrom.toISOString().split('T')[0],
          p_date_to: dateTo.toISOString().split('T')[0],
        }),
      ]);

      const totalRecommendations = recommendationsResult.data?.length || 0;
      const totalCartAdditions = cartAdditionsResult.data?.length || 0;
      const totalOrders = ordersResult.data?.length || 0;
      const totalRevenue =
        ordersResult.data?.reduce(
          (sum: number, order: any) =>
            sum + parseFloat(order.total_amount || 0),
          0
        ) || 0;

      const attributionData = attributionResult.data?.[0] || {};
      const attributedCartAdditions =
        parseInt(attributionData.attributed_cart_additions) || 0;
      const attributedOrders = parseInt(attributionData.attributed_orders) || 0;
      const attributedRevenue =
        parseFloat(attributionData.attributed_revenue) || 0;

      // Calculate conversion rates
      const conversionRates = {
        recommendationToCart:
          totalRecommendations > 0
            ? attributedCartAdditions / totalRecommendations
            : 0,
        recommendationToPurchase:
          totalRecommendations > 0
            ? attributedOrders / totalRecommendations
            : 0,
        cartToPurchase:
          attributedCartAdditions > 0
            ? attributedOrders / attributedCartAdditions
            : 0,
      };

      let topPerformingProducts: any[] = [];
      let recommendationTypePerformance: Record<string, any> = {};

      if (includeBreakdowns) {
        // Get top performing products
        const { data: productPerformance } = await client.rpc(
          'get_top_converting_products',
          {
            p_shop_domain: shopDomain,
            p_date_from: dateFrom.toISOString().split('T')[0],
            p_date_to: dateTo.toISOString().split('T')[0],
            p_limit: 10,
          }
        );

        topPerformingProducts = productPerformance || [];

        // Get performance by recommendation type
        const { data: typePerformance } = await client.rpc(
          'get_recommendation_type_performance',
          {
            p_shop_domain: shopDomain,
            p_date_from: dateFrom.toISOString().split('T')[0],
            p_date_to: dateTo.toISOString().split('T')[0],
          }
        );

        recommendationTypePerformance = (typePerformance || []).reduce(
          (acc: any, item: any) => {
            acc[item.recommendation_type] = {
              recommendations: parseInt(item.recommendations),
              conversions: parseInt(item.conversions),
              revenue: parseFloat(item.revenue),
              conversionRate: parseFloat(item.conversion_rate),
            };
            return acc;
          },
          {}
        );
      }

      return {
        dateRange: { from: dateFrom, to: dateTo },
        totalRecommendations,
        totalCartAdditions,
        totalOrders,
        totalRevenue,
        attributedCartAdditions,
        attributedOrders,
        attributedRevenue,
        conversionRates,
        topPerformingProducts,
        recommendationTypePerformance,
      };
    } catch (error) {
      logger.error('Error getting conversion metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate attribution windows and update attribution events
   */
  async calculateAttribution(
    shopDomain: string,
    attributionWindowHours: number = 720, // 30 days
    lookbackDays: number = 30
  ): Promise<void> {
    try {
      const { error } = await (this.supabaseService as any).serviceClient.rpc(
        'calculate_attribution',
        {
          p_shop_domain: shopDomain,
          p_attribution_window_hours: attributionWindowHours,
          p_lookback_days: lookbackDays,
        }
      );

      if (error) {
        throw error;
      }

      logger.info('Attribution calculation completed', {
        shopDomain,
        attributionWindowHours,
        lookbackDays,
      });
    } catch (error) {
      logger.error('Error calculating attribution:', error);
      throw error;
    }
  }

  /**
   * Generate and store conversion analytics snapshots
   */
  async generateAnalyticsSnapshot(
    shopDomain: string,
    dateFrom: Date,
    dateTo: Date,
    snapshotType: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<void> {
    try {
      const { error } = await (this.supabaseService as any).serviceClient.rpc(
        'generate_conversion_snapshot',
        {
          p_shop_domain: shopDomain,
          p_date_from: dateFrom.toISOString().split('T')[0],
          p_date_to: dateTo.toISOString().split('T')[0],
          p_snapshot_type: snapshotType,
        }
      );

      if (error) {
        throw error;
      }

      logger.info('Conversion analytics snapshot generated', {
        shopDomain,
        dateFrom,
        dateTo,
        snapshotType,
      });
    } catch (error) {
      logger.error('Error generating analytics snapshot:', error);
      throw error;
    }
  }

  /**
   * Clean up old tracking data based on retention policy
   */
  async cleanupOldData(
    shopDomain: string,
    retentionDays: number = 365
  ): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const client = (this.supabaseService as any).serviceClient;

      // Delete old recommendation events (cascading deletes handle related records)
      const { error } = await client
        .from('ai_recommendation_events')
        .delete()
        .eq('shop_domain', shopDomain)
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      logger.info('Old conversion tracking data cleaned up', {
        shopDomain,
        retentionDays,
        cutoffDate,
      });
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
      throw error;
    }
  }

  // Private helper methods

  private classifyRecommendationType(
    metadata: any
  ):
    | 'search_result'
    | 'related_product'
    | 'complementary'
    | 'upsell'
    | 'popular'
    | 'semantic_match' {
    if (metadata?.search_type === 'semantic') return 'semantic_match';
    if (metadata?.intent === 'search_products') return 'search_result';
    if (metadata?.recommendation_type === 'related') return 'related_product';
    if (metadata?.recommendation_type === 'complementary')
      return 'complementary';
    if (metadata?.recommendation_type === 'upsell') return 'upsell';
    return 'popular';
  }

  private extractRecommendationsFromText(
    message: string,
    sessionId: string,
    shopDomain: string,
    messageId?: string,
    customerId?: string,
    cartId?: string
  ): AIRecommendationEvent[] {
    const recommendations: AIRecommendationEvent[] = [];

    // Regex patterns to extract product mentions
    const patterns = [
      /\*\*([^*]+)\*\*.*?Product ID:\s*([a-zA-Z0-9_/-]+)/g,
      /(\d+)\.\s*\*\*([^*]+)\*\*.*?Product ID:\s*([a-zA-Z0-9_/-]+)/g,
      /\*\*([^*]+)\*\*.*?\$[\d.,]+/g,
    ];

    let position = 1;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const productTitle = match[1] || match[2];
        const productId = match[2] || match[3];

        if (productTitle && productId) {
          recommendations.push({
            sessionId,
            shopDomain,
            messageId,
            recommendedProductId: productId,
            recommendationType: 'search_result',
            recommendationContext: {
              extractedFrom: 'message_text',
              productTitle,
              messageSnippet: match[0],
            },
            recommendationPosition: position++,
            customerId,
            cartId,
          });
        }
      }
    }

    return recommendations;
  }

  private async saveRecommendationEvent(
    event: AIRecommendationEvent
  ): Promise<string | null> {
    try {
      const { data, error } = await (this.supabaseService as any).serviceClient
        .from('ai_recommendation_events')
        .insert({
          session_id: event.sessionId,
          shop_domain: event.shopDomain,
          message_id: event.messageId,
          recommended_product_id: event.recommendedProductId,
          recommended_variant_id: event.recommendedVariantId,
          recommendation_type: event.recommendationType,
          recommendation_context: event.recommendationContext,
          recommendation_position: event.recommendationPosition,
          recommendation_score: event.recommendationScore,
          customer_id: event.customerId,
          cart_id: event.cartId,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Error saving recommendation event:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error saving recommendation event:', error);
      return null;
    }
  }

  private async calculateAttributionForCartEvent(
    cartEventId: string,
    shopDomain: string
  ): Promise<void> {
    // This would trigger more immediate attribution calculation
    // For now, we'll rely on the batch attribution calculation
    await this.calculateAttribution(shopDomain, 720, 7); // 7 days lookback for immediate attribution
  }

  private async calculateAttributionForOrder(
    orderEventId: string,
    shopDomain: string
  ): Promise<void> {
    // Trigger attribution calculation when order is completed
    await this.calculateAttribution(shopDomain, 720, 30);
  }
}
