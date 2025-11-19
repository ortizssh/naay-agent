import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { ShopifyService } from '@/services/shopify.service';
import { QueueService } from '@/services/queue.service';
import { logger } from '@/utils/logger';

const router = Router();
const supabaseService = new SupabaseService();

// Admin bypass endpoints - these don't require authentication
// Used by the admin panel when token auth is failing

// Sync products - bypass version
router.post('/products/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    logger.info('Starting product sync for shop via bypass:', shop);

    // Get store credentials
    const store = await supabaseService.getStore(shop);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Initialize services and start sync
    const queueService = new QueueService();
    
    // Trigger full sync job
    await queueService.addFullSyncJob(shop, store.access_token);

    res.json({
      success: true,
      message: 'Sincronización de productos iniciada correctamente'
    });

  } catch (error) {
    logger.error('Admin bypass product sync error:', error);
    next(error);
  }
});

// Settings endpoints - bypass version
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
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
        max_conversation_history: 50,
        enable_product_recommendations: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Create default settings
      const { error: createError } = await (supabaseService as any).serviceClient
        .from('app_settings')
        .insert(appSettings);

      if (createError) {
        logger.error('Error creating default settings:', createError);
        throw new Error('Failed to create default settings');
      }
    } else if (error) {
      logger.error('Error fetching settings:', error);
      throw new Error('Failed to fetch settings');
    }
    
    res.json({
      success: true,
      data: {
        settings: appSettings
      }
    });

  } catch (error) {
    logger.error('Admin bypass get settings error:', error);
    next(error);
  }
});

router.post('/settings/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, ...settingsData } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Ensure widget is always enabled
    settingsData.chat_enabled = true;
    settingsData.updated_at = new Date();

    // Update settings in database
    const { data, error } = await (supabaseService as any).serviceClient
      .from('app_settings')
      .update(settingsData)
      .eq('shop_domain', shop)
      .select()
      .single();

    if (error) {
      logger.error('Error updating settings:', error);
      throw new Error('Failed to update settings');
    }
    
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      data: {
        settings: data
      }
    });

  } catch (error) {
    logger.error('Admin bypass update settings error:', error);
    next(error);
  }
});

router.post('/settings/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Default settings with widget always enabled
    const defaultSettings = {
      chat_enabled: true,
      welcome_message: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
      chat_position: 'bottom-right',
      chat_color: '#008060',
      auto_open_chat: false,
      show_agent_avatar: true,
      max_conversation_history: 50,
      enable_product_recommendations: true,
      updated_at: new Date()
    };

    // Update settings in database
    const { data, error } = await (supabaseService as any).serviceClient
      .from('app_settings')
      .update(defaultSettings)
      .eq('shop_domain', shop)
      .select()
      .single();

    if (error) {
      logger.error('Error resetting settings:', error);
      throw new Error('Failed to reset settings');
    }
    
    res.json({
      success: true,
      message: 'Configuración restablecida a valores por defecto',
      data: {
        settings: data
      }
    });

  } catch (error) {
    logger.error('Admin bypass reset settings error:', error);
    next(error);
  }
});

// Webhook stats - bypass version
router.get('/webhooks/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get webhook events from database
    const { data: events, error } = await (supabaseService as any).serviceClient
      .from('webhook_events')
      .select('*')
      .eq('shop_domain', shop);

    if (error) {
      throw error;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      total: events?.length || 0,
      today: events?.filter(event => 
        new Date(event.created_at) >= today
      ).length || 0,
      pending: events?.filter(event => 
        event.status === 'pending'
      ).length || 0,
      failed: events?.filter(event => 
        event.status === 'failed'
      ).length || 0,
      success: events?.filter(event => 
        event.status === 'completed'
      ).length || 0
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Admin bypass webhook stats error:', error);
    next(error);
  }
});

// Webhook management - bypass versions
router.post('/webhooks/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get store credentials
    const store = await supabaseService.getStore(shop);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const shopifyService = new ShopifyService();
    
    // Recreate essential webhooks
    await shopifyService.createWebhooks(shop, store.access_token);
    
    res.json({
      success: true,
      message: 'Webhooks recreados correctamente'
    });

  } catch (error) {
    logger.error('Admin bypass create webhooks error:', error);
    next(error);
  }
});

router.post('/webhooks/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get store credentials
    const store = await supabaseService.getStore(shop);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const shopifyService = new ShopifyService();
    const client = shopifyService.getAdminClient(shop, store.access_token);
    
    // Test connectivity by fetching shop info
    const response = await client.request(`
      query {
        shop {
          name
          primaryDomain {
            url
            host
          }
        }
      }
    `);
    
    res.json({
      success: true,
      message: 'Conectividad con Shopify verificada correctamente',
      data: {
        shop: response.data.shop.name,
        domain: response.data.shop.primaryDomain.host
      }
    });

  } catch (error) {
    logger.error('Admin bypass test webhooks error:', error);
    next(error);
  }
});

export default router;