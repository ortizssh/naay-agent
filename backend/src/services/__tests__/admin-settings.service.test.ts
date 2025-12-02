import { AdminSettingsService, ShopSettings } from '../admin-settings.service';
import { SupabaseService } from '../supabase.service';
import { AppError } from '@/types';

// Mock SupabaseService
jest.mock('../supabase.service');
const MockedSupabaseService = SupabaseService as jest.MockedClass<
  typeof SupabaseService
>;

describe('AdminSettingsService', () => {
  let settingsService: AdminSettingsService;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService = new AdminSettingsService();
    mockSupabaseService =
      new MockedSupabaseService() as jest.Mocked<SupabaseService>;
    (settingsService as any).supabaseService = mockSupabaseService;
  });

  describe('getShopSettings', () => {
    const mockShop = 'test-shop.myshopify.com';

    it('should return default settings when store has no settings', async () => {
      const mockStore = {
        id: 'store-123',
        domain: mockShop,
        access_token: 'token',
        settings: {},
      };

      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);

      const result = await settingsService.getShopSettings(mockShop);

      expect(result).toEqual({
        widget_enabled: true,
        widget_position: 'bottom-right',
        widget_color: '#a59457',
        widget_greeting: '¿Necesitas ayuda para tu compra? ¡Habla aquí!',
        widget_placeholder: 'Pregúntanos sobre tu compra...',
        auto_sync_enabled: true,
        sync_frequency: 24,
        ai_model: 'gpt-4',
        language: 'es',
      });
    });

    it('should merge custom settings with defaults', async () => {
      const customSettings = {
        widget_enabled: false,
        widget_color: '#ff0000',
        language: 'en',
      };

      const mockStore = {
        id: 'store-123',
        domain: mockShop,
        access_token: 'token',
        settings: customSettings,
      };

      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);

      const result = await settingsService.getShopSettings(mockShop);

      expect(result.widget_enabled).toBe(false);
      expect(result.widget_color).toBe('#ff0000');
      expect(result.language).toBe('en');
      expect(result.widget_position).toBe('bottom-right'); // default value
    });

    it('should throw AppError when store not found', async () => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(null);

      await expect(settingsService.getShopSettings(mockShop)).rejects.toThrow(
        new AppError('Store not found', 404)
      );
    });
  });

  describe('updateShopSettings', () => {
    const mockShop = 'test-shop.myshopify.com';
    const mockStore = {
      id: 'store-123',
      domain: mockShop,
      access_token: 'token',
      settings: {
        widget_enabled: true,
        widget_color: '#a59457',
      },
    };

    beforeEach(() => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
      mockSupabaseService.client = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    it('should update settings successfully', async () => {
      const newSettings: Partial<ShopSettings> = {
        widget_enabled: false,
        widget_color: '#00ff00',
      };

      const result = await settingsService.updateShopSettings(
        mockShop,
        newSettings
      );

      expect(result.widget_enabled).toBe(false);
      expect(result.widget_color).toBe('#00ff00');
      expect(result).toHaveProperty('updated_at');
    });

    it('should validate widget position', async () => {
      const invalidSettings: Partial<ShopSettings> = {
        widget_position: 'invalid-position' as any,
      };

      await expect(
        settingsService.updateShopSettings(mockShop, invalidSettings)
      ).rejects.toThrow(new AppError('Invalid widget position', 400));
    });

    it('should validate widget color format', async () => {
      const invalidSettings: Partial<ShopSettings> = {
        widget_color: 'not-a-hex-color',
      };

      await expect(
        settingsService.updateShopSettings(mockShop, invalidSettings)
      ).rejects.toThrow(
        new AppError('Invalid widget color format (use hex color)', 400)
      );
    });

    it('should validate sync frequency range', async () => {
      const invalidSettings: Partial<ShopSettings> = {
        sync_frequency: 200, // out of range
      };

      await expect(
        settingsService.updateShopSettings(mockShop, invalidSettings)
      ).rejects.toThrow(
        new AppError('Sync frequency must be between 1 and 168 hours', 400)
      );
    });

    it('should validate language support', async () => {
      const invalidSettings: Partial<ShopSettings> = {
        language: 'unsupported',
      };

      await expect(
        settingsService.updateShopSettings(mockShop, invalidSettings)
      ).rejects.toThrow(new AppError('Unsupported language', 400));
    });

    it('should validate AI model', async () => {
      const invalidSettings: Partial<ShopSettings> = {
        ai_model: 'unsupported-model',
      };

      await expect(
        settingsService.updateShopSettings(mockShop, invalidSettings)
      ).rejects.toThrow(new AppError('Unsupported AI model', 400));
    });

    it('should handle database errors', async () => {
      mockSupabaseService.client
        .from()
        .update()
        .eq()
        .mockResolvedValue({
          error: new Error('Database update failed'),
        });

      const newSettings: Partial<ShopSettings> = {
        widget_enabled: false,
      };

      await expect(
        settingsService.updateShopSettings(mockShop, newSettings)
      ).rejects.toThrow(new AppError('Failed to update shop settings', 500));
    });
  });

  describe('resetShopSettings', () => {
    const mockShop = 'test-shop.myshopify.com';
    const mockStore = {
      id: 'store-123',
      domain: mockShop,
      access_token: 'token',
      settings: { some: 'custom settings' },
    };

    beforeEach(() => {
      mockSupabaseService.getStore = jest.fn().mockResolvedValue(mockStore);
      mockSupabaseService.client = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    it('should reset settings to defaults', async () => {
      const result = await settingsService.resetShopSettings(mockShop);

      expect(result.widget_enabled).toBe(true);
      expect(result.widget_position).toBe('bottom-right');
      expect(result.widget_color).toBe('#a59457');
      expect(result.language).toBe('es');
      expect(result).toHaveProperty('updated_at');
    });
  });
});
