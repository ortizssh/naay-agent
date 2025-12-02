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
      const conversationsByDayProcessed = this.groupByDay(conversationsByDay || []);

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
      const conversionRate = totalConversations ? (conversationsWithRecommendations / totalConversations) * 100 : 0;

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
        message: 'Recommendation tracking not yet implemented'
      };
    } catch (error) {
      logger.error('Error getting top recommended products:', error);
      throw new AppError('Failed to get top recommended products', 500);
    }
  }

  private groupByDay(data: Array<{ created_at: string }>): Array<{ date: string; count: number }> {
    const grouped = data.reduce((acc, item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }
}