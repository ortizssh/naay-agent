import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const supabaseService = new SupabaseService();

// Emergency endpoint to activate widget without auth (temporary)
router.post(
  '/emergency/activate-widget',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        throw new AppError('Shop parameter is required', 400);
      }

      logger.info(`Emergency activation of widget for shop: ${shop}`);

      // Check if store exists
      let store = await supabaseService.getStore(shop);

      if (!store) {
        // Create store if it doesn't exist
        store = await supabaseService.createStore({
          shop_domain: shop,
          access_token: 'placeholder_token',
          scopes:
            'read_products,write_products,read_orders,read_customers,write_draft_orders',
          installed_at: new Date(),
          updated_at: new Date(),
          widget_enabled: true, // Enable widget by default
        });

        logger.info(`Store created and widget activated for: ${shop}`);
      } else {
        // Update existing store to enable widget
        store = await supabaseService.updateStoreWidget(shop, true);
        logger.info(`Widget activated for existing store: ${shop}`);
      }

      // Create default app settings if they don't exist
      const { data: existingSettings, error: settingsError } = await (
        supabaseService as any
      ).serviceClient
        .from('app_settings')
        .select('*')
        .eq('shop_domain', shop)
        .single();

      if (settingsError && settingsError.code === 'PGRST116') {
        // Settings don't exist, create them
        const { data: newSettings, error: createError } = await (
          supabaseService as any
        ).serviceClient
          .from('app_settings')
          .insert({
            shop_domain: shop,
            chat_enabled: true,
            welcome_message:
              '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
            chat_position: 'bottom-right',
            chat_color: '#008060',
            auto_open_chat: false,
            show_agent_avatar: true,
            enable_product_recommendations: true,
            enable_order_tracking: true,
            enable_analytics: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .select()
          .single();

        if (createError) {
          logger.error('Error creating default settings:', createError);
          throw new AppError('Failed to create default settings', 500);
        }

        logger.info('Default settings created for shop:', shop);
      }

      res.json({
        success: true,
        message: 'Widget activated successfully via emergency endpoint',
        data: {
          shop: shop,
          widget_enabled: true,
          store: store,
        },
      });
    } catch (error) {
      logger.error('Emergency widget activation error:', error);
      next(error);
    }
  }
);

// Emergency endpoint to get widget status without auth
router.get(
  '/emergency/widget-status/:shop',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.params;

      logger.info(`Getting emergency widget status for: ${shop}`);

      const store = await supabaseService.getStore(shop);

      if (!store) {
        return res.json({
          success: false,
          message: 'Store not found',
          data: { enabled: false },
        });
      }

      res.json({
        success: true,
        data: {
          enabled: store.widget_enabled || false,
          shop: shop,
          last_updated: store.updated_at,
        },
      });
    } catch (error) {
      logger.error('Emergency widget status check error:', error);
      next(error);
    }
  }
);

export default router;
