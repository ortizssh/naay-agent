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
      let shop = req.query.shop as string;

      // Normalize URL for WooCommerce stores (remove paths, keep protocol://host)
      // This ensures consistency with how WooCommerce stores save their config
      if (shop && (shop.startsWith('http://') || shop.startsWith('https://'))) {
        try {
          const url = new URL(shop);
          shop = `${url.protocol}//${url.host}`;
          logger.info('Normalized shop URL for widget config', {
            original: req.query.shop,
            normalized: shop,
          });
        } catch {
          // If URL parsing fails, use the original value
          logger.warn('Failed to parse shop URL, using original value', {
            shop,
          });
        }
      }

      // Remove trailing slashes for consistency
      shop = shop?.replace(/\/+$/, '');

      // Default configuration
      const defaultConfig = {
        enabled: false,
        position: 'bottom-right',
        primaryColor: '#a59457',
        secondaryColor: '#212120',
        accentColor: '#cf795e',
        greeting: '',
        greeting2: '',
        greeting3: '',
        subtitle2: '',
        subtitle3: '',
        rotatingMessagesEnabled: false,
        rotatingMessagesInterval: 5,
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
        promoBadgeEnabled: false,
        promoBadgeDiscount: 10,
        promoBadgeText: 'Descuento especial',
        promoBadgeColor: '#ef4444',
        promoBadgeShape: 'circle',
        promoBadgePosition: 'right',
        promoBadgeSuffix: 'OFF',
        promoBadgePrefix: '',
        promoBadgeFontSize: 12,
      };

      if (!shop) {
        return res.json({
          success: true,
          data: defaultConfig,
        });
      }

      logger.info(`Getting widget config for shop: ${shop}`);

      // Build list of possible shop domain formats to try
      const shopVariants: string[] = [shop];

      // If it's a full URL, also try just the hostname
      if (shop.startsWith('http://') || shop.startsWith('https://')) {
        try {
          const url = new URL(shop);
          shopVariants.push(url.host); // e.g., "example.com"
          shopVariants.push(url.hostname); // e.g., "example.com" (without port)
          // Also try with trailing slash (some DBs store URLs with trailing slash)
          shopVariants.push(`${url.protocol}//${url.host}/`);
        } catch {
          // Ignore parse errors
        }
      } else {
        // If it's just a hostname, also try with https://
        shopVariants.push(`https://${shop}`);
        shopVariants.push(`https://${shop}/`); // With trailing slash
      }

      logger.info('Trying shop domain variants:', { shopVariants });

      // First, try to get config from client_stores (new flow with full design settings)
      let clientStore = null;
      let clientError = null;

      for (const shopVariant of shopVariants) {
        const { data, error } = await (supabaseService as any).serviceClient
          .from('client_stores')
          .select(
            `
            widget_position,
            widget_color,
            welcome_message,
            widget_welcome_message_2,
            widget_subtitle_2,
            widget_welcome_message_3,
            widget_subtitle_3,
            widget_rotating_messages_enabled,
            widget_rotating_messages_interval,
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
            widget_brand_name,
            promo_badge_enabled,
            promo_badge_discount,
            promo_badge_text,
            promo_badge_color,
            promo_badge_shape,
            promo_badge_position,
            promo_badge_suffix,
            promo_badge_prefix,
            promo_badge_font_size
          `
          )
          .eq('shop_domain', shopVariant)
          .single();

        if (data && !error) {
          clientStore = data;
          logger.info('Found client_stores config with variant:', {
            shopVariant,
          });
          break;
        }
        clientError = error;
      }

      if (clientStore && !clientError) {
        logger.info('Widget config loaded from client_stores', { shop });
        return res.json({
          success: true,
          data: {
            enabled: clientStore.widget_enabled ?? true,
            position: clientStore.widget_position || defaultConfig.position,
            primaryColor:
              clientStore.widget_color || defaultConfig.primaryColor,
            secondaryColor:
              clientStore.widget_secondary_color ||
              defaultConfig.secondaryColor,
            accentColor:
              clientStore.widget_accent_color || defaultConfig.accentColor,
            greeting: clientStore.welcome_message || defaultConfig.greeting,
            greeting2:
              clientStore.widget_welcome_message_2 || defaultConfig.greeting2,
            subtitle2: clientStore.widget_subtitle_2 || defaultConfig.subtitle2,
            greeting3:
              clientStore.widget_welcome_message_3 || defaultConfig.greeting3,
            subtitle3: clientStore.widget_subtitle_3 || defaultConfig.subtitle3,
            rotatingMessagesEnabled:
              clientStore.widget_rotating_messages_enabled ??
              defaultConfig.rotatingMessagesEnabled,
            rotatingMessagesInterval:
              clientStore.widget_rotating_messages_interval ||
              defaultConfig.rotatingMessagesInterval,
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
            promoBadgeEnabled:
              clientStore.promo_badge_enabled ??
              defaultConfig.promoBadgeEnabled,
            promoBadgeDiscount:
              clientStore.promo_badge_discount ||
              defaultConfig.promoBadgeDiscount,
            promoBadgeText:
              clientStore.promo_badge_text || defaultConfig.promoBadgeText,
            promoBadgeColor:
              clientStore.promo_badge_color || defaultConfig.promoBadgeColor,
            promoBadgeShape:
              clientStore.promo_badge_shape || defaultConfig.promoBadgeShape,
            promoBadgePosition:
              clientStore.promo_badge_position ||
              defaultConfig.promoBadgePosition,
            promoBadgeSuffix:
              clientStore.promo_badge_suffix ?? defaultConfig.promoBadgeSuffix,
            promoBadgePrefix:
              clientStore.promo_badge_prefix ?? defaultConfig.promoBadgePrefix,
            promoBadgeFontSize:
              clientStore.promo_badge_font_size ||
              defaultConfig.promoBadgeFontSize,
          },
        });
      }

      // Fallback: Get store from stores table (legacy)
      // Try all shop variants
      let store = null;
      for (const shopVariant of shopVariants) {
        store = await supabaseService.getStore(shopVariant);
        if (store) {
          logger.info('Found store with variant:', { shopVariant });
          break;
        }
      }

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
