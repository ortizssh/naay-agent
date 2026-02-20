import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

export interface ConversionDashboardData {
  overview: {
    totalRecommendations: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    averageOrderValue: number;
    averageTimeToConversion: number;
  };
  timeline: Array<{
    date: string;
    recommendations: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    recommendations: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: 'recommendation' | 'conversion';
    timestamp: string;
    productTitle: string;
    sessionId: string;
    amount?: number;
  }>;
  attributionBreakdown: {
    direct: { count: number; revenue: number }; // 0-30 min
    assisted: { count: number; revenue: number }; // 30min-24h
    viewThrough: { count: number; revenue: number }; // 24h-7d
  };
  periodComparison: {
    currentPeriod: { conversions: number; revenue: number; rate: number };
    previousPeriod: { conversions: number; revenue: number; rate: number };
    change: { conversions: number; revenue: number; rate: number };
  };
}

export interface HistoricalBackfillResult {
  chatMessagesAnalyzed: number;
  newRecommendationsCreated: number;
  existingRecommendationsFound: number;
  timeRange: { from: string; to: string };
  productBreakdown: Array<{
    productTitle: string;
    occurrences: number;
    confidenceAvg: number;
  }>;
}

export class EnhancedConversionAnalyticsService {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;

  // Attribution windows in minutes
  private static readonly ATTRIBUTION_WINDOWS = {
    DIRECT: 30, // 0-30 minutes
    ASSISTED: 1440, // 30min-24h
    VIEW_THROUGH: 10080, // 24h-7 days
  };

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  /**
   * Get ALL records from a table using pagination to bypass Supabase limits
   */
  private async getAllRecords(
    tableName: string,
    shopDomain: string,
    dateColumn: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const allRecords: any[] = [];
    let offset = 0;
    const limit = 1000; // Supabase page size
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabaseService.client
        .from(tableName)
        .select('*')
        .eq('shop_domain', shopDomain)
        .gte(dateColumn, startDate.toISOString())
        .lte(dateColumn, endDate.toISOString())
        .order(dateColumn, { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error(`Error fetching ${tableName} records:`, error);
        throw new AppError(
          `Failed to fetch ${tableName}: ${error.message}`,
          500
        );
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...data);
        offset += limit;

        // If we got less than the limit, we've reached the end
        if (data.length < limit) {
          hasMore = false;
        }

        logger.info(
          `Fetched ${data.length} ${tableName} records, total so far: ${allRecords.length}`
        );
      }
    }

    logger.info(`Total ${tableName} records fetched: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Get ALL records from a table using pagination (no date filter)
   */
  private async getAllRecordsNoPagination(
    tableName: string,
    shopDomain: string,
    orderColumn: string
  ): Promise<any[]> {
    const allRecords: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabaseService.client
        .from(tableName)
        .select('*')
        .eq('shop_domain', shopDomain)
        .order(orderColumn, { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error(`Error fetching ${tableName} records:`, error);
        throw new AppError(
          `Failed to fetch ${tableName}: ${error.message}`,
          500
        );
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...data);
        offset += limit;

        if (data.length < limit) {
          hasMore = false;
        }

        logger.info(
          `Fetched ${data.length} ${tableName} records, total so far: ${allRecords.length}`
        );
      }
    }

    logger.info(`Total ${tableName} records fetched: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Backfill historical recommendations from chat messages into simple_recommendations table
   */
  async backfillHistoricalRecommendations(
    shopDomain: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<HistoricalBackfillResult> {
    try {
      logger.info('Starting historical recommendations backfill', {
        shopDomain,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
      });

      // Get all historical chat messages from agents
      let query = this.supabaseService.client
        .from('chat_messages')
        .select('id, session_id, content, timestamp')
        .eq('role', 'agent')
        .order('timestamp', { ascending: true });

      if (fromDate) {
        query = query.gte('timestamp', fromDate.toISOString());
      }
      if (toDate) {
        query = query.lte('timestamp', toDate.toISOString());
      }

      const { data: messages, error } = await query;
      if (error) {
        throw new AppError(
          `Failed to fetch chat messages: ${error.message}`,
          500
        );
      }

      const chatMessages = messages || [];

      // Get existing recommendations to avoid duplicates
      const { data: existingRecs, error: existingError } =
        await this.supabaseService.client
          .from('simple_recommendations')
          .select('message_id, product_title')
          .eq('shop_domain', shopDomain);

      if (existingError) {
        logger.warn('Could not fetch existing recommendations:', existingError);
      }

      const existingMessageIds = new Set(
        (existingRecs || []).map(r => r.message_id)
      );
      const existingProductTitles = new Set(
        (existingRecs || []).map(r => r.product_title)
      );

      // Extract recommendations from messages
      const newRecommendations: Array<{
        session_id: string;
        shop_domain: string;
        product_id?: string;
        product_title: string;
        recommended_at: string;
        expires_at: string;
        message_id: string;
        // confidence: number; // Column may not exist
      }> = [];

      const productBreakdown = new Map<
        string,
        { count: number; totalConfidence: number }
      >();

      for (const message of chatMessages) {
        // Skip if we already have recommendations for this message
        if (existingMessageIds.has(message.id)) {
          continue;
        }

        const recommendations =
          this.extractProductRecommendationsFromMessage(message);

        for (const rec of recommendations) {
          // Avoid duplicates based on product title and session
          const key = `${rec.productTitle}_${message.session_id}`;

          newRecommendations.push({
            session_id: message.session_id,
            shop_domain: shopDomain,
            product_id: rec.productId || null,
            product_title: rec.productTitle,
            recommended_at: message.timestamp,
            expires_at: new Date(
              new Date(message.timestamp).getTime() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(), // 7 days for historical
            message_id: message.id,
            // confidence: rec.confidence, // Column may not exist
          });

          // Track for breakdown
          if (!productBreakdown.has(rec.productTitle)) {
            productBreakdown.set(rec.productTitle, {
              count: 0,
              totalConfidence: 0,
            });
          }
          const breakdown = productBreakdown.get(rec.productTitle)!;
          breakdown.count++;
          breakdown.totalConfidence += rec.confidence;
        }
      }

      // Insert new recommendations in batches
      let newRecommendationsCreated = 0;
      if (newRecommendations.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < newRecommendations.length; i += batchSize) {
          const batch = newRecommendations.slice(i, i + batchSize);

          const { error: insertError } = await this.supabaseService.client
            .from('simple_recommendations')
            .insert(batch);

          if (insertError) {
            logger.error('Error inserting recommendations batch:', insertError);
            throw new AppError(
              `Failed to insert recommendations: ${insertError.message}`,
              500
            );
          }

          newRecommendationsCreated += batch.length;
        }
      }

      const result: HistoricalBackfillResult = {
        chatMessagesAnalyzed: chatMessages.length,
        newRecommendationsCreated,
        existingRecommendationsFound: existingRecs?.length || 0,
        timeRange: {
          from: fromDate?.toISOString() || 'all-time',
          to: toDate?.toISOString() || 'now',
        },
        productBreakdown: Array.from(productBreakdown.entries())
          .map(([title, data]) => ({
            productTitle: title,
            occurrences: data.count,
            confidenceAvg:
              Math.round((data.totalConfidence / data.count) * 100) / 100,
          }))
          .sort((a, b) => b.occurrences - a.occurrences)
          .slice(0, 10),
      };

      logger.info('Historical recommendations backfill completed', result);
      return result;
    } catch (error) {
      logger.error('Error in historical recommendations backfill:', error);
      throw new AppError('Failed to backfill historical recommendations', 500);
    }
  }

  /**
   * Extract product recommendations from a single chat message
   */
  private extractProductRecommendationsFromMessage(message: any): Array<{
    productId?: string;
    productTitle: string;
    confidence: number;
    context: string;
  }> {
    const recommendations: Array<{
      productId?: string;
      productTitle: string;
      confidence: number;
      context: string;
    }> = [];

    const content = message.content;

    // Enhanced patterns for Spanish content (based on your screenshot)
    const patterns = [
      // Spanish product patterns
      {
        regex: /\*\*([^*]+?)\*\*\s*[-–—]?\s*\$?([\d,]+(?:\.\d{2})?)?/g,
        confidence: 0.9,
        description: 'Bold product names with optional price',
      },
      // Product with ID pattern
      {
        regex:
          /(?:Product ID|ID del producto):\s*(\d+)[\s\S]*?\*\*([^*]+?)\*\*/gi,
        confidence: 0.95,
        description: 'Product with explicit ID',
        hasId: true,
      },
      // Spanish recommendation phrases
      {
        regex:
          /(?:te recomiendo|sugiero|prueba|considera|mira|revisa)\s*(?:el|la|los|las|este|esta|estos|estas)?\s*\*\*([^*]+?)\*\*/gi,
        confidence: 0.85,
        description: 'Spanish recommendation phrases',
      },
      // Numbered lists in Spanish
      {
        regex: /\d+[.)]\s*\*\*([^*]+?)\*\*/g,
        confidence: 0.8,
        description: 'Numbered product lists',
      },
      // Beauty/cosmetic specific terms (from your data)
      {
        regex:
          /(?:crema|gel|emulsión|bálsamo|splendor|delicate|contorno|touch)\s+[^*]*?\*\*([^*]+?)\*\*/gi,
        confidence: 0.85,
        description: 'Beauty/cosmetic product patterns',
      },
      // Handle URLs
      {
        regex: /\/products\/([a-z0-9-]+)/g,
        confidence: 0.7,
        description: 'Product handle URLs',
        isHandle: true,
      },
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        let productTitle = '';
        let productId = '';

        if (pattern.hasId) {
          productId = match[1];
          productTitle = match[2]?.trim();
        } else if (pattern.isHandle) {
          productTitle = match[1]
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        } else {
          productTitle = match[1]?.trim();
        }

        // Clean up and validate product title
        if (productTitle) {
          productTitle = this.cleanProductTitle(productTitle);

          if (this.isValidProductTitle(productTitle)) {
            recommendations.push({
              productId: productId || undefined,
              productTitle,
              confidence: pattern.confidence,
              context: content.substring(
                Math.max(0, match.index - 100),
                match.index + 200
              ),
            });
          }
        }
      }
    });

    // Remove duplicates and sort by confidence
    const uniqueRecs = recommendations
      .filter(
        (rec, index, arr) =>
          arr.findIndex(
            r => r.productTitle.toLowerCase() === rec.productTitle.toLowerCase()
          ) === index
      )
      .sort((a, b) => b.confidence - a.confidence);

    return uniqueRecs;
  }

  /**
   * Clean and normalize product titles
   */
  private cleanProductTitle(title: string): string {
    return title
      .replace(/[|•\-–—]/g, ' ') // Replace separators with space
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .trim()
      .replace(/^(el|la|los|las|un|una|unos|unas)\s+/gi, '') // Remove Spanish articles
      .trim();
  }

  /**
   * Validate if a string is a valid product title
   */
  private isValidProductTitle(title: string): boolean {
    return (
      title.length >= 3 &&
      title.length <= 200 &&
      /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(title) && // Contains letters
      !/^(hola|hello|gracias|thanks|sí|yes|no|ok|bien|good)$/i.test(title) && // Not common words
      !/^\d+$/.test(title) // Not just numbers
    );
  }

  /**
   * Process historical orders and match them with recommendations to create conversions
   */
  async processHistoricalConversions(shopDomain: string): Promise<{
    ordersProcessed: number;
    conversionsCreated: number;
    totalRevenue: number;
    averageTimeToConversion: number;
  }> {
    try {
      logger.info('Processing historical conversions for shop:', shopDomain);

      // Get store info
      const store = await this.supabaseService.getStore(shopDomain);
      if (!store) {
        throw new AppError(`Store not found: ${shopDomain}`, 404);
      }

      // Initialize Shopify client
      const adminClient = this.shopifyService.getAdminClient(
        shopDomain,
        store.access_token
      );

      // Get all recommendations using pagination
      const recommendations = await this.getAllRecordsNoPagination(
        'simple_recommendations',
        shopDomain,
        'recommended_at'
      );

      if (!recommendations || recommendations.length === 0) {
        return {
          ordersProcessed: 0,
          conversionsCreated: 0,
          totalRevenue: 0,
          averageTimeToConversion: 0,
        };
      }

      // Get date range for orders
      const oldestRec = recommendations[0].recommended_at;
      const newestRec =
        recommendations[recommendations.length - 1].recommended_at;

      // Fetch historical orders from Shopify
      const orders = await this.fetchShopifyOrdersInDateRange(
        shopDomain,
        new Date(oldestRec),
        new Date(newestRec)
      );

      // Clear existing conversions for this shop to avoid duplicates
      await this.supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', shopDomain);

      // Match orders to recommendations
      const conversions: Array<{
        session_id: string;
        order_id: string;
        product_id: string;
        shop_domain: string;
        recommended_at: string;
        purchased_at: string;
        minutes_to_conversion: number;
        confidence: number;
        order_quantity: number;
        order_amount: number;
        total_order_amount: number;
      }> = [];

      let totalRevenue = 0;
      let totalMinutes = 0;

      for (const order of orders) {
        for (const lineItem of order.lineItems) {
          const matchingRecommendations = this.findMatchingRecommendations(
            recommendations,
            lineItem,
            new Date(order.createdAt)
          );

          for (const recMatch of matchingRecommendations) {
            const minutesToConversion = Math.round(
              (new Date(order.createdAt).getTime() -
                new Date(recMatch.recommended_at).getTime()) /
                (1000 * 60)
            );

            const orderAmount = parseFloat(lineItem.price) * lineItem.quantity;
            totalRevenue += orderAmount;
            totalMinutes += minutesToConversion;

            conversions.push({
              session_id: recMatch.session_id,
              order_id: order.id,
              product_id: lineItem.productId,
              shop_domain: shopDomain,
              recommended_at: recMatch.recommended_at,
              purchased_at: order.createdAt,
              minutes_to_conversion: minutesToConversion,
              confidence: recMatch.confidence || 0.8,
              order_quantity: lineItem.quantity,
              order_amount: orderAmount,
              total_order_amount: parseFloat(order.totalPrice),
            });
          }
        }
      }

      // Insert conversions in batches
      let conversionsCreated = 0;
      if (conversions.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < conversions.length; i += batchSize) {
          const batch = conversions.slice(i, i + batchSize);

          const { error: insertError } = await this.supabaseService.client
            .from('simple_conversions')
            .insert(batch);

          if (insertError) {
            logger.error('Error inserting conversions batch:', insertError);
            throw new AppError(
              `Failed to insert conversions: ${insertError.message}`,
              500
            );
          }

          conversionsCreated += batch.length;
        }
      }

      const averageTimeToConversion =
        conversions.length > 0 ? totalMinutes / conversions.length : 0;

      const result = {
        ordersProcessed: orders.length,
        conversionsCreated,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageTimeToConversion:
          Math.round(averageTimeToConversion * 100) / 100,
      };

      logger.info('Historical conversions processing completed', result);
      return result;
    } catch (error) {
      logger.error('Error processing historical conversions:', error);
      throw new AppError('Failed to process historical conversions', 500);
    }
  }

  /**
   * Find recommendations that match a line item
   */
  private findMatchingRecommendations(
    recommendations: any[],
    lineItem: any,
    orderDate: Date
  ): any[] {
    const matches: any[] = [];

    for (const rec of recommendations) {
      const recDate = new Date(rec.recommended_at);
      const minutesDiff =
        (orderDate.getTime() - recDate.getTime()) / (1000 * 60);

      // Check if within attribution window
      if (
        minutesDiff < 0 ||
        minutesDiff >
          EnhancedConversionAnalyticsService.ATTRIBUTION_WINDOWS.VIEW_THROUGH
      ) {
        continue;
      }

      // Check for exact product ID match
      if (rec.product_id && rec.product_id === lineItem.productId) {
        matches.push(rec);
        continue;
      }

      // Check for fuzzy title match
      if (
        this.calculateStringSimilarity(
          rec.product_title.toLowerCase(),
          lineItem.title.toLowerCase()
        ) >= 0.7
      ) {
        matches.push(rec);
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
   * Fetch Shopify orders within date range
   */
  private async fetchShopifyOrdersInDateRange(
    shopDomain: string,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    // Get store data to access token
    const store = await this.supabaseService.getStore(shopDomain);
    if (!store) {
      throw new AppError(`Store not found: ${shopDomain}`, 404);
    }

    // Use existing method from ShopifyService
    const orders = await this.shopifyService.getOrdersByDateRange(
      shopDomain,
      store.access_token,
      fromDate.toISOString(),
      toDate.toISOString()
    );

    return orders;
  }

  /**
   * Generate comprehensive conversion dashboard data
   */
  async generateConversionDashboard(
    shopDomain: string,
    days: number = 30
  ): Promise<ConversionDashboardData> {
    try {
      logger.info('Generating conversion dashboard', { shopDomain, days });

      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      // Get ALL recommendations in period using pagination
      const recommendations = await this.getAllRecords(
        'simple_recommendations',
        shopDomain,
        'recommended_at',
        startDate,
        endDate
      );

      // Get ALL conversions in period using pagination
      const conversions = await this.getAllRecords(
        'simple_conversions',
        shopDomain,
        'purchased_at',
        startDate,
        endDate
      );

      const recs = recommendations || [];
      const convs = conversions || [];

      // Calculate overview metrics
      const totalRecommendations = recs.length;
      const totalConversions = convs.length;
      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;
      const totalRevenue = convs.reduce(
        (sum, conv) => sum + parseFloat(conv.order_amount || '0'),
        0
      );
      const averageOrderValue =
        totalConversions > 0 ? totalRevenue / totalConversions : 0;
      const averageTimeToConversion =
        totalConversions > 0
          ? convs.reduce(
              (sum, conv) => sum + (conv.minutes_to_conversion || 0),
              0
            ) / totalConversions
          : 0;

      // Generate timeline data
      const timeline = this.generateTimelineData(recs, convs, days);

      // Calculate top products
      const topProducts = this.calculateTopProducts(recs, convs);

      // Get recent activity
      const recentActivity = this.getRecentActivity(recs, convs);

      // Calculate attribution breakdown
      const attributionBreakdown = this.calculateAttributionBreakdown(convs);

      // Compare with previous period
      const periodComparison = await this.calculatePeriodComparison(
        shopDomain,
        days
      );

      const dashboard: ConversionDashboardData = {
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
        recentActivity,
        attributionBreakdown,
        periodComparison,
      };

      logger.info('Conversion dashboard generated successfully', {
        shopDomain,
        totalRecommendations,
        totalConversions,
        conversionRate: dashboard.overview.conversionRate,
      });

      return dashboard;
    } catch (error) {
      logger.error('Error generating conversion dashboard:', error);
      throw new AppError('Failed to generate conversion dashboard', 500);
    }
  }

  // Additional helper methods for dashboard generation...

  private generateTimelineData(
    recommendations: any[],
    conversions: any[],
    days: number
  ): any[] {
    const dailyData = new Map<
      string,
      { recommendations: number; conversions: number; revenue: number }
    >();

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateKey = date.toISOString().split('T')[0];
      dailyData.set(dateKey, {
        recommendations: 0,
        conversions: 0,
        revenue: 0,
      });
    }

    // Process recommendations
    recommendations.forEach(rec => {
      const dateKey = new Date(rec.recommended_at).toISOString().split('T')[0];
      const data = dailyData.get(dateKey);
      if (data) {
        data.recommendations++;
      }
    });

    // Process conversions
    conversions.forEach(conv => {
      const dateKey = new Date(conv.purchased_at).toISOString().split('T')[0];
      const data = dailyData.get(dateKey);
      if (data) {
        data.conversions++;
        data.revenue += parseFloat(conv.order_amount || '0');
      }
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      recommendations: data.recommendations,
      conversions: data.conversions,
      revenue: Math.round(data.revenue * 100) / 100,
      conversionRate:
        data.recommendations > 0
          ? Math.round((data.conversions / data.recommendations) * 10000) / 100
          : 0,
    }));
  }

  private calculateTopProducts(
    recommendations: any[],
    conversions: any[]
  ): any[] {
    const productStats = new Map<
      string,
      {
        productId: string;
        productTitle: string;
        recommendations: number;
        conversions: number;
        revenue: number;
      }
    >();

    // Process recommendations
    recommendations.forEach(rec => {
      const key = rec.product_id || rec.product_title;
      if (!productStats.has(key)) {
        productStats.set(key, {
          productId: rec.product_id || '',
          productTitle: rec.product_title,
          recommendations: 0,
          conversions: 0,
          revenue: 0,
        });
      }
      productStats.get(key)!.recommendations++;
    });

    // Process conversions
    conversions.forEach(conv => {
      const key = conv.product_id;
      const stats = productStats.get(key);
      if (stats) {
        stats.conversions++;
        stats.revenue += parseFloat(conv.order_amount || '0');
      }
    });

    return Array.from(productStats.values())
      .map(stats => ({
        ...stats,
        conversionRate:
          stats.recommendations > 0
            ? Math.round((stats.conversions / stats.recommendations) * 10000) /
              100
            : 0,
        revenue: Math.round(stats.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private getRecentActivity(recommendations: any[], conversions: any[]): any[] {
    const activity: any[] = [];

    // Add recent recommendations
    recommendations.slice(0, 10).forEach(rec => {
      activity.push({
        type: 'recommendation' as const,
        timestamp: rec.recommended_at,
        productTitle: rec.product_title,
        sessionId: rec.session_id,
      });
    });

    // Add recent conversions
    conversions.slice(0, 10).forEach(conv => {
      activity.push({
        type: 'conversion' as const,
        timestamp: conv.purchased_at,
        productTitle: conv.product_title || 'Unknown Product',
        sessionId: conv.session_id,
        amount: parseFloat(conv.order_amount || '0'),
      });
    });

    return activity
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 20);
  }

  private calculateAttributionBreakdown(conversions: any[]): any {
    const breakdown = {
      direct: { count: 0, revenue: 0 },
      assisted: { count: 0, revenue: 0 },
      viewThrough: { count: 0, revenue: 0 },
    };

    conversions.forEach(conv => {
      const minutes = conv.minutes_to_conversion || 0;
      const revenue = parseFloat(conv.order_amount || '0');

      if (
        minutes <= EnhancedConversionAnalyticsService.ATTRIBUTION_WINDOWS.DIRECT
      ) {
        breakdown.direct.count++;
        breakdown.direct.revenue += revenue;
      } else if (
        minutes <=
        EnhancedConversionAnalyticsService.ATTRIBUTION_WINDOWS.ASSISTED
      ) {
        breakdown.assisted.count++;
        breakdown.assisted.revenue += revenue;
      } else {
        breakdown.viewThrough.count++;
        breakdown.viewThrough.revenue += revenue;
      }
    });

    // Round revenue
    breakdown.direct.revenue = Math.round(breakdown.direct.revenue * 100) / 100;
    breakdown.assisted.revenue =
      Math.round(breakdown.assisted.revenue * 100) / 100;
    breakdown.viewThrough.revenue =
      Math.round(breakdown.viewThrough.revenue * 100) / 100;

    return breakdown;
  }

  private async calculatePeriodComparison(
    shopDomain: string,
    days: number
  ): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(
      prevEndDate.getTime() - days * 24 * 60 * 60 * 1000
    );

    // Get previous period data
    const { data: prevConversions } = await this.supabaseService.client
      .from('simple_conversions')
      .select('order_amount')
      .eq('shop_domain', shopDomain)
      .gte('purchased_at', prevStartDate.toISOString())
      .lte('purchased_at', prevEndDate.toISOString())
      .limit(10000);

    const { data: prevRecommendations } = await this.supabaseService.client
      .from('simple_recommendations')
      .select('session_id, product_id')
      .eq('shop_domain', shopDomain)
      .gte('recommended_at', prevStartDate.toISOString())
      .lte('recommended_at', prevEndDate.toISOString())
      .limit(10000);

    const prevConvCount = prevConversions?.length || 0;
    const prevUniqueRecs = new Set(
      (prevRecommendations || []).map(
        (r: any) => `${r.session_id}:${r.product_id}`
      )
    );
    const prevRecCount = prevUniqueRecs.size;
    const prevRevenue =
      prevConversions?.reduce(
        (sum, conv) => sum + parseFloat(conv.order_amount || '0'),
        0
      ) || 0;
    const prevRate =
      prevRecCount > 0 ? (prevConvCount / prevRecCount) * 100 : 0;

    return {
      currentPeriod: { conversions: 0, revenue: 0, rate: 0 }, // This would be filled by calling method
      previousPeriod: {
        conversions: prevConvCount,
        revenue: Math.round(prevRevenue * 100) / 100,
        rate: Math.round(prevRate * 100) / 100,
      },
      change: { conversions: 0, revenue: 0, rate: 0 }, // Calculate in calling method
    };
  }
}
