import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

export interface HistoricalRecommendation {
  id: string;
  sessionId: string;
  messageId: string;
  timestamp: string;
  productId?: string;
  productTitle: string;
  productHandle?: string;
  confidence: number;
  context: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  totalPrice: string;
  currency: string;
  customerId?: string;
  lineItems: Array<{
    productId: string;
    variantId: string;
    title: string;
    quantity: number;
    price: string;
  }>;
}

export interface HistoricalConversion {
  id: string;
  sessionId: string;
  recommendationId: string;
  orderId: string;
  orderName: string;
  productId: string;
  productTitle: string;
  recommendedAt: string;
  purchasedAt: string;
  minutesToConversion: number;
  orderAmount: number;
  orderQuantity: number;
  conversionConfidence: number;
  attributionWindow: 'direct' | 'assisted' | 'view_through';
}

export interface ConversionAnalytics {
  totalRecommendations: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageTimeToConversion: number;
  conversionsByMonth: Array<{
    month: string;
    recommendations: number;
    conversions: number;
    revenue: number;
    rate: number;
  }>;
  topConvertingProducts: Array<{
    productId: string;
    productTitle: string;
    recommendations: number;
    conversions: number;
    rate: number;
    revenue: number;
  }>;
  conversionTimeline: Array<{
    date: string;
    recommendations: number;
    conversions: number;
    revenue: number;
  }>;
}

export class HistoricalConversionAnalyticsService {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;

  // Attribution windows in minutes
  private static readonly ATTRIBUTION_WINDOWS = {
    DIRECT: 30, // 30 minutes for direct attribution
    ASSISTED: 1440, // 24 hours for assisted attribution
    VIEW_THROUGH: 10080, // 7 days for view-through attribution
  };

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Extract all historical product recommendations from chat messages
   */
  async extractHistoricalRecommendations(
    shopDomain: string
  ): Promise<HistoricalRecommendation[]> {
    try {
      logger.info(
        'Extracting historical recommendations for shop:',
        shopDomain
      );

      // Get ALL historical chat messages from agents (AI responses)
      const { data: messages, error } = await this.supabaseService.client
        .from('chat_messages')
        .select('id, session_id, content, timestamp, role')
        .eq('role', 'agent') // Only AI agent messages
        .order('timestamp', { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch chat messages: ${error.message}`,
          500
        );
      }

      const recommendations: HistoricalRecommendation[] = [];
      let extractedCount = 0;

      for (const message of messages || []) {
        const extracted = this.extractProductsFromMessage(message);
        if (extracted.length > 0) {
          recommendations.push(...extracted);
          extractedCount += extracted.length;
        }
      }

      logger.info('Historical recommendation extraction completed', {
        shopDomain,
        totalMessages: messages?.length || 0,
        extractedRecommendations: extractedCount,
        uniqueProducts: new Set(recommendations.map(r => r.productTitle)).size,
      });

      return recommendations;
    } catch (error) {
      logger.error('Error extracting historical recommendations:', error);
      throw new AppError('Failed to extract historical recommendations', 500);
    }
  }

  /**
   * Extract product recommendations from a single message
   */
  private extractProductsFromMessage(message: any): HistoricalRecommendation[] {
    const recommendations: HistoricalRecommendation[] = [];
    const content = message.content;

    // Enhanced product extraction patterns
    const patterns = [
      // Pattern 1: **Product Name** - $price format
      {
        regex: /\*\*([^*]+?)\*\*\s*[-–—]\s*\$?([\d,]+(?:\.\d{2})?)/g,
        confidence: 0.9,
      },
      // Pattern 2: Product with ID: Product ID: 123456
      {
        regex: /Product ID:\s*(\d+)[\s\S]*?\*\*([^*]+?)\*\*/g,
        confidence: 0.95,
        hasId: true,
      },
      // Pattern 3: Numbered list: 1. **Product Name**
      {
        regex: /\d+\.\s*\*\*([^*]+?)\*\*/g,
        confidence: 0.85,
      },
      // Pattern 4: Simple bold product names with context
      {
        regex:
          /(?:recomiendo|sugiero|prueba|considera)\s*(?:el|la|los|las)?\s*\*\*([^*]+?)\*\*/gi,
        confidence: 0.8,
      },
      // Pattern 5: Shopify handle format: /products/product-handle
      {
        regex: /\/products\/([a-z0-9-]+)/g,
        confidence: 0.7,
        isHandle: true,
      },
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        let productTitle = '';
        let productId = '';
        let productHandle = '';

        if (pattern.hasId) {
          productId = match[1];
          productTitle = match[2]?.trim();
        } else if (pattern.isHandle) {
          productHandle = match[1];
          productTitle = match[1].replace(/-/g, ' ');
        } else {
          productTitle = match[1]?.trim();
        }

        if (productTitle && productTitle.length > 2) {
          recommendations.push({
            id: `hist_${message.id}_${recommendations.length}`,
            sessionId: message.session_id,
            messageId: message.id,
            timestamp: message.timestamp,
            productId: productId || undefined,
            productTitle: productTitle,
            productHandle: productHandle || undefined,
            confidence: pattern.confidence,
            context: content.substring(
              Math.max(0, match.index - 100),
              match.index + 200
            ),
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Fetch historical orders from Shopify
   */
  async fetchShopifyHistoricalOrders(
    shopDomain: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ShopifyOrder[]> {
    try {
      logger.info('Fetching historical Shopify orders', {
        shopDomain,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
      });

      // Get store credentials
      const store = await this.supabaseService.getStore(shopDomain);
      if (!store) {
        throw new AppError(`Store not found: ${shopDomain}`, 404);
      }

      // Initialize Shopify service with store token
      await this.shopifyService.initializeForStore(
        store.shop_domain,
        store.access_token
      );

      // Build query parameters
      const params: any = {
        limit: 250, // Max allowed by Shopify
        status: 'any',
        financial_status: 'paid', // Only paid orders for conversions
      };

      if (fromDate) {
        params.created_at_min = fromDate.toISOString();
      }
      if (toDate) {
        params.created_at_max = toDate.toISOString();
      }

      const orders: ShopifyOrder[] = [];
      let hasMore = true;
      let sinceId = '';

      // Paginate through all orders
      while (hasMore) {
        const queryParams = { ...params };
        if (sinceId) {
          queryParams.since_id = sinceId;
        }

        const response = await this.shopifyService.makeRequest(
          'GET',
          '/admin/api/2023-10/orders.json',
          queryParams
        );
        const fetchedOrders = response.orders || [];

        if (fetchedOrders.length === 0) {
          hasMore = false;
          break;
        }

        // Transform to our format
        for (const order of fetchedOrders) {
          orders.push({
            id: order.id.toString(),
            name: order.name,
            createdAt: order.created_at,
            totalPrice: order.total_price,
            currency: order.currency,
            customerId: order.customer?.id?.toString(),
            lineItems:
              order.line_items?.map((item: any) => ({
                productId: item.product_id?.toString() || '',
                variantId: item.variant_id?.toString() || '',
                title: item.title,
                quantity: item.quantity,
                price: item.price,
              })) || [],
          });
        }

        // Update pagination
        sinceId = fetchedOrders[fetchedOrders.length - 1].id.toString();

        // If we got less than the limit, we're done
        if (fetchedOrders.length < params.limit) {
          hasMore = false;
        }
      }

      logger.info('Shopify historical orders fetched', {
        shopDomain,
        totalOrders: orders.length,
        dateRange: {
          oldest:
            orders.length > 0 ? orders[orders.length - 1].createdAt : null,
          newest: orders.length > 0 ? orders[0].createdAt : null,
        },
      });

      return orders;
    } catch (error) {
      logger.error('Error fetching Shopify historical orders:', error);
      throw new AppError('Failed to fetch historical orders from Shopify', 500);
    }
  }

  /**
   * Match historical recommendations to orders using attribution logic
   */
  async matchHistoricalConversions(
    recommendations: HistoricalRecommendation[],
    orders: ShopifyOrder[]
  ): Promise<HistoricalConversion[]> {
    try {
      logger.info('Starting historical conversion matching', {
        recommendations: recommendations.length,
        orders: orders.length,
      });

      const conversions: HistoricalConversion[] = [];
      let directMatches = 0;
      let assistedMatches = 0;
      let viewThroughMatches = 0;

      // Create efficient lookup structures
      const ordersByProduct = new Map<string, ShopifyOrder[]>();
      orders.forEach(order => {
        order.lineItems.forEach(item => {
          if (!ordersByProduct.has(item.productId)) {
            ordersByProduct.set(item.productId, []);
          }
          ordersByProduct.get(item.productId)!.push(order);
        });
      });

      // Process each recommendation
      for (const recommendation of recommendations) {
        const recTimestamp = new Date(recommendation.timestamp);
        let matchFound = false;

        // Try to match by product ID first (most accurate)
        if (recommendation.productId) {
          const candidateOrders =
            ordersByProduct.get(recommendation.productId) || [];
          const match = this.findBestOrderMatch(
            recommendation,
            candidateOrders,
            recTimestamp
          );
          if (match) {
            conversions.push(match.conversion);
            if (match.attributionWindow === 'direct') directMatches++;
            else if (match.attributionWindow === 'assisted') assistedMatches++;
            else viewThroughMatches++;
            matchFound = true;
          }
        }

        // If no direct product ID match, try fuzzy matching by title
        if (!matchFound) {
          const fuzzyMatches = this.findFuzzyProductMatches(
            recommendation,
            orders
          );
          for (const match of fuzzyMatches) {
            conversions.push(match.conversion);
            if (match.attributionWindow === 'direct') directMatches++;
            else if (match.attributionWindow === 'assisted') assistedMatches++;
            else viewThroughMatches++;
            break; // Take first/best match to avoid duplicates
          }
        }
      }

      logger.info('Historical conversion matching completed', {
        totalConversions: conversions.length,
        directMatches,
        assistedMatches,
        viewThroughMatches,
        conversionRate:
          recommendations.length > 0
            ? ((conversions.length / recommendations.length) * 100).toFixed(2) +
              '%'
            : '0%',
      });

      return conversions;
    } catch (error) {
      logger.error('Error matching historical conversions:', error);
      throw new AppError('Failed to match historical conversions', 500);
    }
  }

  /**
   * Find the best order match for a recommendation within attribution windows
   */
  private findBestOrderMatch(
    recommendation: HistoricalRecommendation,
    candidateOrders: ShopifyOrder[],
    recTimestamp: Date
  ): {
    conversion: HistoricalConversion;
    attributionWindow: 'direct' | 'assisted' | 'view_through';
  } | null {
    const matches: Array<{
      order: ShopifyOrder;
      lineItem: any;
      minutesDiff: number;
      window: 'direct' | 'assisted' | 'view_through';
    }> = [];

    for (const order of candidateOrders) {
      const orderTimestamp = new Date(order.createdAt);
      const minutesDiff =
        (orderTimestamp.getTime() - recTimestamp.getTime()) / (1000 * 60);

      // Only consider orders after the recommendation
      if (minutesDiff < 0) continue;

      const lineItem = order.lineItems.find(
        item => item.productId === recommendation.productId
      );

      if (!lineItem) continue;

      // Determine attribution window
      let window: 'direct' | 'assisted' | 'view_through';
      if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.DIRECT
      ) {
        window = 'direct';
      } else if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.ASSISTED
      ) {
        window = 'assisted';
      } else if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.VIEW_THROUGH
      ) {
        window = 'view_through';
      } else {
        continue; // Outside attribution window
      }

      matches.push({ order, lineItem, minutesDiff, window });
    }

    if (matches.length === 0) return null;

    // Sort by time difference (closest first) and attribution window priority
    matches.sort((a, b) => {
      const windowPriority = { direct: 0, assisted: 1, view_through: 2 };
      if (windowPriority[a.window] !== windowPriority[b.window]) {
        return windowPriority[a.window] - windowPriority[b.window];
      }
      return a.minutesDiff - b.minutesDiff;
    });

    const bestMatch = matches[0];
    const conversion: HistoricalConversion = {
      id: `conv_${recommendation.id}_${bestMatch.order.id}`,
      sessionId: recommendation.sessionId,
      recommendationId: recommendation.id,
      orderId: bestMatch.order.id,
      orderName: bestMatch.order.name,
      productId: recommendation.productId || bestMatch.lineItem.productId,
      productTitle: recommendation.productTitle,
      recommendedAt: recommendation.timestamp,
      purchasedAt: bestMatch.order.createdAt,
      minutesToConversion: Math.round(bestMatch.minutesDiff),
      orderAmount:
        parseFloat(bestMatch.lineItem.price) * bestMatch.lineItem.quantity,
      orderQuantity: bestMatch.lineItem.quantity,
      conversionConfidence: recommendation.confidence,
      attributionWindow: bestMatch.window,
    };

    return { conversion, attributionWindow: bestMatch.window };
  }

  /**
   * Find product matches using fuzzy string matching
   */
  private findFuzzyProductMatches(
    recommendation: HistoricalRecommendation,
    orders: ShopifyOrder[]
  ): Array<{
    conversion: HistoricalConversion;
    attributionWindow: 'direct' | 'assisted' | 'view_through';
  }> {
    const matches: Array<{
      conversion: HistoricalConversion;
      attributionWindow: 'direct' | 'assisted' | 'view_through';
    }> = [];
    const recTimestamp = new Date(recommendation.timestamp);

    for (const order of orders) {
      const orderTimestamp = new Date(order.createdAt);
      const minutesDiff =
        (orderTimestamp.getTime() - recTimestamp.getTime()) / (1000 * 60);

      if (minutesDiff < 0) continue; // Order before recommendation

      // Determine attribution window
      let window: 'direct' | 'assisted' | 'view_through';
      if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.DIRECT
      ) {
        window = 'direct';
      } else if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.ASSISTED
      ) {
        window = 'assisted';
      } else if (
        minutesDiff <=
        HistoricalConversionAnalyticsService.ATTRIBUTION_WINDOWS.VIEW_THROUGH
      ) {
        window = 'view_through';
      } else {
        continue; // Outside attribution window
      }

      // Check each line item for fuzzy match
      for (const lineItem of order.lineItems) {
        const similarity = this.calculateStringSimilarity(
          recommendation.productTitle.toLowerCase(),
          lineItem.title.toLowerCase()
        );

        // Require at least 70% similarity for fuzzy matching
        if (similarity >= 0.7) {
          const conversion: HistoricalConversion = {
            id: `conv_fuzzy_${recommendation.id}_${order.id}_${lineItem.productId}`,
            sessionId: recommendation.sessionId,
            recommendationId: recommendation.id,
            orderId: order.id,
            orderName: order.name,
            productId: lineItem.productId,
            productTitle: recommendation.productTitle,
            recommendedAt: recommendation.timestamp,
            purchasedAt: order.createdAt,
            minutesToConversion: Math.round(minutesDiff),
            orderAmount: parseFloat(lineItem.price) * lineItem.quantity,
            orderQuantity: lineItem.quantity,
            conversionConfidence: recommendation.confidence * similarity, // Adjust confidence by similarity
            attributionWindow: window,
          };

          matches.push({ conversion, attributionWindow: window });
        }
      }
    }

    return matches;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Generate comprehensive analytics from historical conversions
   */
  async generateConversionAnalytics(
    conversions: HistoricalConversion[]
  ): Promise<ConversionAnalytics> {
    try {
      const totalConversions = conversions.length;

      // Get unique recommendations count (need to implement this based on your data)
      const uniqueRecommendations = new Set(
        conversions.map(c => c.recommendationId)
      ).size;
      const totalRecommendations = uniqueRecommendations; // This should be calculated from all recommendations

      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;

      const totalRevenue = conversions.reduce(
        (sum, conv) => sum + conv.orderAmount,
        0
      );
      const averageOrderValue =
        totalConversions > 0 ? totalRevenue / totalConversions : 0;

      const averageTimeToConversion =
        totalConversions > 0
          ? conversions.reduce(
              (sum, conv) => sum + conv.minutesToConversion,
              0
            ) / totalConversions
          : 0;

      // Group by month
      const conversionsByMonth = this.groupConversionsByMonth(conversions);

      // Top converting products
      const topConvertingProducts =
        this.calculateTopConvertingProducts(conversions);

      // Daily timeline
      const conversionTimeline = this.generateConversionTimeline(conversions);

      return {
        totalRecommendations,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        averageTimeToConversion:
          Math.round(averageTimeToConversion * 100) / 100,
        conversionsByMonth,
        topConvertingProducts,
        conversionTimeline,
      };
    } catch (error) {
      logger.error('Error generating conversion analytics:', error);
      throw new AppError('Failed to generate conversion analytics', 500);
    }
  }

  /**
   * Group conversions by month
   */
  private groupConversionsByMonth(conversions: HistoricalConversion[]) {
    const monthlyData = new Map<
      string,
      {
        recommendations: Set<string>;
        conversions: number;
        revenue: number;
      }
    >();

    conversions.forEach(conv => {
      const month = new Date(conv.purchasedAt).toISOString().slice(0, 7); // YYYY-MM

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          recommendations: new Set(),
          conversions: 0,
          revenue: 0,
        });
      }

      const data = monthlyData.get(month)!;
      data.recommendations.add(conv.recommendationId);
      data.conversions++;
      data.revenue += conv.orderAmount;
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        recommendations: data.recommendations.size,
        conversions: data.conversions,
        revenue: Math.round(data.revenue * 100) / 100,
        rate:
          data.recommendations.size > 0
            ? Math.round(
                (data.conversions / data.recommendations.size) * 10000
              ) / 100
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate top converting products
   */
  private calculateTopConvertingProducts(conversions: HistoricalConversion[]) {
    const productData = new Map<
      string,
      {
        title: string;
        recommendations: Set<string>;
        conversions: number;
        revenue: number;
      }
    >();

    conversions.forEach(conv => {
      if (!productData.has(conv.productId)) {
        productData.set(conv.productId, {
          title: conv.productTitle,
          recommendations: new Set(),
          conversions: 0,
          revenue: 0,
        });
      }

      const data = productData.get(conv.productId)!;
      data.recommendations.add(conv.recommendationId);
      data.conversions++;
      data.revenue += conv.orderAmount;
    });

    return Array.from(productData.entries())
      .map(([productId, data]) => ({
        productId,
        productTitle: data.title,
        recommendations: data.recommendations.size,
        conversions: data.conversions,
        rate:
          data.recommendations.size > 0
            ? Math.round(
                (data.conversions / data.recommendations.size) * 10000
              ) / 100
            : 0,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  /**
   * Generate daily conversion timeline
   */
  private generateConversionTimeline(conversions: HistoricalConversion[]) {
    const dailyData = new Map<
      string,
      {
        recommendations: Set<string>;
        conversions: number;
        revenue: number;
      }
    >();

    conversions.forEach(conv => {
      const date = new Date(conv.purchasedAt).toISOString().split('T')[0];

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          recommendations: new Set(),
          conversions: 0,
          revenue: 0,
        });
      }

      const data = dailyData.get(date)!;
      data.recommendations.add(conv.recommendationId);
      data.conversions++;
      data.revenue += conv.orderAmount;
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        recommendations: data.recommendations.size,
        conversions: data.conversions,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Save historical conversions to database
   */
  async saveHistoricalConversions(
    shopDomain: string,
    conversions: HistoricalConversion[]
  ): Promise<void> {
    try {
      logger.info('Saving historical conversions to database', {
        shopDomain,
        conversionsCount: conversions.length,
      });

      // Clear existing historical data for this shop
      await this.supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', shopDomain)
        .like('session_id', 'hist_%');

      // Insert in batches of 100 to avoid hitting limits
      const batchSize = 100;
      for (let i = 0; i < conversions.length; i += batchSize) {
        const batch = conversions.slice(i, i + batchSize);

        const insertData = batch.map(conv => ({
          session_id: conv.sessionId,
          order_id: conv.orderId,
          product_id: conv.productId,
          shop_domain: shopDomain,
          recommended_at: conv.recommendedAt,
          purchased_at: conv.purchasedAt,
          minutes_to_conversion: conv.minutesToConversion,
          confidence: conv.conversionConfidence,
          order_quantity: conv.orderQuantity,
          order_amount: conv.orderAmount,
          total_order_amount: conv.orderAmount, // For now, using line item amount
        }));

        const { error } = await this.supabaseService.client
          .from('simple_conversions')
          .insert(insertData);

        if (error) {
          logger.error('Error inserting conversion batch:', error);
          throw new AppError(
            `Failed to save conversions batch: ${error.message}`,
            500
          );
        }
      }

      logger.info('Historical conversions saved successfully', {
        shopDomain,
        conversionsCount: conversions.length,
      });
    } catch (error) {
      logger.error('Error saving historical conversions:', error);
      throw new AppError('Failed to save historical conversions', 500);
    }
  }
}
