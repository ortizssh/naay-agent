import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import { logger } from '@/utils/logger';
import { AppError, ShopifyStore } from '@/types';
import {
  PerformanceMonitor,
  measurePerformance,
} from '@/utils/performance-monitor';

export interface AnalyticsData {
  totalProducts: number;
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  averageMessagesPerConversation: number;
  averageSessionDuration: number; // in minutes
  averageRating?: number;
  topProducts: Array<{
    title: string;
    mentions: number;
    rating?: number;
  }>;
  conversationsByDay: Array<{
    date: string;
    count: number;
  }>;
  messagesByDay: Array<{
    date: string;
    count: number;
  }>;
}

export interface GeneralMetrics {
  totalConversations: number;
  totalMessages: number;
  uniqueSessionIds: number;
  averageMessagesPerConversation: number;
  averageSessionDuration: number; // in minutes
  conversationCompletionRate: number; // percentage of conversations with >3 messages
  peakHours: Array<{
    hour: number;
    messageCount: number;
  }>;
  responseTimeMetrics: {
    averageResponseTime: number; // seconds
    medianResponseTime: number;
    fastResponseRate: number; // percentage of responses < 30 seconds
  };
}

export interface ProductRecommendationMetrics {
  totalRecommendationsMade: number;
  uniqueProductsRecommended: number;
  topRecommendedProducts: Array<{
    productId: string;
    productTitle: string;
    handle: string;
    recommendationCount: number;
    uniqueConversations: number;
    images: any[];
    price: number;
    vendor?: string;
  }>;
  recommendationsByIntent: Array<{
    intent: string;
    count: number;
  }>;
  recommendationTrends: Array<{
    date: string;
    recommendationCount: number;
  }>;
}

export interface EngagementMetrics {
  conversationsByLength: Array<{
    messageRange: string;
    count: number;
  }>;
  userEngagementLevels: Array<{
    level: string;
    sessionCount: number;
    description: string;
  }>;
  conversationOutcomes: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
  mostActiveTimeSlots: Array<{
    timeSlot: string;
    conversationCount: number;
    messageCount: number;
  }>;
}

export interface ConversionData {
  totalConversations: number;
  conversationsWithRecommendations: number;
  conversionRate: number;
  recommendationsByProduct: Array<{
    product_title: string;
    recommendation_count: number;
    average_rating?: number;
  }>;
}

export interface ConversationItem {
  session_id: string;
  messages: number;
  first_message: string;
  last_activity: string;
  user_messages: number;
  ai_messages: number;
}

export interface DatabaseMessage {
  id: string;
  role: 'client' | 'agent' | 'system';
  content: string;
  timestamp: string;
  session_id?: string;
}

// Removed DatabaseSession interface - no longer using chat_sessions table
// All conversation data is now derived from chat_messages only

export interface DatabaseConversationStats {
  session_id: string;
  total_messages: number;
  user_messages: number;
  ai_messages: number;
  first_message: string;
  last_activity: string;
}

export interface QueryExecutionOptions {
  timeoutMs?: number;
  queryName?: string;
  useCache?: boolean;
  cacheTtl?: number;
}

export interface ConversationsResponse {
  conversations: ConversationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChartDataPoint {
  date: string;
  conversations: number;
  sales: number;
  orders_count: number;
}

export interface ChartAnalytics {
  daily_data: ChartDataPoint[];
  totals: {
    conversations: number;
    sales: number;
    orders: number;
    average_order: number;
  };
  period_days: number;
}

export class AdminAnalyticsService {
  private supabaseService: SupabaseService;
  private cacheService: CacheService;

  // Cache TTL in seconds - Optimized for performance
  private static readonly CACHE_TTL = {
    CONVERSATIONS: 900, // 15 minutes (increased for better performance)
    CHART_ANALYTICS: 1800, // 30 minutes
    SHOP_STATS: 600, // 10 minutes
    TOP_PRODUCTS: 1800, // 30 minutes
  };

  // Query timeout in milliseconds - Optimized timeouts
  private static readonly QUERY_TIMEOUT = 15000; // 15 seconds
  private static readonly FAST_QUERY_TIMEOUT = 5000; // 5 seconds for simple queries

  constructor() {
    this.supabaseService = new SupabaseService();
    this.cacheService = new CacheService();
  }

  /**
   * Create a date range that ensures current day data is included
   * @param daysBack - Number of days to go back from today (inclusive)
   * @returns Object with startDate (beginning of day X days ago) and endDate (end of today)
   */
  private createInclusiveDateRange(daysBack: number): {
    startDate: Date;
    endDate: Date;
  } {
    // Work with UTC dates to avoid timezone issues
    const now = new Date();

    // End of today in UTC (23:59:59.999)
    const endDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    // Beginning of day X days ago in UTC (00:00:00.000)
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (daysBack - 1)); // Include today in the count
    startDate.setUTCHours(0, 0, 0, 0);

    logger.debug('Created inclusive date range', {
      daysBack,
      actualDaysIncluded: daysBack,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today: new Date().toISOString().split('T')[0],
      note: 'Using UTC dates to avoid timezone offset issues',
    });

    return { startDate, endDate };
  }

  /**
   * Execute paginated query to retrieve ALL data beyond Supabase's 1000 row limit
   * @param queryBuilder - The query builder function
   * @param options - Query execution options
   */
  private async executeCompleteQuery<T>(
    queryBuilder: (limit: number, offset: number) => any,
    options: {
      batchSize?: number;
      maxRecords?: number;
      queryName?: string;
    } = {}
  ): Promise<T[]> {
    const {
      batchSize = 1000,
      maxRecords = 50000, // Safety limit for very large datasets
      queryName = 'Unknown Query',
    } = options;

    const allResults: T[] = [];
    let offset = 0;
    let hasMoreData = true;

    logger.info(`Starting complete data retrieval for ${queryName}`, {
      batchSize,
      maxRecords,
      queryName,
    });

    while (hasMoreData && allResults.length < maxRecords) {
      const currentBatchSize = Math.min(
        batchSize,
        maxRecords - allResults.length
      );

      logger.debug(
        `Fetching batch ${Math.floor(offset / batchSize) + 1} for ${queryName}`,
        {
          offset,
          batchSize: currentBatchSize,
          totalSoFar: allResults.length,
        }
      );

      const { data, error } = await queryBuilder(currentBatchSize, offset);

      if (error) {
        logger.error(`Error in complete query batch for ${queryName}:`, {
          error: error.message,
          offset,
          batchSize: currentBatchSize,
        });
        throw new AppError(`Failed to fetch data: ${error.message}`, 500);
      }

      const results = data || [];
      allResults.push(...results);

      // Check if we got fewer results than requested (indicates end of data)
      if (results.length < currentBatchSize) {
        hasMoreData = false;
        logger.info(
          `Reached end of data for ${queryName} - got ${results.length} in final batch`
        );
      } else {
        offset += currentBatchSize;
      }
    }

    logger.info(`Complete data retrieval finished for ${queryName}`, {
      totalRecords: allResults.length,
      batchesProcessed: Math.floor(offset / batchSize) + 1,
      hitMaxLimit: allResults.length >= maxRecords,
    });

    if (allResults.length >= maxRecords) {
      logger.warn(`Hit maximum record limit for ${queryName}`, {
        maxRecords,
        actualRecords: allResults.length,
      });
    }

    return allResults;
  }

  /**
   * Execute a database query with timeout handling and improved error handling
   * @param queryFunction - The database query function to execute
   * @param options - Query execution options including timeout, cache settings
   */
  private async executeWithTimeout<T>(
    queryFunction: () => Promise<T>,
    options: QueryExecutionOptions = {}
  ): Promise<T> {
    const {
      timeoutMs = AdminAnalyticsService.QUERY_TIMEOUT,
      queryName = 'Unknown Query',
      useCache = false,
      cacheTtl = 300,
    } = options;

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;
    let isTimeoutCleared = false;

    try {
      const result = await Promise.race([
        queryFunction(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new AppError(
                `Query timeout: ${queryName} exceeded ${timeoutMs}ms`,
                408
              )
            );
          }, timeoutMs);
        }),
      ]);

      // Clear timeout if query completes successfully
      if (timeoutId && !isTimeoutCleared) {
        clearTimeout(timeoutId);
        isTimeoutCleared = true;
      }

      const duration = Date.now() - startTime;

      // Log performance metrics
      if (duration > 5000) {
        logger.warn(`Slow query detected: ${queryName} took ${duration}ms`, {
          queryName,
          duration,
          timeoutMs,
        });
      } else {
        logger.info(`Query completed: ${queryName} took ${duration}ms`, {
          queryName,
          duration,
        });
      }

      return result;
    } catch (error) {
      // Clear timeout on error
      if (timeoutId && !isTimeoutCleared) {
        clearTimeout(timeoutId);
        isTimeoutCleared = true;
      }

      const errorMessage = this.formatDatabaseError(error, queryName);
      logger.error(`Query error in ${queryName}:`, {
        queryName,
        error: errorMessage,
        originalError: error,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(errorMessage, 500);
    }
  }

  /**
   * Format database errors into user-friendly messages
   */
  private formatDatabaseError(error: any, queryName: string): string {
    if (error instanceof AppError) {
      return error.message;
    }

    // Handle Supabase/PostgrestError
    if (error?.code) {
      switch (error.code) {
        case 'PGRST116':
          return 'Resource not found';
        case 'PGRST301':
          return 'Database connection failed';
        default:
          return `Database error in ${queryName}: ${error.message || 'Unknown error'}`;
      }
    }

    return `Unexpected error in ${queryName}: ${error?.message || 'Unknown error'}`;
  }

  /**
   * Safely get store with proper error handling
   */
  private async getStoreWithValidation(shop: string): Promise<ShopifyStore> {
    try {
      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError(`Store '${shop}' not found`, 404);
      }
      return store;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Failed to fetch store '${shop}': ${error.message}`,
        500
      );
    }
  }

  /**
   * Extract product recommendations from message content
   * Looks for structured product data in AI agent responses
   */
  private extractProductRecommendations(messages: DatabaseMessage[]): Array<{
    productId?: string;
    productTitle: string;
    sessionId: string;
    messageId: string;
    timestamp: string;
    intent?: string;
  }> {
    const recommendations: Array<{
      productId?: string;
      productTitle: string;
      sessionId: string;
      messageId: string;
      timestamp: string;
      intent?: string;
    }> = [];

    messages.forEach(message => {
      if (message.role === 'agent') {
        // Look for product patterns in agent responses
        const content = message.content;

        // Pattern 1: **Product Title** - $price format
        const productRegex = /\*\*([^*]+)\*\*\s*-\s*\$[\d,]+(?:\.\d{2})?/g;
        let match;
        while ((match = productRegex.exec(content)) !== null) {
          const productTitle = match[1].trim();
          recommendations.push({
            productTitle,
            sessionId: message.session_id || '',
            messageId: message.id,
            timestamp: message.timestamp,
          });
        }

        // Pattern 2: Product ID: followed by number
        const productIdRegex = /Product ID:\s*(\d+)/g;
        let idMatch;
        const existingTitles = recommendations
          .filter(r => r.sessionId === message.session_id)
          .map(r => r.productTitle);

        while ((idMatch = productIdRegex.exec(content)) !== null) {
          const productId = idMatch[1];
          // Try to match with recently extracted titles in same message
          const titleMatch = content.match(/\*\*([^*]+)\*\*/);
          if (titleMatch && existingTitles.length > 0) {
            const lastRec = recommendations[recommendations.length - 1];
            if (lastRec.sessionId === message.session_id) {
              lastRec.productId = productId;
            }
          }
        }

        // Pattern 3: Detect recommendation intent from context
        const intentPatterns = {
          complementary: /go well together|complement|pair with|works with/i,
          similar: /similar to|like this|related|comparable/i,
          popular: /popular|trending|bestseller|top rated/i,
          upsell: /upgrade|premium|better|enhanced/i,
        };

        let detectedIntent = 'popular'; // default
        for (const [intent, pattern] of Object.entries(intentPatterns)) {
          if (pattern.test(content)) {
            detectedIntent = intent;
            break;
          }
        }

        // Update intent for recommendations in this message
        recommendations
          .filter(
            r =>
              r.sessionId === message.session_id && r.messageId === message.id
          )
          .forEach(r => (r.intent = detectedIntent));
      }
    });

    return recommendations;
  }

  /**
   * Calculate response time between user and agent messages
   */
  private calculateResponseTimes(messages: DatabaseMessage[]): number[] {
    const responseTimes: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      const currentMsg = messages[i];
      const previousMsg = messages[i - 1];

      // Look for agent response to client message
      if (currentMsg.role === 'agent' && previousMsg.role === 'client') {
        const responseTime =
          new Date(currentMsg.timestamp).getTime() -
          new Date(previousMsg.timestamp).getTime();
        responseTimes.push(responseTime / 1000); // Convert to seconds
      }
    }

    return responseTimes;
  }

  /**
   * Get comprehensive general metrics
   */
  async getGeneralMetrics(shop: string): Promise<GeneralMetrics> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting general metrics for shop:', { shop });

        // Check cache first
        const cacheKey = `general-metrics:${shop}`;
        const cachedMetrics =
          await this.cacheService.get<GeneralMetrics>(cacheKey);
        if (cachedMetrics) {
          return cachedMetrics;
        }

        // Get ALL messages for complete historical analytics using pagination
        logger.info(
          'Fetching ALL chat messages with pagination to ensure complete data'
        );

        const messages = await this.executeCompleteQuery<any>(
          (limit, offset) =>
            this.supabaseService.client
              .from('chat_messages')
              .select('id, role, content, timestamp, session_id')
              .order('timestamp', { ascending: true })
              .range(offset, offset + limit - 1),
          {
            queryName: 'getAllMessagesForGeneralMetrics',
            batchSize: 1000,
          }
        );

        // Error handling is now done in executeCompleteQuery

        const messagesList = messages || [];
        const totalMessages = messagesList.length;

        // Calculate conversation metrics
        const sessionMap = new Map<
          string,
          {
            messages: typeof messagesList;
            startTime: Date;
            endTime: Date;
            messageCount: number;
          }
        >();

        messagesList.forEach(msg => {
          const sessionId = msg.session_id;
          const timestamp = new Date(msg.timestamp);

          if (!sessionMap.has(sessionId)) {
            sessionMap.set(sessionId, {
              messages: [],
              startTime: timestamp,
              endTime: timestamp,
              messageCount: 0,
            });
          }

          const session = sessionMap.get(sessionId)!;
          session.messages.push(msg);
          session.messageCount++;

          if (timestamp < session.startTime) session.startTime = timestamp;
          if (timestamp > session.endTime) session.endTime = timestamp;
        });

        const totalConversations = sessionMap.size;
        const uniqueSessionIds = totalConversations;

        // Calculate average messages per conversation
        const averageMessagesPerConversation =
          totalConversations > 0 ? totalMessages / totalConversations : 0;

        // Calculate average session duration
        const sessionDurations = Array.from(sessionMap.values())
          .map(session => {
            const duration =
              session.endTime.getTime() - session.startTime.getTime();
            return duration / (1000 * 60); // Convert to minutes
          })
          .filter(duration => duration > 0);

        const averageSessionDuration =
          sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
              sessionDurations.length
            : 0;

        // Calculate conversation completion rate (>3 messages)
        const completedConversations = Array.from(sessionMap.values()).filter(
          session => session.messageCount > 3
        ).length;
        const conversationCompletionRate =
          totalConversations > 0
            ? (completedConversations / totalConversations) * 100
            : 0;

        // Calculate peak hours
        const hourCounts = new Map<number, number>();
        messagesList.forEach(msg => {
          const hour = new Date(msg.timestamp).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        });

        const peakHours = Array.from(hourCounts.entries())
          .map(([hour, count]) => ({ hour, messageCount: count }))
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, 5);

        // Calculate response time metrics
        const responseTimes = this.calculateResponseTimes(messagesList);
        const averageResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length
            : 0;

        const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
        const medianResponseTime =
          sortedResponseTimes.length > 0
            ? sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)]
            : 0;

        const fastResponses = responseTimes.filter(time => time < 30).length;
        const fastResponseRate =
          responseTimes.length > 0
            ? (fastResponses / responseTimes.length) * 100
            : 0;

        const metrics: GeneralMetrics = {
          totalConversations,
          totalMessages,
          uniqueSessionIds,
          averageMessagesPerConversation:
            Math.round(averageMessagesPerConversation * 100) / 100,
          averageSessionDuration:
            Math.round(averageSessionDuration * 100) / 100,
          conversationCompletionRate:
            Math.round(conversationCompletionRate * 100) / 100,
          peakHours,
          responseTimeMetrics: {
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            medianResponseTime: Math.round(medianResponseTime * 100) / 100,
            fastResponseRate: Math.round(fastResponseRate * 100) / 100,
          },
        };

        // Cache the results
        await this.cacheService.set(cacheKey, metrics, {
          ttl: AdminAnalyticsService.CACHE_TTL.SHOP_STATS,
        });

        return metrics;
      },
      {
        queryName: `getGeneralMetrics-${shop}`,
        timeoutMs: 20000,
      }
    );
  }

  /**
   * Get product recommendation analytics
   */
  async getProductRecommendationMetrics(
    shop: string
  ): Promise<ProductRecommendationMetrics> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting product recommendation metrics for shop:', {
          shop,
        });

        // Check cache first
        const cacheKey = `recommendation-metrics:${shop}`;
        const cachedMetrics =
          await this.cacheService.get<ProductRecommendationMetrics>(cacheKey);
        if (cachedMetrics) {
          return cachedMetrics;
        }

        // Get ALL messages to extract complete recommendation history using pagination
        logger.info(
          'Fetching ALL chat messages with pagination for recommendation metrics'
        );

        const messages = await this.executeCompleteQuery<any>(
          (limit, offset) =>
            this.supabaseService.client
              .from('chat_messages')
              .select('id, role, content, timestamp, session_id')
              .order('timestamp', { ascending: true })
              .range(offset, offset + limit - 1),
          {
            queryName: 'getAllMessagesForRecommendationMetrics',
            batchSize: 1000,
          }
        );

        // Error handling is now done in executeCompleteQuery

        const messagesList = messages || [];

        // Extract product recommendations from messages
        const recommendations =
          this.extractProductRecommendations(messagesList);
        const totalRecommendationsMade = recommendations.length;

        // Count unique products recommended
        const uniqueProducts = new Set(
          recommendations.map(r => r.productTitle)
        );
        const uniqueProductsRecommended = uniqueProducts.size;

        // Calculate top recommended products
        const productCounts = new Map<
          string,
          {
            count: number;
            sessions: Set<string>;
            productId?: string;
          }
        >();

        recommendations.forEach(rec => {
          const key = rec.productTitle;
          if (!productCounts.has(key)) {
            productCounts.set(key, {
              count: 0,
              sessions: new Set(),
              productId: rec.productId,
            });
          }
          const productData = productCounts.get(key)!;
          productData.count++;
          productData.sessions.add(rec.sessionId);
          if (rec.productId) productData.productId = rec.productId;
        });

        // Get product details for top recommended products
        const topProductTitles = Array.from(productCounts.entries())
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 10)
          .map(([title]) => title);

        const { data: products, error: productsError } =
          await this.supabaseService.client
            .from('products')
            .select(
              `
            id, title, handle, images, vendor,
            product_variants (price)
          `
            )
            .eq('shop_domain', shop)
            .in('title', topProductTitles);

        const productsMap = new Map();
        (products || []).forEach(product => {
          productsMap.set(product.title, product);
        });

        const topRecommendedProducts = Array.from(productCounts.entries())
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 10)
          .map(([title, data]) => {
            const product = productsMap.get(title);
            const minPrice =
              product?.product_variants?.length > 0
                ? Math.min(
                    ...product.product_variants.map((v: any) =>
                      parseFloat(v.price || '0')
                    )
                  )
                : 0;

            return {
              productId: data.productId || product?.id || '',
              productTitle: title,
              handle: product?.handle || '',
              recommendationCount: data.count,
              uniqueConversations: data.sessions.size,
              images: product?.images || [],
              price: minPrice,
              vendor: product?.vendor,
            };
          });

        // Calculate recommendations by intent
        const intentCounts = new Map<string, number>();
        recommendations.forEach(rec => {
          const intent = rec.intent || 'popular';
          intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
        });

        const recommendationsByIntent = Array.from(intentCounts.entries())
          .map(([intent, count]) => ({ intent, count }))
          .sort((a, b) => b.count - a.count);

        // Calculate recommendation trends (last 30 days including today)
        const { startDate: thirtyDaysAgo, endDate: today } =
          this.createInclusiveDateRange(30);

        const recentRecommendations = recommendations.filter(rec => {
          const recDate = new Date(rec.timestamp);
          return recDate >= thirtyDaysAgo && recDate <= today;
        });

        const trendMap = new Map<string, number>();
        recentRecommendations.forEach(rec => {
          const date = new Date(rec.timestamp).toISOString().split('T')[0];
          trendMap.set(date, (trendMap.get(date) || 0) + 1);
        });

        const recommendationTrends = Array.from(trendMap.entries())
          .map(([date, count]) => ({ date, recommendationCount: count }))
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        const metrics: ProductRecommendationMetrics = {
          totalRecommendationsMade,
          uniqueProductsRecommended,
          topRecommendedProducts,
          recommendationsByIntent,
          recommendationTrends,
        };

        // Cache the results
        await this.cacheService.set(cacheKey, metrics, {
          ttl: AdminAnalyticsService.CACHE_TTL.TOP_PRODUCTS,
        });

        return metrics;
      },
      {
        queryName: `getProductRecommendationMetrics-${shop}`,
        timeoutMs: 20000,
      }
    );
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(shop: string): Promise<EngagementMetrics> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting engagement metrics for shop:', { shop });

        // Check cache first
        const cacheKey = `engagement-metrics:${shop}`;
        const cachedMetrics =
          await this.cacheService.get<EngagementMetrics>(cacheKey);
        if (cachedMetrics) {
          return cachedMetrics;
        }

        // Get ALL messages for complete engagement analysis using pagination
        logger.info(
          'Fetching ALL chat messages with pagination for engagement metrics'
        );

        const messages = await this.executeCompleteQuery<any>(
          (limit, offset) =>
            this.supabaseService.client
              .from('chat_messages')
              .select('id, role, content, timestamp, session_id')
              .order('timestamp', { ascending: true })
              .range(offset, offset + limit - 1),
          {
            queryName: 'getAllMessagesForEngagementMetrics',
            batchSize: 1000,
          }
        );

        // Error handling is now done in executeCompleteQuery

        const messagesList = messages || [];

        // Group by conversation
        const conversationMap = new Map<
          string,
          {
            messages: typeof messagesList;
            messageCount: number;
            startTime: Date;
            endTime: Date;
          }
        >();

        messagesList.forEach(msg => {
          const sessionId = msg.session_id;
          const timestamp = new Date(msg.timestamp);

          if (!conversationMap.has(sessionId)) {
            conversationMap.set(sessionId, {
              messages: [],
              messageCount: 0,
              startTime: timestamp,
              endTime: timestamp,
            });
          }

          const conv = conversationMap.get(sessionId)!;
          conv.messages.push(msg);
          conv.messageCount++;

          if (timestamp < conv.startTime) conv.startTime = timestamp;
          if (timestamp > conv.endTime) conv.endTime = timestamp;
        });

        // Calculate conversations by length
        const lengthRanges = [
          { range: '1 message', min: 1, max: 1 },
          { range: '2-3 messages', min: 2, max: 3 },
          { range: '4-10 messages', min: 4, max: 10 },
          { range: '11-20 messages', min: 11, max: 20 },
          { range: '20+ messages', min: 21, max: Infinity },
        ];

        const conversationsByLength = lengthRanges.map(range => {
          const count = Array.from(conversationMap.values()).filter(
            conv =>
              conv.messageCount >= range.min && conv.messageCount <= range.max
          ).length;
          return {
            messageRange: range.range,
            count,
          };
        });

        // Calculate user engagement levels
        const sessionCounts = Array.from(conversationMap.values()).map(
          conv => conv.messageCount
        );
        const userEngagementLevels = [
          {
            level: 'Low Engagement',
            sessionCount: sessionCounts.filter(count => count <= 3).length,
            description: '1-3 messages per conversation',
          },
          {
            level: 'Medium Engagement',
            sessionCount: sessionCounts.filter(
              count => count > 3 && count <= 10
            ).length,
            description: '4-10 messages per conversation',
          },
          {
            level: 'High Engagement',
            sessionCount: sessionCounts.filter(count => count > 10).length,
            description: '11+ messages per conversation',
          },
        ];

        // Calculate conversation outcomes
        const recommendations =
          this.extractProductRecommendations(messagesList);
        const sessionsWithRecommendations = new Set(
          recommendations.map(r => r.sessionId)
        ).size;
        const totalSessions = conversationMap.size;

        const conversationOutcomes = [
          {
            outcome: 'Recommendations Made',
            count: sessionsWithRecommendations,
            percentage:
              totalSessions > 0
                ? (sessionsWithRecommendations / totalSessions) * 100
                : 0,
          },
          {
            outcome: 'Information Only',
            count: totalSessions - sessionsWithRecommendations,
            percentage:
              totalSessions > 0
                ? ((totalSessions - sessionsWithRecommendations) /
                    totalSessions) *
                  100
                : 0,
          },
        ];

        // Calculate most active time slots
        const timeSlots = new Map<
          string,
          { conversations: Set<string>; messages: number }
        >();

        messagesList.forEach(msg => {
          const hour = new Date(msg.timestamp).getHours();
          let timeSlot = '';

          if (hour >= 6 && hour < 12) timeSlot = 'Morning (6AM-12PM)';
          else if (hour >= 12 && hour < 18) timeSlot = 'Afternoon (12PM-6PM)';
          else if (hour >= 18 && hour < 24) timeSlot = 'Evening (6PM-12AM)';
          else timeSlot = 'Night (12AM-6AM)';

          if (!timeSlots.has(timeSlot)) {
            timeSlots.set(timeSlot, { conversations: new Set(), messages: 0 });
          }

          const slot = timeSlots.get(timeSlot)!;
          slot.conversations.add(msg.session_id);
          slot.messages++;
        });

        const mostActiveTimeSlots = Array.from(timeSlots.entries())
          .map(([timeSlot, data]) => ({
            timeSlot,
            conversationCount: data.conversations.size,
            messageCount: data.messages,
          }))
          .sort((a, b) => b.messageCount - a.messageCount);

        const metrics: EngagementMetrics = {
          conversationsByLength,
          userEngagementLevels,
          conversationOutcomes,
          mostActiveTimeSlots,
        };

        // Cache the results
        await this.cacheService.set(cacheKey, metrics, {
          ttl: AdminAnalyticsService.CACHE_TTL.SHOP_STATS,
        });

        return metrics;
      },
      {
        queryName: `getEngagementMetrics-${shop}`,
        timeoutMs: 15000,
      }
    );
  }

  /**
   * Get shop statistics with improved caching and error handling
   * Now works only with chat_messages table, no chat_sessions references
   */
  async getShopStats(shop: string): Promise<AnalyticsData> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting shop stats for:', { shop });

        // Check cache first
        const cacheKey = `shop-stats:${shop}`;
        const cachedStats =
          await this.cacheService.get<AnalyticsData>(cacheKey);
        if (cachedStats) {
          logger.info('Returning cached shop stats for:', { shop });
          return cachedStats;
        }

        const store = await this.getStoreWithValidation(shop);

        // Get product count
        const { count: productCount, error: productError } =
          await this.supabaseService.client
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', shop);

        if (productError) {
          throw new AppError(
            `Failed to count products: ${productError.message}`,
            500
          );
        }

        // Get conversation and message stats from chat_messages
        // Query ALL messages using pagination to ensure complete historical data
        logger.info('Querying ALL chat messages from database with pagination');

        const allMessages = await this.executeCompleteQuery<any>(
          (limit, offset) =>
            this.supabaseService.client
              .from('chat_messages')
              .select('id, role, content, timestamp, session_id')
              .order('timestamp', { ascending: true })
              .range(offset, offset + limit - 1),
          {
            queryName: 'getAllMessagesForShopStats',
            batchSize: 1000,
          }
        );

        const conversationData = allMessages;
        const conversationError = null;

        if (conversationError) {
          throw new AppError(
            `Failed to fetch chat messages: ${conversationError.message}`,
            500
          );
        }

        const messages = conversationData || [];
        const totalMessages = messages.length;

        // Get unique session_ids to count conversations
        const uniqueSessionIds = new Set(messages.map(msg => msg.session_id));
        const conversationCount = uniqueSessionIds.size;

        // Get conversation data by day (last 30 days including today) from first message of each session
        const { startDate: thirtyDaysAgo, endDate: today } =
          this.createInclusiveDateRange(30);

        // Group messages by session and get first message timestamp for each session
        const sessionFirstMessages = new Map();
        messages.forEach(msg => {
          const sessionId = msg.session_id;
          const timestamp = new Date(msg.timestamp);

          if (
            !sessionFirstMessages.has(sessionId) ||
            timestamp < sessionFirstMessages.get(sessionId)
          ) {
            sessionFirstMessages.set(sessionId, timestamp);
          }
        });

        // Filter conversations from last 30 days including today and group by day
        const recentSessions = Array.from(sessionFirstMessages.entries())
          .filter(
            ([_, timestamp]) => timestamp >= thirtyDaysAgo && timestamp <= today
          )
          .map(([sessionId, timestamp]) => ({
            created_at: timestamp.toISOString(),
          }));

        const conversationsByDayProcessed = this.groupByDay(recentSessions, 30);

        // Process messages by day for the chart including today
        const recentMessages = messages
          .filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate >= thirtyDaysAgo && msgDate <= today;
          })
          .map(msg => ({
            created_at: msg.timestamp,
          }));

        const messagesByDayProcessed = this.groupByDay(recentMessages, 30);

        // Calculate enhanced metrics
        const sessionMap = new Map<
          string,
          { messageCount: number; startTime: Date; endTime: Date }
        >();
        messages.forEach(msg => {
          const sessionId = msg.session_id;
          const timestamp = new Date(msg.timestamp);

          if (!sessionMap.has(sessionId)) {
            sessionMap.set(sessionId, {
              messageCount: 0,
              startTime: timestamp,
              endTime: timestamp,
            });
          }

          const session = sessionMap.get(sessionId)!;
          session.messageCount++;

          if (timestamp < session.startTime) session.startTime = timestamp;
          if (timestamp > session.endTime) session.endTime = timestamp;
        });

        const uniqueUsers = sessionMap.size; // Unique session IDs as proxy for unique users
        const averageMessagesPerConversation =
          conversationCount > 0 ? totalMessages / conversationCount : 0;

        // Calculate average session duration
        const sessionDurations = Array.from(sessionMap.values())
          .map(session => {
            const duration =
              session.endTime.getTime() - session.startTime.getTime();
            return duration / (1000 * 60); // Convert to minutes
          })
          .filter(duration => duration > 0);

        const averageSessionDuration =
          sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
              sessionDurations.length
            : 0;

        // Extract product recommendations for topProducts
        const recommendations = this.extractProductRecommendations(messages);
        const productMentions = new Map<string, number>();
        recommendations.forEach(rec => {
          productMentions.set(
            rec.productTitle,
            (productMentions.get(rec.productTitle) || 0) + 1
          );
        });

        const topProducts = Array.from(productMentions.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([title, mentions]) => ({
            title,
            mentions,
          }));

        const stats: AnalyticsData = {
          totalProducts: productCount || 0,
          totalConversations: conversationCount,
          totalMessages: totalMessages,
          uniqueUsers,
          averageMessagesPerConversation:
            Math.round(averageMessagesPerConversation * 100) / 100,
          averageSessionDuration:
            Math.round(averageSessionDuration * 100) / 100,
          topProducts,
          conversationsByDay: conversationsByDayProcessed,
          messagesByDay: messagesByDayProcessed,
        };

        // Cache the results
        await this.cacheService.set(cacheKey, stats, {
          ttl: AdminAnalyticsService.CACHE_TTL.SHOP_STATS,
        });

        logger.info('Shop stats generated successfully', {
          shop,
          totalProducts: productCount || 0,
          totalConversations: conversationCount,
          totalMessages: totalMessages,
        });

        return stats;
      },
      {
        queryName: `getShopStats-${shop}`,
        timeoutMs: 15000,
      }
    );
  }

  async getConversionAnalytics(shop: string): Promise<ConversionData> {
    try {
      logger.info('Getting conversion analytics for:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Get total conversations from chat_messages by counting distinct session_ids
      // Query ALL messages using pagination to ensure complete historical data
      logger.info(
        'Querying ALL chat messages for conversion analytics with pagination'
      );

      const messages = await this.executeCompleteQuery<any>(
        (limit, offset) =>
          this.supabaseService.client
            .from('chat_messages')
            .select('id, role, content, timestamp, session_id')
            .order('timestamp', { ascending: true })
            .range(offset, offset + limit - 1),
        {
          queryName: 'getAllMessagesForConversionAnalytics',
          batchSize: 1000,
        }
      );

      const error = null;

      if (error) {
        throw new AppError(
          `Failed to fetch chat messages: ${error.message}`,
          500
        );
      }

      // Count unique session_ids to get total conversations
      const uniqueSessionIds = new Set(
        (messages || []).map(msg => msg.session_id)
      );
      const totalConversations = uniqueSessionIds.size;

      // Extract recommendations and analyze conversion data
      const recommendations = this.extractProductRecommendations(
        messages || []
      );
      const sessionsWithRecommendations = new Set(
        recommendations.map(r => r.sessionId)
      ).size;
      const conversationsWithRecommendations = sessionsWithRecommendations;
      const conversionRate = totalConversations
        ? (conversationsWithRecommendations / totalConversations) * 100
        : 0;

      // Calculate recommendations by product
      const productRecommendationCounts = new Map<string, number>();
      recommendations.forEach(rec => {
        productRecommendationCounts.set(
          rec.productTitle,
          (productRecommendationCounts.get(rec.productTitle) || 0) + 1
        );
      });

      const recommendationsByProduct = Array.from(
        productRecommendationCounts.entries()
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([product_title, recommendation_count]) => ({
          product_title,
          recommendation_count,
        }));

      return {
        totalConversations,
        conversationsWithRecommendations,
        conversionRate: Math.round(conversionRate * 100) / 100,
        recommendationsByProduct,
      };
    } catch (error) {
      logger.error('Error getting conversion analytics:', error);
      throw new AppError('Failed to get conversion analytics', 500);
    }
  }

  async getTopRecommendedProducts(shop: string, limit: number = 10) {
    try {
      logger.info('Getting top recommended products for:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Query products with actual images and their variants for pricing
      // ONLY return products that have real Shopify images (not empty arrays)
      const { data: products, error } = await this.supabaseService.client
        .from('products')
        .select(
          `
          id,
          title,
          handle,
          images,
          vendor,
          product_type,
          product_variants (
            price
          )
        `
        )
        .eq('shop_domain', shop)
        .not('images', 'eq', '[]') // Exclude products with empty image arrays
        .not('images', 'is', null) // Exclude products with null images
        .order('updated_at', { ascending: false })
        .limit(limit * 3); // Get more products to filter for valid images

      if (error) {
        logger.error('Error fetching products:', error);
        throw new AppError('Failed to fetch products', 500);
      }

      if (!products || products.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No products with images found',
        };
      }

      // Filter and format products to only include those with actual image URLs
      const formattedProducts = (products || [])
        .map((product: any) => {
          // Parse images JSONB and validate it contains real URLs
          let images = product.images;
          if (typeof images === 'string') {
            try {
              images = JSON.parse(images);
            } catch (e) {
              logger.warn(
                'Failed to parse images JSON for product:',
                product.id
              );
              return null;
            }
          }

          // Ensure images is an array with at least one valid image
          if (!Array.isArray(images) || images.length === 0) {
            return null;
          }

          // Find the first image with a valid URL
          const validImage = images.find((img: any) => {
            const src = img?.src || img?.url;
            return (
              src &&
              typeof src === 'string' &&
              src.trim().length > 0 &&
              src.startsWith('http')
            );
          });

          if (!validImage) {
            return null;
          }

          // Get minimum price from variants
          const variants = product.product_variants || [];
          const prices = variants
            .map((v: any) => parseFloat(v.price || '0'))
            .filter((p: number) => p > 0);
          const price = prices.length > 0 ? Math.min(...prices) : 0;

          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            image: {
              src: validImage.src || validImage.url,
              alt: validImage.alt || product.title,
            },
            price: price,
            recommendations: 0, // Since we don't have recommendation tracking yet
          };
        })
        .filter(Boolean) // Remove null entries
        .slice(0, limit); // Limit to requested number

      return {
        success: true,
        data: formattedProducts,
        message:
          formattedProducts.length > 0
            ? `Found ${formattedProducts.length} products with valid images`
            : 'No products with valid images found',
      };
    } catch (error) {
      logger.error('Error getting top recommended products:', error);
      throw new AppError('Failed to get top recommended products', 500);
    }
  }

  async getConversations(
    shop: string,
    limit: number = 10,
    page: number = 1
  ): Promise<ConversationsResponse> {
    return measurePerformance(
      'getConversations',
      async () => {
        logger.info('Getting conversations for shop:', { shop, limit, page });

        const pageNum = Math.max(1, page);
        const limitNum = Math.max(1, Math.min(100, limit)); // Limit between 1 and 100
        const offset = (pageNum - 1) * limitNum;

        // Check cache first
        const cacheKey = `conversations:${shop}:${limitNum}:${pageNum}`;
        const cachedConversations =
          await this.cacheService.get<ConversationsResponse>(cacheKey);
        if (cachedConversations) {
          logger.info('Returning cached conversations for:', {
            shop,
            limit,
            page,
          });

          // Record cache hit
          PerformanceMonitor.recordMetric({
            operation: 'getConversations (cache hit)',
            duration: 5, // Cache hits are very fast
            recordCount: cachedConversations.conversations.length,
            cacheHit: true,
            shop,
          });

          return cachedConversations;
        }

        const startTime = Date.now();

        // Get ALL messages to derive conversation data using pagination
        // Query all messages using pagination to ensure complete historical data
        logger.info(
          'Querying ALL chat messages for conversations with pagination'
        );

        const allMessages = await this.executeCompleteQuery<any>(
          (limit, offset) =>
            this.supabaseService.client
              .from('chat_messages')
              .select('id, role, content, timestamp, session_id')
              .order('timestamp', { ascending: true })
              .range(offset, offset + limit - 1),
          {
            queryName: 'getAllMessagesForConversations',
            batchSize: 1000,
          }
        );

        const messagesError = null;

        if (messagesError) {
          logger.error('Error fetching messages:', messagesError);
          throw new AppError('Failed to fetch messages', 500);
        }

        const messages = allMessages || [];

        // Group messages by session_id to build conversations
        const conversationMap = new Map<
          string,
          {
            session_id: string;
            messages: typeof messages;
            first_message?: string;
            last_activity: string;
            user_messages: number;
            ai_messages: number;
          }
        >();

        messages.forEach(message => {
          const sessionId = message.session_id;

          if (!conversationMap.has(sessionId)) {
            conversationMap.set(sessionId, {
              session_id: sessionId,
              messages: [],
              last_activity: message.timestamp,
              user_messages: 0,
              ai_messages: 0,
            });
          }

          const conv = conversationMap.get(sessionId)!;
          conv.messages.push(message);

          // Update last activity to the most recent message
          if (new Date(message.timestamp) > new Date(conv.last_activity)) {
            conv.last_activity = message.timestamp;
          }

          // Set first user message (client = user in our database)
          if (message.role === 'client' && !conv.first_message) {
            conv.first_message = message.content;
          }

          // Count messages by role (client = user, agent = assistant in our database)
          if (message.role === 'client') {
            conv.user_messages++;
          } else if (message.role === 'agent') {
            conv.ai_messages++;
          }
        });

        // Convert to array and sort by last activity
        const allConversations = Array.from(conversationMap.values()).sort(
          (a, b) =>
            new Date(b.last_activity).getTime() -
            new Date(a.last_activity).getTime()
        );

        const total = allConversations.length;
        const totalPages = Math.ceil(total / limitNum);

        // Apply pagination
        const paginatedConversations = allConversations.slice(
          offset,
          offset + limitNum
        );

        // Format the results
        const formattedConversations: ConversationItem[] =
          paginatedConversations.map(conv => ({
            session_id: conv.session_id,
            messages: conv.messages.length,
            first_message: conv.first_message
              ? conv.first_message.length > 100
                ? conv.first_message.substring(0, 100) + '...'
                : conv.first_message
              : 'Sin mensaje inicial',
            last_activity: conv.last_activity,
            user_messages: conv.user_messages,
            ai_messages: conv.ai_messages,
          }));

        const queryDuration = Date.now() - startTime;
        logger.info('Conversation query performance', {
          shop,
          queryDuration,
          limit: limitNum,
          offset,
          total,
          cacheUsed: false,
          queryType: 'optimized',
        });

        const result: ConversationsResponse = {
          conversations: formattedConversations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
          },
        };

        // Cache the results
        await this.cacheService.set(cacheKey, result, {
          ttl: AdminAnalyticsService.CACHE_TTL.CONVERSATIONS,
        });

        return result;
      },
      { shop, queryType: 'optimized' }
    );
  }

  // This fallback method has been removed as we no longer use chat_sessions table
  // All conversation data is now derived from chat_messages table only

  async getChartAnalytics(
    shop: string,
    days: number = 30
  ): Promise<ChartAnalytics> {
    try {
      logger.info('Getting chart analytics for shop:', { shop, days });

      const daysCount = Math.max(1, Math.min(365, days)); // Limit between 1 and 365 days

      // Check cache first
      const cacheKey = `chart-analytics:${shop}:${daysCount}`;
      const cachedAnalytics =
        await this.cacheService.get<ChartAnalytics>(cacheKey);
      if (cachedAnalytics) {
        logger.info('Returning cached chart analytics for:', {
          shop,
          days: daysCount,
        });
        return cachedAnalytics;
      }

      // Set up date range to include the full current day
      const { startDate, endDate } = this.createInclusiveDateRange(daysCount);

      // Get ALL messages then filter in memory to ensure no data loss
      // Query ALL messages using pagination to ensure complete historical data
      logger.info(
        'Querying ALL chat messages for chart analytics with pagination',
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          daysCount,
          note: 'Getting ALL messages first to prevent data loss, then filtering in memory',
        }
      );

      // Get ALL messages without date filters to prevent any potential data loss
      const allMessages = await this.executeCompleteQuery<any>(
        (limit, offset) =>
          this.supabaseService.client
            .from('chat_messages')
            .select('timestamp, session_id')
            .order('timestamp', { ascending: true })
            .range(offset, offset + limit - 1),
        {
          queryName: 'getAllMessagesForChartAnalytics',
          batchSize: 1000,
        }
      );

      // Filter messages in memory to the requested date range
      // This ensures we never lose data due to query limitations
      const messages = allMessages.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= startDate && msgDate <= endDate;
      });

      const messagesError = null;

      logger.info('Filtered messages for chart analytics', {
        totalMessages: allMessages.length,
        filteredMessages: messages.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dataLossCheck:
          allMessages.length > 0 ? 'PASSED' : 'FAILED - No messages found',
      });

      if (messagesError) {
        logger.error('Error fetching messages for chart:', messagesError);
        throw new AppError('Failed to fetch messages for chart analytics', 500);
      }

      const messagesList = messages || [];

      logger.info('Processing messages for chart analytics', {
        totalMessagesAfterFilter: messagesList.length,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        ensureCompleteData: 'Using in-memory filtering to prevent data loss',
      });

      // Group messages by session to find when each conversation started
      const sessionFirstMessages = new Map<string, Date>();
      messagesList.forEach(msg => {
        const sessionId = msg.session_id;
        const timestamp = new Date(msg.timestamp);

        if (
          !sessionFirstMessages.has(sessionId) ||
          timestamp < sessionFirstMessages.get(sessionId)!
        ) {
          sessionFirstMessages.set(sessionId, timestamp);
        }
      });

      // Count conversations by date (using first message timestamp of each session)
      const conversationsByDate = new Map<string, number>();
      sessionFirstMessages.forEach(firstMessageDate => {
        const dateKey = firstMessageDate.toISOString().split('T')[0];
        conversationsByDate.set(
          dateKey,
          (conversationsByDate.get(dateKey) || 0) + 1
        );
      });

      // Initialize daily data map for all days in range (inclusive of today)
      const dailyDataMap = new Map<string, ChartDataPoint>();
      for (let i = 0; i < daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i); // Correctly increment from startDate
        const dateKey = date.toISOString().split('T')[0];
        dailyDataMap.set(dateKey, {
          date: dateKey,
          conversations: conversationsByDate.get(dateKey) || 0,
          sales: 0, // TODO: Integrate with Shopify sales data
          orders_count: 0, // TODO: Integrate with Shopify orders data
        });
      }

      // Convert to array and sort by date
      const chartData = Array.from(dailyDataMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate totals
      const totalConversations = chartData.reduce(
        (sum, day) => sum + day.conversations,
        0
      );
      const totalSales = chartData.reduce((sum, day) => sum + day.sales, 0);
      const totalOrders = chartData.reduce(
        (sum, day) => sum + day.orders_count,
        0
      );

      const result: ChartAnalytics = {
        daily_data: chartData,
        totals: {
          conversations: totalConversations,
          sales: totalSales,
          orders: totalOrders,
          average_order: totalOrders > 0 ? totalSales / totalOrders : 0,
        },
        period_days: daysCount,
      };

      // Cache the results
      await this.cacheService.set(cacheKey, result, {
        ttl: AdminAnalyticsService.CACHE_TTL.CHART_ANALYTICS,
      });

      logger.info('Chart analytics generated successfully', {
        shop,
        totalConversations,
        days: daysCount,
      });

      return result;
    } catch (error) {
      logger.error('Error getting chart analytics:', error);
      throw new AppError('Failed to get chart analytics', 500);
    }
  }

  /**
   * Get conversation details with proper typing and error handling
   */
  async getConversationDetails(sessionId: string): Promise<DatabaseMessage[]> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting conversation details', { sessionId });

        const { data: messages, error } = await this.supabaseService.client
          .from('chat_messages')
          .select('id, role, content, timestamp')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: true });

        if (error) {
          throw new AppError(
            `Failed to fetch conversation details: ${error.message}`,
            500
          );
        }

        if (!messages || messages.length === 0) {
          throw new AppError('Conversation not found', 404);
        }

        const typedMessages: DatabaseMessage[] = messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'client' | 'agent' | 'system',
          content: msg.content || '',
          timestamp: msg.timestamp,
          session_id: sessionId,
        }));

        logger.info('Conversation details retrieved', {
          sessionId,
          messageCount: typedMessages.length,
        });

        return typedMessages;
      },
      {
        queryName: `getConversationDetails-${sessionId}`,
        timeoutMs: 10000,
      }
    );
  }

  /**
   * Get comprehensive analytics dashboard combining all metrics
   */
  async getComprehensiveDashboard(shop: string): Promise<{
    general: GeneralMetrics;
    recommendations: ProductRecommendationMetrics;
    engagement: EngagementMetrics;
    conversion: ConversionData;
    chartAnalytics: ChartAnalytics;
    lastUpdated: string;
  }> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting comprehensive dashboard for shop:', { shop });

        // Check cache first
        const cacheKey = `comprehensive-dashboard:${shop}`;
        const cachedDashboard = await this.cacheService.get<{
          general: GeneralMetrics;
          recommendations: ProductRecommendationMetrics;
          engagement: EngagementMetrics;
          conversion: ConversionData;
          chartAnalytics: ChartAnalytics;
          lastUpdated: string;
        }>(cacheKey);
        if (cachedDashboard) {
          logger.info('Returning cached comprehensive dashboard for:', {
            shop,
          });
          return cachedDashboard;
        }

        // Fetch all analytics in parallel for better performance
        const [
          general,
          recommendations,
          engagement,
          conversion,
          chartAnalytics,
        ] = await Promise.all([
          this.getGeneralMetrics(shop),
          this.getProductRecommendationMetrics(shop),
          this.getEngagementMetrics(shop),
          this.getConversionAnalytics(shop),
          this.getChartAnalytics(shop, 30),
        ]);

        const dashboard = {
          general,
          recommendations,
          engagement,
          conversion,
          chartAnalytics,
          lastUpdated: new Date().toISOString(),
        };

        // Cache the comprehensive dashboard for 10 minutes
        await this.cacheService.set(cacheKey, dashboard, {
          ttl: 600, // 10 minutes
        });

        logger.info('Comprehensive dashboard generated successfully', {
          shop,
          totalConversations: general.totalConversations,
          totalRecommendations: recommendations.totalRecommendationsMade,
          cacheKey,
        });

        return dashboard;
      },
      {
        queryName: `getComprehensiveDashboard-${shop}`,
        timeoutMs: 30000, // 30 seconds for comprehensive data
      }
    );
  }

  /**
   * Get analytics summary for quick overview
   */
  async getAnalyticsSummary(shop: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    uniqueUsers: number;
    recommendationsMade: number;
    averageEngagement: number;
    conversionRate: number;
    topProduct: string | null;
  }> {
    return this.executeWithTimeout(
      async () => {
        logger.info('Getting analytics summary for shop:', { shop });

        // Check cache first
        const cacheKey = `analytics-summary:${shop}`;
        const cachedSummary = await this.cacheService.get<{
          totalConversations: number;
          totalMessages: number;
          uniqueUsers: number;
          recommendationsMade: number;
          averageEngagement: number;
          conversionRate: number;
          topProduct: string | null;
        }>(cacheKey);
        if (cachedSummary) {
          return cachedSummary;
        }

        // Get basic metrics efficiently
        const [general, recommendations, conversion] = await Promise.all([
          this.getGeneralMetrics(shop),
          this.getProductRecommendationMetrics(shop),
          this.getConversionAnalytics(shop),
        ]);

        const summary = {
          totalConversations: general.totalConversations,
          totalMessages: general.totalMessages,
          uniqueUsers: general.uniqueSessionIds,
          recommendationsMade: recommendations.totalRecommendationsMade,
          averageEngagement: general.averageMessagesPerConversation,
          conversionRate: conversion.conversionRate,
          topProduct:
            recommendations.topRecommendedProducts.length > 0
              ? recommendations.topRecommendedProducts[0].productTitle
              : null,
        };

        // Cache summary for 5 minutes
        await this.cacheService.set(cacheKey, summary, { ttl: 300 });

        return summary;
      },
      {
        queryName: `getAnalyticsSummary-${shop}`,
        timeoutMs: 15000,
      }
    );
  }

  /**
   * Verify data completeness for analytics queries
   * This method helps ensure we're not losing any historical data
   */
  async verifyDataCompleteness(shop: string): Promise<{
    totalMessages: number;
    totalConversations: number;
    dateRange: { earliest: string; latest: string };
    potentialDataLoss: boolean;
    verificationDetails: {
      messagesPerDay: Record<string, number>;
      conversationsPerDay: Record<string, number>;
      lastUpdated: string;
    };
  }> {
    try {
      logger.info('Starting data completeness verification for shop:', {
        shop,
      });

      // Get ALL messages using our new complete query method
      const allMessages = await this.executeCompleteQuery<any>(
        (limit, offset) =>
          this.supabaseService.client
            .from('chat_messages')
            .select('timestamp, session_id')
            .order('timestamp', { ascending: true })
            .range(offset, offset + limit - 1),
        {
          queryName: 'verifyDataCompleteness',
          batchSize: 1000,
        }
      );

      const totalMessages = allMessages.length;
      const uniqueSessionIds = new Set(allMessages.map(msg => msg.session_id));
      const totalConversations = uniqueSessionIds.size;

      let earliest = '';
      let latest = '';
      if (allMessages.length > 0) {
        earliest = allMessages[0].timestamp;
        latest = allMessages[allMessages.length - 1].timestamp;
      }

      // Group messages by day
      const messagesPerDay: Record<string, number> = {};
      const conversationsPerDay: Record<string, number> = {};

      allMessages.forEach(msg => {
        const date = new Date(msg.timestamp).toISOString().split('T')[0];

        // Count messages per day
        messagesPerDay[date] = (messagesPerDay[date] || 0) + 1;
      });

      // Count conversations per day (unique sessions that started that day)
      const sessionFirstMessages = new Map<string, string>();
      allMessages.forEach(msg => {
        const sessionId = msg.session_id;
        if (!sessionFirstMessages.has(sessionId)) {
          sessionFirstMessages.set(
            sessionId,
            new Date(msg.timestamp).toISOString().split('T')[0]
          );
        }
      });

      sessionFirstMessages.forEach((date, sessionId) => {
        conversationsPerDay[date] = (conversationsPerDay[date] || 0) + 1;
      });

      // Check for potential data loss indicators
      const potentialDataLoss =
        totalMessages === 0 ||
        (totalMessages > 0 &&
          totalMessages % 1000 === 0 &&
          totalMessages >= 50000);

      const verification = {
        totalMessages,
        totalConversations,
        dateRange: { earliest, latest },
        potentialDataLoss,
        verificationDetails: {
          messagesPerDay,
          conversationsPerDay,
          lastUpdated: new Date().toISOString(),
        },
      };

      logger.info('Data completeness verification completed', {
        shop,
        totalMessages,
        totalConversations,
        dateRange: { earliest, latest },
        potentialDataLoss,
        daysWithData: Object.keys(messagesPerDay).length,
      });

      return verification;
    } catch (error) {
      logger.error('Error verifying data completeness:', error);
      throw new AppError('Failed to verify data completeness', 500);
    }
  }

  /**
   * Compare data consistency across different date ranges
   * This helps identify if different range queries are showing consistent data
   */
  async compareDataConsistency(shop: string): Promise<{
    ranges: Array<{
      days: number;
      totalConversations: number;
      totalMessages: number;
      overlappingDates: string[];
    }>;
    consistencyReport: {
      overallConsistent: boolean;
      inconsistencies: string[];
      recommendations: string[];
    };
  }> {
    try {
      logger.info('Starting data consistency comparison for shop:', { shop });

      const ranges = [3, 7, 10, 30];
      const results = [];
      const inconsistencies: string[] = [];

      for (const days of ranges) {
        const analytics = await this.getChartAnalytics(shop, days);
        const overlappingDates = analytics.daily_data.map(d => d.date);

        results.push({
          days,
          totalConversations: analytics.totals.conversations,
          totalMessages: analytics.daily_data.reduce(
            (sum, d) => sum + d.conversations,
            0
          ),
          overlappingDates,
        });
      }

      // Check for inconsistencies in overlapping dates
      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i];
        const next = results[i + 1];

        // Check for data consistency in overlapping period
        const currentTotal = current.totalConversations;
        const nextTotal = next.totalConversations;

        // If a shorter range has more conversations than expected, flag it
        if (current.days < next.days && currentTotal > nextTotal) {
          inconsistencies.push(
            `${current.days}-day range shows ${currentTotal} conversations vs ${next.days}-day range shows ${nextTotal} - shorter range should never exceed longer range`
          );
        }
      }

      const overallConsistent = inconsistencies.length === 0;
      const recommendations: string[] = [];

      if (!overallConsistent) {
        recommendations.push('Clear analytics cache to ensure fresh data');
        recommendations.push(
          'Verify database query pagination is working correctly'
        );
        recommendations.push(
          'Check for timezone-related date calculation issues'
        );
      } else {
        recommendations.push(
          'Data consistency looks good across all date ranges'
        );
      }

      logger.info('Data consistency comparison completed', {
        shop,
        rangesChecked: ranges.length,
        inconsistencies: inconsistencies.length,
        overallConsistent,
      });

      return {
        ranges: results,
        consistencyReport: {
          overallConsistent,
          inconsistencies,
          recommendations,
        },
      };
    } catch (error) {
      logger.error('Error comparing data consistency:', error);
      throw new AppError('Failed to compare data consistency', 500);
    }
  }

  /**
   * Invalidate all analytics caches for a shop
   */
  async invalidateAnalyticsCache(shop: string): Promise<void> {
    const cacheKeys = [
      `shop-stats:${shop}`,
      `general-metrics:${shop}`,
      `recommendation-metrics:${shop}`,
      `engagement-metrics:${shop}`,
      `chart-analytics:${shop}:30`,
      `comprehensive-dashboard:${shop}`,
      `analytics-summary:${shop}`,
      `conversations:${shop}:*`, // Pattern for conversation caches
    ];

    await Promise.all(
      cacheKeys.map(async key => {
        if (key.includes('*')) {
          // Handle pattern-based cache clearing
          await this.cacheService.clear(key);
        } else {
          await this.cacheService.del(key);
        }
      })
    );

    logger.info('Analytics cache invalidated for shop:', { shop });
  }

  private groupByDay(
    data: Array<{ created_at: string }>,
    daysBack: number = 30
  ): Array<{ date: string; count: number }> {
    // Group actual data by date
    const grouped = data.reduce(
      (acc, item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Create complete date range including today
    const { startDate } = this.createInclusiveDateRange(daysBack);
    const result: Array<{ date: string; count: number }> = [];

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];

      result.push({
        date: dateKey,
        count: grouped[dateKey] || 0,
      });
    }

    return result.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
}
