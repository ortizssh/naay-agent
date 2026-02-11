import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { validateAuth } from '@/middleware/shopify-auth.middleware';
import { config as appConfig } from '@/utils/config';

const RETELL_API_KEY = process.env.RETELL_API_KEY || '';

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
        showContact: false,
        enableAnimations: true,
        theme: 'light',
        promoBadgeEnabled: false,
        promoBadgeType: 'discount',
        promoBadgeDiscount: 10,
        promoBadgeText: 'Descuento especial',
        promoBadgeColor: '#ef4444',
        promoBadgeShape: 'circle',
        promoBadgePosition: 'right',
        promoBadgeSuffix: 'OFF',
        promoBadgePrefix: '',
        promoBadgeFontSize: 12,
        suggestedQuestion1Text: 'Recomendaciones personalizadas',
        suggestedQuestion1Message: '¿Qué productos recomiendas para mí?',
        suggestedQuestion2Text: 'Ayuda con mi compra',
        suggestedQuestion2Message: '¿Puedes ayudarme a elegir productos?',
        suggestedQuestion3Text: 'Información de envío',
        suggestedQuestion3Message: '¿Cuáles son las opciones de envío?',
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
            widget_show_contact,
            retell_agent_id,
            widget_enable_animations,
            widget_theme,
            widget_brand_name,
            promo_badge_enabled,
            promo_badge_type,
            promo_badge_discount,
            promo_badge_text,
            promo_badge_color,
            promo_badge_shape,
            promo_badge_position,
            promo_badge_suffix,
            promo_badge_prefix,
            promo_badge_font_size,
            suggested_question_1_text,
            suggested_question_1_message,
            suggested_question_2_text,
            suggested_question_2_message,
            suggested_question_3_text,
            suggested_question_3_message,
            chat_mode,
            chatbot_endpoint,
            platform
          `
          )
          .eq('shop_domain', shopVariant)
          .single();

        if (data && !error) {
          clientStore = data;
          clientError = null; // Reset error when found
          logger.info('Found client_stores config with variant:', {
            shopVariant,
          });
          break;
        }
        clientError = error;
      }

      if (clientStore) {
        logger.info('Widget config loaded from client_stores', { shop });

        // Determine chatEndpoint based on chat_mode
        const appUrl = appConfig.shopify?.appUrl || '';
        const chatEndpoint =
          clientStore.chat_mode === 'external' && clientStore.chatbot_endpoint
            ? clientStore.chatbot_endpoint
            : `${appUrl}/api/simple-chat/`;

        return res.json({
          success: true,
          data: {
            enabled: clientStore.widget_enabled ?? true,
            chatEndpoint,
            platform: clientStore.platform || '',
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
            showContact:
              clientStore.widget_show_contact ?? defaultConfig.showContact,
            retellAgentId: clientStore.retell_agent_id || '',
            enableAnimations:
              clientStore.widget_enable_animations ??
              defaultConfig.enableAnimations,
            theme: clientStore.widget_theme || defaultConfig.theme,
            promoBadgeEnabled:
              clientStore.promo_badge_enabled ??
              defaultConfig.promoBadgeEnabled,
            promoBadgeType:
              clientStore.promo_badge_type || defaultConfig.promoBadgeType,
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
            suggestedQuestion1Text:
              clientStore.suggested_question_1_text ||
              defaultConfig.suggestedQuestion1Text,
            suggestedQuestion1Message:
              clientStore.suggested_question_1_message ||
              defaultConfig.suggestedQuestion1Message,
            suggestedQuestion2Text:
              clientStore.suggested_question_2_text ||
              defaultConfig.suggestedQuestion2Text,
            suggestedQuestion2Message:
              clientStore.suggested_question_2_message ||
              defaultConfig.suggestedQuestion2Message,
            suggestedQuestion3Text:
              clientStore.suggested_question_3_text ||
              defaultConfig.suggestedQuestion3Text,
            suggestedQuestion3Message:
              clientStore.suggested_question_3_message ||
              defaultConfig.suggestedQuestion3Message,
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

// Initiate a phone call via Retell AI
router.post(
  '/contact',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, phone, email, shopDomain, sessionId } = req.body;

      if (!name || !phone || !email) {
        throw new AppError('Name, phone, and email are required', 400);
      }

      if (!RETELL_API_KEY) {
        logger.error('Retell API key not configured');
        throw new AppError('Contact service not configured', 503);
      }

      if (!shopDomain) {
        throw new AppError('Shop domain is required', 400);
      }

      // Build list of possible shop domain formats to try
      const contactShopVariants: string[] = [shopDomain];
      if (shopDomain.startsWith('http://') || shopDomain.startsWith('https://')) {
        try {
          const url = new URL(shopDomain);
          contactShopVariants.push(url.host);
          contactShopVariants.push(url.hostname);
          contactShopVariants.push(`${url.protocol}//${url.host}/`);
        } catch {
          // Ignore parse errors
        }
      } else {
        contactShopVariants.push(`https://${shopDomain}`);
        contactShopVariants.push(`https://${shopDomain}/`);
      }

      // Look up the client's Retell agent ID from the database
      let clientStore = null;
      for (const variant of contactShopVariants) {
        const { data } = await (
          supabaseService as any
        ).serviceClient
          .from('client_stores')
          .select('retell_agent_id')
          .eq('shop_domain', variant)
          .single();
        if (data?.retell_agent_id) {
          clientStore = data;
          break;
        }
      }

      if (!clientStore?.retell_agent_id) {
        logger.error('Retell agent ID not configured for shop', { shopDomain });
        throw new AppError(
          'Contact service not configured for this store',
          503
        );
      }

      logger.info('Initiating contact call via Retell AI', {
        shopDomain,
        sessionId,
        phone,
        agentId: clientStore.retell_agent_id,
      });

      const retellResponse = await fetch(
        'https://api.retellai.com/v2/create-phone-call',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RETELL_API_KEY}`,
          },
          body: JSON.stringify({
            agent_id: clientStore.retell_agent_id,
            customer_number: phone,
            metadata: {
              customer_name: name,
              customer_email: email,
              shop_domain: shopDomain,
              session_id: sessionId || '',
            },
          }),
        }
      );

      if (!retellResponse.ok) {
        const errorData = await retellResponse.text();
        logger.error('Retell AI API error', {
          status: retellResponse.status,
          body: errorData,
        });
        throw new AppError('Failed to initiate call', 502);
      }

      const callData = await retellResponse.json();

      res.json({
        success: true,
        data: {
          message: 'Call initiated successfully',
          callId: (callData as any).call_id,
        },
      });
    } catch (error) {
      logger.error('Contact call error:', error);
      next(error);
    }
  }
);

export default router;
