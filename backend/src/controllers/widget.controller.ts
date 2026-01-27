import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { validateAuth } from '@/middleware/shopify-auth.middleware';

const router = Router();
const supabaseService = new SupabaseService();

// Get widget status for a shop
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop parameter is required', 400);
      }

      logger.info(`Getting widget status for shop: ${shop}`);

      // Get store from database
      const store = await supabaseService.getStore(shop);

      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Widget is enabled by default, or check if we have a specific setting
      const widgetEnabled = store.widget_enabled ?? true;

      res.json({
        success: true,
        data: {
          enabled: widgetEnabled,
          shop: shop,
          last_updated: store.updated_at,
        },
      });
    } catch (error) {
      logger.error('Error getting widget status:', error);
      next(error);
    }
  }
);

// Toggle widget status
router.post(
  '/toggle',
  validateAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { enabled, shop } = req.body;
      const authenticatedShop = (req as any).shop;

      // Ensure the shop matches the authenticated shop
      if (shop !== authenticatedShop) {
        throw new AppError('Shop mismatch', 403);
      }

      if (typeof enabled !== 'boolean') {
        throw new AppError('Enabled parameter must be a boolean', 400);
      }

      logger.info(
        `Toggling widget for shop ${shop}: ${enabled ? 'enabling' : 'disabling'}`
      );

      // Update store widget setting
      const updatedStore = await supabaseService.updateStoreWidget(
        shop,
        enabled
      );

      if (!updatedStore) {
        throw new AppError('Failed to update widget setting', 500);
      }

      logger.info(
        `Widget ${enabled ? 'enabled' : 'disabled'} for shop: ${shop}`
      );

      res.json({
        success: true,
        message: `Widget ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          enabled: enabled,
          shop: shop,
          updated_at: updatedStore.updated_at,
        },
      });
    } catch (error) {
      logger.error('Error toggling widget:', error);
      next(error);
    }
  }
);

// Get widget configuration for embedding in storefront
router.get(
  '/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      // Default configuration
      const defaultConfig = {
        enabled: false,
        position: 'bottom-right',
        primaryColor: '#a59457',
        secondaryColor: '#212120',
        accentColor: '#cf795e',
        greeting: '',
        subtitle: 'Asistente de compras con IA',
        placeholder: 'Escribe tu mensaje...',
        avatar: '🌿',
        brandName: 'Kova',
        buttonSize: 72,
        buttonStyle: 'circle',
        showPulse: true,
        chatWidth: 420,
        chatHeight: 600,
        showPromoMessage: true,
        showCart: true,
        enableAnimations: true,
        theme: 'light',
      };

      if (!shop || typeof shop !== 'string') {
        return res.json({
          success: true,
          data: defaultConfig,
        });
      }

      logger.info(`Getting widget config for shop: ${shop}`);

      // First, try to get config from client_stores (new flow with full design settings)
      const { data: clientStore, error: clientError } = await (
        supabaseService as any
      ).serviceClient
        .from('client_stores')
        .select(
          `
          widget_position,
          widget_color,
          welcome_message,
          widget_enabled,
          widget_secondary_color,
          widget_accent_color,
          widget_button_size,
          widget_button_style,
          widget_show_pulse,
          widget_chat_width,
          widget_chat_height,
          widget_subtitle,
          widget_placeholder,
          widget_avatar,
          widget_show_promo_message,
          widget_show_cart,
          widget_enable_animations,
          widget_theme,
          widget_brand_name
        `
        )
        .eq('shop_domain', shop)
        .single();

      if (clientStore && !clientError) {
        logger.info('Widget config loaded from client_stores', { shop });
        return res.json({
          success: true,
          data: {
            enabled: clientStore.widget_enabled ?? true,
            position: clientStore.widget_position || defaultConfig.position,
            primaryColor: clientStore.widget_color || defaultConfig.primaryColor,
            secondaryColor:
              clientStore.widget_secondary_color || defaultConfig.secondaryColor,
            accentColor:
              clientStore.widget_accent_color || defaultConfig.accentColor,
            greeting: clientStore.welcome_message || defaultConfig.greeting,
            subtitle: clientStore.widget_subtitle || defaultConfig.subtitle,
            placeholder:
              clientStore.widget_placeholder || defaultConfig.placeholder,
            avatar: clientStore.widget_avatar || defaultConfig.avatar,
            brandName: clientStore.widget_brand_name || defaultConfig.brandName,
            buttonSize:
              clientStore.widget_button_size || defaultConfig.buttonSize,
            buttonStyle:
              clientStore.widget_button_style || defaultConfig.buttonStyle,
            showPulse: clientStore.widget_show_pulse ?? defaultConfig.showPulse,
            chatWidth: clientStore.widget_chat_width || defaultConfig.chatWidth,
            chatHeight:
              clientStore.widget_chat_height || defaultConfig.chatHeight,
            showPromoMessage:
              clientStore.widget_show_promo_message ??
              defaultConfig.showPromoMessage,
            showCart: clientStore.widget_show_cart ?? defaultConfig.showCart,
            enableAnimations:
              clientStore.widget_enable_animations ??
              defaultConfig.enableAnimations,
            theme: clientStore.widget_theme || defaultConfig.theme,
          },
        });
      }

      // Fallback: Get store from stores table (legacy)
      const store = await supabaseService.getStore(shop);

      if (!store || !store.widget_enabled) {
        return res.json({
          success: true,
          data: { ...defaultConfig, enabled: false },
        });
      }

      // Try to get additional settings from app_settings table
      const { data: settings, error } = await (
        supabaseService as any
      ).serviceClient
        .from('app_settings')
        .select('*')
        .eq('shop_domain', shop)
        .single();

      let config = {
        ...defaultConfig,
        enabled: !!store.widget_enabled,
      };

      if (settings && !error) {
        config = {
          ...config,
          enabled: !!(store.widget_enabled && settings.chat_enabled !== false),
          greeting: settings.welcome_message || config.greeting,
          position: settings.chat_position || config.position,
          primaryColor: settings.chat_color || config.primaryColor,
        };
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Error getting widget config:', error);
      next(error);
    }
  }
);

export default router;
