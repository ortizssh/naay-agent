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
        // Query all messages since we don't filter by shop_domain
        logger.info('Querying all chat messages from database');

        const { data: conversationData, error: conversationError } =
          await this.supabaseService.client
            .from('chat_messages')
            .select('id, role, content, timestamp, session_id')
            .order('timestamp', { ascending: true });

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

        // Get conversation data by day (last 30 days) from first message of each session
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

        // Filter conversations from last 30 days and group by day
        const recentSessions = Array.from(sessionFirstMessages.entries())
          .filter(([_, timestamp]) => timestamp >= thirtyDaysAgo)
          .map(([sessionId, timestamp]) => ({
            created_at: timestamp.toISOString(),
          }));

        const conversationsByDayProcessed = this.groupByDay(recentSessions);

        // Process messages by day for the chart
        const recentMessages = messages
          .filter(msg => new Date(msg.timestamp) >= thirtyDaysAgo)
          .map(msg => ({
            created_at: msg.timestamp,
          }));

        const messagesByDayProcessed = this.groupByDay(recentMessages);

        const stats: AnalyticsData = {
          totalProducts: productCount || 0,
          totalConversations: conversationCount,
          totalMessages: totalMessages,
          topProducts: [], // TODO: Implement based on recommendation data
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
      // Query all messages since we don't filter by shop_domain
      logger.info('Querying all chat messages for conversion analytics');

      const { data: messages, error } = await this.supabaseService.client
        .from('chat_messages')
        .select('id, role, content, timestamp, session_id')
        .order('timestamp', { ascending: true });

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

      // TODO: Implement recommendation tracking
      const conversationsWithRecommendations = 0;
      const conversionRate = totalConversations
        ? (conversationsWithRecommendations / totalConversations) * 100
        : 0;

      return {
        totalConversations,
        conversationsWithRecommendations,
        conversionRate,
        recommendationsByProduct: [],
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

        // Get all messages to derive conversation data
        // Query all messages since we don't filter by shop_domain
        logger.info('Querying all chat messages for conversations');

        const { data: allMessages, error: messagesError } =
          await this.supabaseService.client
            .from('chat_messages')
            .select('id, role, content, timestamp, session_id')
            .order('timestamp', { ascending: true });

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

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Get all messages within the date range
      // Query all messages since we don't filter by shop_domain
      logger.info('Querying all chat messages for chart analytics');

      const { data: messages, error: messagesError } =
        await this.supabaseService.client
          .from('chat_messages')
          .select('id, role, content, timestamp, session_id')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: true });

      if (messagesError) {
        logger.error('Error fetching messages for chart:', messagesError);
        throw new AppError('Failed to fetch messages for chart analytics', 500);
      }

      const messagesList = messages || [];

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

      // Initialize daily data map for all days in range
      const dailyDataMap = new Map<string, ChartDataPoint>();
      for (let i = 0; i < daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
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

  private groupByDay(
    data: Array<{ created_at: string }>
  ): Array<{ date: string; count: number }> {
    const grouped = data.reduce(
      (acc, item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }
}
