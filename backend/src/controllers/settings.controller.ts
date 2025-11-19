import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { validateAuth } from '@/middleware/shopify-auth.middleware';

const router = Router();
const supabaseService = new SupabaseService();

// Get current settings for authenticated store
router.get('/', validateAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Getting settings for shop: ${shop}`);

    // Get store settings
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Get app settings from database
    const { data: settings, error } = await (supabaseService as any).serviceClient
      .from('app_settings')
      .select('*')
      .eq('shop_domain', shop)
      .single();

    let appSettings = settings;

    // If no settings exist, create default ones
    if (error && error.code === 'PGRST116') {
      appSettings = {
        shop_domain: shop,
        chat_enabled: true,
        welcome_message: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        chat_position: 'bottom-right',
        chat_color: '#008060',
        auto_open_chat: false,
        show_agent_avatar: true,
        business_hours_enabled: false,
        business_hours_start: '09:00',
        business_hours_end: '18:00',
        business_timezone: 'America/Mexico_City',
        fallback_message: 'Lo siento, en este momento no puedo ayudarte. Por favor, intenta más tarde.',
        max_conversation_history: 50,
        enable_product_recommendations: true,
        enable_order_tracking: true,
        enable_analytics: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create default settings
      const { error: createError } = await (supabaseService as any).serviceClient
        .from('app_settings')
        .insert(appSettings);

      if (createError) {
        logger.error('Error creating default settings:', createError);
        throw new AppError('Failed to create default settings', 500);
      }
    } else if (error) {
      logger.error('Error fetching settings:', error);
      throw new AppError('Failed to fetch settings', 500);
    }

    res.json({
      success: true,
      data: {
        store: {
          shop_domain: store.shop_domain,
          widget_enabled: store.widget_enabled,
          installed_at: store.installed_at
        },
        settings: appSettings
      }
    });
  } catch (error) {
    logger.error('Error getting settings:', error);
    next(error);
  }
});

// Update settings for authenticated store
router.post('/update', validateAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const {
      chat_enabled,
      welcome_message,
      chat_position,
      chat_color,
      auto_open_chat,
      show_agent_avatar,
      business_hours_enabled,
      business_hours_start,
      business_hours_end,
      business_timezone,
      fallback_message,
      max_conversation_history,
      enable_product_recommendations,
      enable_order_tracking,
      enable_analytics
    } = req.body;

    logger.info(`Updating settings for shop: ${shop}`);

    // Validate required fields
    if (welcome_message && welcome_message.length > 500) {
      throw new AppError('Welcome message is too long (max 500 characters)', 400);
    }

    if (fallback_message && fallback_message.length > 500) {
      throw new AppError('Fallback message is too long (max 500 characters)', 400);
    }

    if (max_conversation_history && (max_conversation_history < 1 || max_conversation_history > 200)) {
      throw new AppError('Conversation history must be between 1 and 200', 400);
    }

    // Prepare update object
    const updateData = {
      updated_at: new Date()
    };

    // Only update provided fields
    if (typeof chat_enabled === 'boolean') updateData.chat_enabled = chat_enabled;
    if (welcome_message) updateData.welcome_message = welcome_message;
    if (chat_position) updateData.chat_position = chat_position;
    if (chat_color) updateData.chat_color = chat_color;
    if (typeof auto_open_chat === 'boolean') updateData.auto_open_chat = auto_open_chat;
    if (typeof show_agent_avatar === 'boolean') updateData.show_agent_avatar = show_agent_avatar;
    if (typeof business_hours_enabled === 'boolean') updateData.business_hours_enabled = business_hours_enabled;
    if (business_hours_start) updateData.business_hours_start = business_hours_start;
    if (business_hours_end) updateData.business_hours_end = business_hours_end;
    if (business_timezone) updateData.business_timezone = business_timezone;
    if (fallback_message) updateData.fallback_message = fallback_message;
    if (max_conversation_history) updateData.max_conversation_history = max_conversation_history;
    if (typeof enable_product_recommendations === 'boolean') updateData.enable_product_recommendations = enable_product_recommendations;
    if (typeof enable_order_tracking === 'boolean') updateData.enable_order_tracking = enable_order_tracking;
    if (typeof enable_analytics === 'boolean') updateData.enable_analytics = enable_analytics;

    // Update settings in database
    const { data, error } = await (supabaseService as any).serviceClient
      .from('app_settings')
      .update(updateData)
      .eq('shop_domain', shop)
      .select()
      .single();

    if (error) {
      logger.error('Error updating settings:', error);
      throw new AppError('Failed to update settings', 500);
    }

    logger.info(`Settings updated successfully for shop: ${shop}`);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        settings: data,
        updated_fields: Object.keys(updateData)
      }
    });
  } catch (error) {
    logger.error('Error updating settings:', error);
    next(error);
  }
});

// Reset settings to defaults
router.post('/reset', validateAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;

    logger.info(`Resetting settings to defaults for shop: ${shop}`);

    const defaultSettings = {
      chat_enabled: true,
      welcome_message: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
      chat_position: 'bottom-right',
      chat_color: '#008060',
      auto_open_chat: false,
      show_agent_avatar: true,
      business_hours_enabled: false,
      business_hours_start: '09:00',
      business_hours_end: '18:00',
      business_timezone: 'America/Mexico_City',
      fallback_message: 'Lo siento, en este momento no puedo ayudarte. Por favor, intenta más tarde.',
      max_conversation_history: 50,
      enable_product_recommendations: true,
      enable_order_tracking: true,
      enable_analytics: true,
      updated_at: new Date()
    };

    const { data, error } = await (supabaseService as any).serviceClient
      .from('app_settings')
      .update(defaultSettings)
      .eq('shop_domain', shop)
      .select()
      .single();

    if (error) {
      logger.error('Error resetting settings:', error);
      throw new AppError('Failed to reset settings', 500);
    }

    logger.info(`Settings reset to defaults for shop: ${shop}`);

    res.json({
      success: true,
      message: 'Settings reset to defaults successfully',
      data: {
        settings: data
      }
    });
  } catch (error) {
    logger.error('Error resetting settings:', error);
    next(error);
  }
});

export default router;