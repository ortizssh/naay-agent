import { SupabaseService } from './supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

export interface ShopSettings {
  widget_enabled?: boolean;
  widget_position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  widget_color?: string;
  widget_greeting?: string;
  widget_placeholder?: string;
  auto_sync_enabled?: boolean;
  sync_frequency?: number; // in hours
  ai_model?: string;
  language?: string;
  [key: string]: unknown;
}

export class AdminSettingsService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  async getShopSettings(shop: string): Promise<ShopSettings> {
    try {
      logger.info('Getting settings for shop:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const settings = store.settings as ShopSettings || {};

      // Return settings with defaults
      return {
        widget_enabled: true,
        widget_position: 'bottom-right',
        widget_color: '#a59457',
        widget_greeting: '¿Necesitas ayuda para tu compra? ¡Habla aquí!',
        widget_placeholder: 'Pregúntanos sobre tu compra...',
        auto_sync_enabled: true,
        sync_frequency: 24,
        ai_model: 'gpt-4',
        language: 'es',
        ...settings,
      };
    } catch (error) {
      logger.error('Error getting shop settings:', error);
      throw new AppError('Failed to get shop settings', 500);
    }
  }

  async updateShopSettings(shop: string, newSettings: Partial<ShopSettings>): Promise<ShopSettings> {
    try {
      logger.info('Updating settings for shop:', shop, { newSettings });

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Validate settings
      this.validateSettings(newSettings);

      // Get current settings
      const currentSettings = store.settings as ShopSettings || {};

      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        updated_at: new Date().toISOString(),
      };

      // Update in database
      const { error } = await this.supabaseService.client
        .from('shops')
        .update({ 
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', store.id);

      if (error) {
        logger.error('Database error updating shop settings:', error);
        throw new AppError('Failed to update shop settings', 500);
      }

      logger.info('Shop settings updated successfully for:', shop);

      return updatedSettings;
    } catch (error) {
      logger.error('Error updating shop settings:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update shop settings', 500);
    }
  }

  async resetShopSettings(shop: string): Promise<ShopSettings> {
    try {
      logger.info('Resetting settings for shop:', shop);

      const defaultSettings: ShopSettings = {
        widget_enabled: true,
        widget_position: 'bottom-right',
        widget_color: '#a59457',
        widget_greeting: '¿Necesitas ayuda para tu compra? ¡Habla aquí!',
        widget_placeholder: 'Pregúntanos sobre tu compra...',
        auto_sync_enabled: true,
        sync_frequency: 24,
        ai_model: 'gpt-4',
        language: 'es',
        updated_at: new Date().toISOString(),
      };

      return await this.updateShopSettings(shop, defaultSettings);
    } catch (error) {
      logger.error('Error resetting shop settings:', error);
      throw new AppError('Failed to reset shop settings', 500);
    }
  }

  private validateSettings(settings: Partial<ShopSettings>): void {
    // Validate widget position
    if (settings.widget_position && !['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(settings.widget_position)) {
      throw new AppError('Invalid widget position', 400);
    }

    // Validate widget color (basic hex color validation)
    if (settings.widget_color && !/^#[0-9A-Fa-f]{6}$/.test(settings.widget_color)) {
      throw new AppError('Invalid widget color format (use hex color)', 400);
    }

    // Validate sync frequency
    if (settings.sync_frequency && (settings.sync_frequency < 1 || settings.sync_frequency > 168)) {
      throw new AppError('Sync frequency must be between 1 and 168 hours', 400);
    }

    // Validate language
    if (settings.language && !['es', 'en', 'fr', 'pt'].includes(settings.language)) {
      throw new AppError('Unsupported language', 400);
    }

    // Validate AI model
    if (settings.ai_model && !['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'].includes(settings.ai_model)) {
      throw new AppError('Unsupported AI model', 400);
    }
  }
}