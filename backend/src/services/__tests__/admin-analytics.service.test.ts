import { AdminAnalyticsService } from '../admin-analytics.service';
import { SupabaseService } from '../supabase.service';
import { AppError } from '@/types';

// Mock SupabaseService
jest.mock('../supabase.service');
const MockedSupabaseService = SupabaseService as jest.MockedClass<typeof SupabaseService>;

describe('AdminAnalyticsService', () => {
  let analyticsService: AdminAnalyticsService;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AdminAnalyticsService();
    mockSupabaseService = new MockedSupabaseService() as jest.Mocked<SupabaseService>;
    (analyticsService as any).supabaseService = mockSupabaseService;
  });

  describe('getShopStats', () => {
    const mockShop = 'test-shop.myshopify.com';
    const mockStore = {
      id: 'store-123',
      domain: mockShop,
      access_token: 'token',
      settings: {},
    };

    beforeEach(() => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
      mockSupabaseService.client = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
      } as any;
    });

    it('should return shop statistics successfully', async () => {
      // Mock product count
      mockSupabaseService.client.from('products').select('*', { count: 'exact', head: true })
        .eq('shop_id', mockStore.id).mockResolvedValue({ count: 50 });

      // Mock conversation count
      mockSupabaseService.client.from('conversations').select('*', { count: 'exact', head: true })
        .eq('shop_id', mockStore.id).mockResolvedValue({ count: 25 });

      // Mock conversation data by day
      const mockConversationData = [
        { created_at: '2024-01-01T00:00:00.000Z' },
        { created_at: '2024-01-01T12:00:00.000Z' },
        { created_at: '2024-01-02T00:00:00.000Z' },
      ];
      mockSupabaseService.client.from('conversations').select('created_at')
        .eq('shop_id', mockStore.id)
        .gte('created_at', expect.any(String))
        .mockResolvedValue({ data: mockConversationData });

      const result = await analyticsService.getShopStats(mockShop);

      expect(result).toEqual({
        totalProducts: 50,
        totalConversations: 25,
        totalMessages: 0,
        topProducts: [],
        conversationsByDay: [
          { date: '2024-01-01', count: 2 },
          { date: '2024-01-02', count: 1 },
        ],
        messagesByDay: [],
      });
    });

    it('should throw AppError when store not found', async () => {
      mockSupabaseService.getStore.mockResolvedValue(null);

      await expect(analyticsService.getShopStats(mockShop)).rejects.toThrow(
        new AppError('Store not found', 404)
      );
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseService.getStore.mockRejectedValue(dbError);

      await expect(analyticsService.getShopStats(mockShop)).rejects.toThrow(
        new AppError('Failed to get shop statistics', 500)
      );
    });
  });

  describe('getConversionAnalytics', () => {
    const mockShop = 'test-shop.myshopify.com';
    const mockStore = {
      id: 'store-123',
      domain: mockShop,
      access_token: 'token',
      settings: {},
    };

    beforeEach(() => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
      mockSupabaseService.client = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      } as any;
    });

    it('should return conversion analytics successfully', async () => {
      mockSupabaseService.client.from('conversations').select('*', { count: 'exact', head: true })
        .eq('shop_id', mockStore.id).mockResolvedValue({ count: 100 });

      const result = await analyticsService.getConversionAnalytics(mockShop);

      expect(result).toEqual({
        totalConversations: 100,
        conversationsWithRecommendations: 0,
        conversionRate: 0,
        recommendationsByProduct: [],
      });
    });

    it('should calculate conversion rate correctly', async () => {
      mockSupabaseService.client.from('conversations').select('*', { count: 'exact', head: true })
        .eq('shop_id', mockStore.id).mockResolvedValue({ count: 0 });

      const result = await analyticsService.getConversionAnalytics(mockShop);

      expect(result.conversionRate).toBe(0);
    });
  });

  describe('getTopRecommendedProducts', () => {
    const mockShop = 'test-shop.myshopify.com';
    const mockStore = {
      id: 'store-123',
      domain: mockShop,
      access_token: 'token',
      settings: {},
    };

    beforeEach(() => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
    });

    it('should return placeholder response for unimplemented feature', async () => {
      const result = await analyticsService.getTopRecommendedProducts(mockShop);

      expect(result).toEqual({
        success: true,
        data: [],
        message: 'Recommendation tracking not yet implemented',
      });
    });

    it('should respect limit parameter', async () => {
      const result = await analyticsService.getTopRecommendedProducts(mockShop, 5);

      expect(result.data).toEqual([]);
    });
  });
});