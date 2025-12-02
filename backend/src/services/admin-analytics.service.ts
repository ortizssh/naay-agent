import { SupabaseService } from './supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

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

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  async getShopStats(shop: string): Promise<AnalyticsData> {
    try {
      logger.info('Getting shop stats for:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Get total products
      const { count: productCount } = await this.supabaseService.client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', store.id);

      // Get total conversations
      const { count: conversationCount } = await this.supabaseService.client
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', store.id);

      // Get conversation data by day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: conversationsByDay } = await this.supabaseService.client
        .from('conversations')
        .select('created_at')
        .eq('shop_id', store.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Process conversation data by day
      const conversationsByDayProcessed = this.groupByDay(
        conversationsByDay || []
      );

      return {
        totalProducts: productCount || 0,
        totalConversations: conversationCount || 0,
        totalMessages: 0, // TODO: Implement when messages table exists
        topProducts: [], // TODO: Implement based on recommendation data
        conversationsByDay: conversationsByDayProcessed,
        messagesByDay: [], // TODO: Implement when messages table exists
      };
    } catch (error) {
      logger.error('Error getting shop stats:', error);
      throw new AppError('Failed to get shop statistics', 500);
    }
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

      // TODO: Implement when recommendation tracking is added
      return {
        success: true,
        data: [],
        message: 'Recommendation tracking not yet implemented',
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
    try {
      logger.info('Getting conversations for shop:', { shop, limit, page });

      const pageNum = Math.max(1, page);
      const limitNum = Math.max(1, Math.min(100, limit)); // Limit between 1 and 100
      const offset = (pageNum - 1) * limitNum;

      // Get all messages and group by session_id
      const { data: allMessages, error: messagesError } =
        await this.supabaseService.client
          .from('chat_messages')
          .select('session_id, content, timestamp, role')
          .not('session_id', 'is', null)
          .order('timestamp', { ascending: false });

      if (messagesError) {
        logger.error(
          'Error fetching chat messages for conversations:',
          messagesError
        );
        throw new AppError('Failed to fetch chat messages', 500);
      }

      if (!allMessages || allMessages.length === 0) {
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

      // Group messages by session_id
      const sessionGroups: { [key: string]: any[] } = {};
      allMessages.forEach(message => {
        if (!sessionGroups[message.session_id]) {
          sessionGroups[message.session_id] = [];
        }
        sessionGroups[message.session_id].push(message);
      });

      // Transform to conversations format
      const allConversations: ConversationItem[] = Object.entries(
        sessionGroups
      ).map(([sessionId, messages]) => {
        const userMessages = messages.filter(m => m.role === 'user');
        const aiMessages = messages.filter(m => m.role === 'assistant');

        const sortedMessages = messages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const firstMessage =
          sortedMessages[0]?.content || 'Sin mensaje inicial';
        const lastActivity =
          sortedMessages[sortedMessages.length - 1]?.timestamp || '';

        return {
          session_id: sessionId,
          messages: messages.length,
          first_message:
            firstMessage.substring(0, 100) +
            (firstMessage.length > 100 ? '...' : ''),
          last_activity: lastActivity,
          user_messages: userMessages.length,
          ai_messages: aiMessages.length,
        };
      });

      // Sort by last activity (most recent first)
      allConversations.sort(
        (a, b) =>
          new Date(b.last_activity).getTime() -
          new Date(a.last_activity).getTime()
      );

      const total = allConversations.length;
      const totalPages = Math.ceil(total / limitNum);

      // Apply pagination
      const conversations = allConversations.slice(offset, offset + limitNum);

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
      logger.error('Error getting conversations:', error);
      throw new AppError('Failed to get conversations', 500);
    }
  }

  async getChartAnalytics(
    shop: string,
    days: number = 30
  ): Promise<ChartAnalytics> {
    try {
      logger.info('Getting chart analytics for shop:', { shop, days });

      const daysCount = Math.max(1, Math.min(365, days)); // Limit between 1 and 365 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Initialize daily data map
      const dailyDataMap = new Map<string, ChartDataPoint>();
      for (let i = 0; i < daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        dailyDataMap.set(dateKey, {
          date: dateKey,
          conversations: 0,
          sales: 0,
          orders_count: 0,
        });
      }

      // Get conversations data from chat_messages
      try {
        const { data: chatMessages, error: chatError } =
          await this.supabaseService.client
            .from('chat_messages')
            .select('session_id, timestamp')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .not('session_id', 'is', null);

        if (!chatError && chatMessages) {
          // Group by session and date to count unique conversations per day
          const sessionsByDate = new Map<string, Set<string>>();

          chatMessages.forEach((msg: any) => {
            const dateKey = new Date(msg.timestamp).toISOString().split('T')[0];
            if (!sessionsByDate.has(dateKey)) {
              sessionsByDate.set(dateKey, new Set());
            }
            sessionsByDate.get(dateKey)!.add(msg.session_id);
          });

          // Update conversation counts
          sessionsByDate.forEach((sessions, dateKey) => {
            if (dailyDataMap.has(dateKey)) {
              dailyDataMap.get(dateKey)!.conversations = sessions.size;
            }
          });
        }
      } catch (error) {
        logger.error('Error fetching conversation data for chart:', error);
      }

      // Note: Sales data would require Shopify integration
      // For now, we'll return conversation data only

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

      return {
        daily_data: chartData,
        totals: {
          conversations: totalConversations,
          sales: totalSales,
          orders: totalOrders,
          average_order: totalOrders > 0 ? totalSales / totalOrders : 0,
        },
        period_days: daysCount,
      };
    } catch (error) {
      logger.error('Error getting chart analytics:', error);
      throw new AppError('Failed to get chart analytics', 500);
    }
  }

  async getConversationDetails(sessionId: string) {
    try {
      logger.info('Getting conversation details', { sessionId });

      const { data: messages, error } = await (
        this.supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('id, role, content, timestamp')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) {
        logger.error('Error fetching conversation details:', error);
        throw new AppError('Failed to fetch conversation details', 500);
      }

      if (!messages || messages.length === 0) {
        throw new AppError('Conversation not found', 404);
      }

      return messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
    } catch (error) {
      logger.error('Error getting conversation details:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get conversation details', 500);
    }
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
