import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import { logger } from '@/utils/logger';
import { AppError, ShopifyStore } from '@/types';
import { PerformanceMonitor, measurePerformance } from '@/utils/performance-monitor';

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
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  session_id?: string;
}

export interface DatabaseSession {
  id: string;
  shop_domain: string;
  status: string;
  started_at: string;
  last_activity: string;
}

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
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new AppError(
            `Query timeout: ${queryName} exceeded ${timeoutMs}ms`,
            408
          )
        );
      }, timeoutMs);

      // Store timeout ID for potential cleanup
      (timeoutPromise as any).timeoutId = timeoutId;
    });

    try {
      const startTime = Date.now();
      const result = await Promise.race([queryFunction(), timeoutPromise]);
      const duration = Date.now() - startTime;

      // Clear timeout if query completes
      if ((timeoutPromise as any).timeoutId) {
        clearTimeout((timeoutPromise as any).timeoutId);
      }

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
      if ((timeoutPromise as any).timeoutId) {
        clearTimeout((timeoutPromise as any).timeoutId);
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

        // Execute parallel queries for better performance
        const [productResult, conversationResult] = await Promise.all([
          this.supabaseService.client
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', shop),
          this.supabaseService.client
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('shop_domain', shop)
            .eq('status', 'active'),
        ]);

        if (productResult.error) {
          throw new AppError(
            `Failed to count products: ${productResult.error.message}`,
            500
          );
        }

        if (conversationResult.error) {
          throw new AppError(
            `Failed to count conversations: ${conversationResult.error.message}`,
            500
          );
        }

        const productCount = productResult.count || 0;
        const conversationCount = conversationResult.count || 0;

        // Get conversation data by day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: conversationsByDay, error: conversationsError } =
          await this.supabaseService.client
            .from('chat_sessions')
            .select('started_at')
            .eq('shop_domain', shop)
            .eq('status', 'active')
            .gte('started_at', thirtyDaysAgo.toISOString());

        if (conversationsError) {
          throw new AppError(
            `Failed to fetch conversation history: ${conversationsError.message}`,
            500
          );
        }

        // Process conversation data by day
        const conversationsByDayProcessed = this.groupByDay(
          (conversationsByDay || []).map(session => ({
            created_at: session.started_at,
          }))
        );

        const stats: AnalyticsData = {
          totalProducts: productCount,
          totalConversations: conversationCount,
          totalMessages: 0, // TODO: Implement when messages table exists
          topProducts: [], // TODO: Implement based on recommendation data
          conversationsByDay: conversationsByDayProcessed,
          messagesByDay: [], // TODO: Implement when messages table exists
        };

        // Cache the results
        await this.cacheService.set(cacheKey, stats, {
          ttl: AdminAnalyticsService.CACHE_TTL.SHOP_STATS,
        });

        logger.info('Shop stats generated successfully', {
          shop,
          totalProducts: productCount,
          totalConversations: conversationCount,
        });

        return stats;
      },
      {
        queryName: `getShopStats-${shop}`,
        timeoutMs: 15000, // Reduced timeout for stats
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

      // Get total conversations
      const { count: totalConversations } = await this.supabaseService.client
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', store.id);

      // TODO: Implement recommendation tracking
      const conversationsWithRecommendations = 0;
      const conversionRate = totalConversations
        ? (conversationsWithRecommendations / totalConversations) * 100
        : 0;

      return {
        totalConversations: totalConversations || 0,
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
            shop
          });
          
          return cachedConversations;
        }

      // First, get the total count using optimized fast count function
      let totalCount = 0;
      try {
        const { data: countData, error: fastCountError } =
          await this.supabaseService.client.rpc('get_conversation_count_fast', {
            shop_domain_param: shop,
          });
        
        if (fastCountError) {
          logger.warn('Fast count query failed, using fallback:', fastCountError);
          // Fallback to exact count
          const { count, error: countError } =
            await this.supabaseService.client
              .from('chat_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('shop_domain', shop)
              .eq('status', 'active');
          
          if (countError) {
            logger.error('Error counting conversations:', countError);
            throw new AppError('Failed to count conversations', 500);
          }
          totalCount = count || 0;
        } else {
          totalCount = countData || 0;
        }
      } catch (error) {
        logger.error('Error in count query:', error);
        throw new AppError('Failed to count conversations', 500);
      }

      const total = totalCount;
      const totalPages = Math.ceil(total / limitNum);

      if (total === 0) {
        return {
          conversations: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // Use the fastest available query method (tries fast method first, then optimized)
      const startTime = Date.now();
      let { data: conversations, error: conversationsError } =
        await this.supabaseService.client.rpc('get_conversations_fast', {
          shop_domain_param: shop,
          limit_param: limitNum,
          offset_param: offset,
        });

      // Fallback to optimized version if fast method fails
      if (conversationsError) {
        logger.warn('Fast conversation query failed, trying optimized version:', conversationsError);
        ({ data: conversations, error: conversationsError } =
          await this.supabaseService.client.rpc('get_conversations_optimized', {
            shop_domain_param: shop,
            limit_param: limitNum,
            offset_param: offset,
          }));
      }
      
        const queryDuration = Date.now() - startTime;
        const queryType = conversationsError ? 'optimized' : 'fast';
        
        logger.info('Conversation query performance', {
          shop,
          queryDuration,
          limit: limitNum,
          offset,
          cacheUsed: false,
          queryType
        });

        if (conversationsError) {
          logger.error(
            'Error fetching optimized conversations:',
            conversationsError
          );

          // Fallback to manual query if stored procedure doesn't exist
          return await this.getConversationsFallback(
            shop,
            limitNum,
            pageNum,
            offset,
            total,
            totalPages
          );
        }

        // Format the results
        const formattedConversations: ConversationItem[] = (
          conversations || []
        ).map((conv: any) => ({
          session_id: conv.session_id,
          messages: conv.total_messages || 0,
          first_message: conv.first_message
            ? conv.first_message.substring(0, 100) +
              (conv.first_message.length > 100 ? '...' : '')
            : 'Sin mensaje inicial',
          last_activity: conv.last_activity || '',
          user_messages: conv.user_messages || 0,
          ai_messages: conv.ai_messages || 0,
        }));

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
      { shop, queryType: 'fast' }
    );
  }

  // Optimized fallback method using single aggregation query
  private async getConversationsFallback(
    shop: string,
    limitNum: number,
    pageNum: number,
    offset: number,
    total: number,
    totalPages: number
  ): Promise<ConversationsResponse> {
    logger.info('Using optimized fallback conversation query method');

    const startTime = Date.now();
    
    try {
      // Single optimized query with aggregation to avoid N+1 problem
      const { data: conversationData, error: queryError } =
        await this.supabaseService.client
          .from('chat_sessions')
          .select(`
            id,
            last_activity,
            chat_messages(
              id,
              role,
              content,
              timestamp
            )
          `)
          .eq('shop_domain', shop)
          .eq('status', 'active')
          .order('last_activity', { ascending: false })
          .range(offset, offset + limitNum - 1);

      if (queryError) {
        logger.error('Error in optimized fallback query:', queryError);
        throw new AppError('Failed to fetch conversations with fallback method', 500);
      }

      const queryDuration = Date.now() - startTime;
      logger.info('Fallback query performance', {
        shop,
        queryDuration,
        recordsProcessed: conversationData?.length || 0
      });

      if (!conversationData || conversationData.length === 0) {
        return {
          conversations: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
          },
        };
      }

      // Process conversation data efficiently
      const conversations: ConversationItem[] = conversationData.map((session: any) => {
        const messages = session.chat_messages || [];
        const userMessages = messages.filter((m: any) => m.role === 'user').length;
        const aiMessages = messages.filter((m: any) => m.role === 'assistant').length;
        
        // Get first user message for preview
        const firstUserMessage = messages
          .filter((m: any) => m.role === 'user')
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
        
        const firstMessage = firstUserMessage?.content || 'Sin mensaje inicial';

        return {
          session_id: session.id,
          messages: messages.length,
          first_message: firstMessage.length > 100 
            ? firstMessage.substring(0, 100) + '...' 
            : firstMessage,
          last_activity: session.last_activity || '',
          user_messages: userMessages,
          ai_messages: aiMessages,
        };
      });

      return {
        conversations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      };
    } catch (error) {
      const queryDuration = Date.now() - startTime;
      logger.error('Fallback query failed', {
        shop,
        queryDuration,
        error: error.message
      });
      throw error;
    }
  }

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

      // Use optimized query to get conversation counts by date
      const { data: conversationData, error: conversationError } =
        await this.supabaseService.client.rpc('get_daily_conversation_stats', {
          shop_domain_param: shop,
          start_date_param: startDate.toISOString().split('T')[0],
          end_date_param: endDate.toISOString().split('T')[0],
        });

      let dailyDataMap = new Map<string, ChartDataPoint>();

      if (conversationError) {
        logger.warn(
          'Stored procedure not available, using fallback query:',
          conversationError
        );

        // Fallback: Use manual aggregation query
        const { data: chatSessions, error: fallbackError } =
          await this.supabaseService.client
            .from('chat_sessions')
            .select('started_at')
            .eq('shop_domain', shop)
            .gte('started_at', startDate.toISOString())
            .lte('started_at', endDate.toISOString());

        if (fallbackError) {
          logger.error('Error fetching session data for chart:', fallbackError);
        } else if (chatSessions) {
          // Process session data by date
          const conversationsByDate = new Map<string, number>();
          chatSessions.forEach((session: any) => {
            const dateKey = new Date(session.started_at)
              .toISOString()
              .split('T')[0];
            conversationsByDate.set(
              dateKey,
              (conversationsByDate.get(dateKey) || 0) + 1
            );
          });

          // Initialize daily data map
          for (let i = 0; i < daysCount; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split('T')[0];
            dailyDataMap.set(dateKey, {
              date: dateKey,
              conversations: conversationsByDate.get(dateKey) || 0,
              sales: 0,
              orders_count: 0,
            });
          }
        }
      } else if (conversationData) {
        // Use data from stored procedure
        conversationData.forEach((row: any) => {
          dailyDataMap.set(row.date, {
            date: row.date,
            conversations: row.conversations || 0,
            sales: row.sales || 0,
            orders_count: row.orders_count || 0,
          });
        });

        // Fill missing dates with zeros
        for (let i = 0; i < daysCount; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateKey = date.toISOString().split('T')[0];
          if (!dailyDataMap.has(dateKey)) {
            dailyDataMap.set(dateKey, {
              date: dateKey,
              conversations: 0,
              sales: 0,
              orders_count: 0,
            });
          }
        }
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
          role: msg.role as 'user' | 'assistant' | 'system',
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
