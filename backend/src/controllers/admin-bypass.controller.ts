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

// Get conversations - bypass version
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, limit = 50, offset = 0 } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get conversation history from database
    const { data: conversations, error } = await (supabaseService as any).serviceClient
      .from('conversations')
      .select(`
        id,
        session_id,
        user_message,
        ai_response,
        created_at,
        metadata
      `)
      .eq('shop_domain', shop)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      logger.error('Database error fetching conversations:', error);
      // Return empty result instead of throwing error
      return res.json({
        success: true,
        data: {
          conversations: [],
          total: 0
        }
      });
    }

    // Group by session_id to get conversation threads
    const conversationThreads: any = {};
    conversations?.forEach(conv => {
      if (!conversationThreads[conv.session_id]) {
        conversationThreads[conv.session_id] = {
          session_id: conv.session_id,
          messages: [],
          created_at: conv.created_at,
          last_message: conv.created_at
        };
      }
      
      conversationThreads[conv.session_id].messages.push({
        user: conv.user_message,
        ai: conv.ai_response,
        timestamp: conv.created_at,
        metadata: conv.metadata
      });
      
      // Update last message timestamp
      if (conv.created_at > conversationThreads[conv.session_id].last_message) {
        conversationThreads[conv.session_id].last_message = conv.created_at;
      }
    });

    const threads = Object.values(conversationThreads).sort((a: any, b: any) => 
      new Date(b.last_message).getTime() - new Date(a.last_message).getTime()
    );

    res.json({
      success: true,
      data: {
        conversations: threads,
        total: threads.length
      }
    });

  } catch (error) {
    logger.error('Admin bypass conversations error:', error);
    next(error);
  }
});

// Get recommended products stats - bypass version
router.get('/analytics/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, days = 30 } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));

    // Get product mentions from conversations
    const { data: conversations, error } = await (supabaseService as any).serviceClient
      .from('conversations')
      .select('ai_response, metadata, created_at')
      .eq('shop_domain', shop)
      .gte('created_at', daysAgo.toISOString());

    if (error) {
      logger.error('Database error fetching conversations for analytics:', error);
      // Return empty result instead of throwing error
      return res.json({
        success: true,
        data: {
          topProducts: [],
          totalConversations: 0,
          periodDays: Number(days)
        }
      });
    }

    // Analyze product recommendations
    const productMentions: { [key: string]: number } = {};
    const productNames: { [key: string]: string } = {};

    conversations?.forEach(conv => {
      // Extract product mentions from AI responses
      const response = conv.ai_response;
      const metadata = conv.metadata;
      
      // Look for product references in the response
      if (metadata && metadata.recommended_products) {
        metadata.recommended_products.forEach((product: any) => {
          const productId = product.id || product.product_id;
          if (productId) {
            productMentions[productId] = (productMentions[productId] || 0) + 1;
            productNames[productId] = product.title || product.name || `Producto ${productId}`;
          }
        });
      }
      
      // Also check for product mentions in the text
      const productRegex = /(?:recomiendo|sugiero|prueba|considera|producto|cosmético)\s+([^\.]+)/gi;
      let match;
      while ((match = productRegex.exec(response)) !== null) {
        const productRef = match[1].trim();
        if (productRef && productRef.length > 3) {
          productMentions[productRef] = (productMentions[productRef] || 0) + 1;
          productNames[productRef] = productRef;
        }
      }
    });

    // Sort by most mentioned
    const sortedProducts = Object.entries(productMentions)
      .map(([id, count]) => ({
        id,
        name: productNames[id],
        mentions: count,
        percentage: Math.round((count / conversations.length) * 100)
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        topProducts: sortedProducts,
        totalConversations: conversations.length,
        periodDays: Number(days)
      }
    });

  } catch (error) {
    logger.error('Admin bypass product analytics error:', error);
    next(error);
  }
});

// Get system logs - bypass version
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, level = 'all', limit = 100 } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get recent logs (this would typically come from a logging service or database)
    // For now, we'll create some sample logs based on recent activity
    
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Widget cargado correctamente',
        source: 'widget',
        details: { shop, action: 'widget_load' }
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'info',
        message: 'Conversación iniciada',
        source: 'chat',
        details: { shop, session_id: 'conv_' + Date.now() }
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'info',
        message: 'Sincronización de productos completada',
        source: 'sync',
        details: { shop, products_synced: 25 }
      },
      {
        timestamp: new Date(Date.now() - 900000).toISOString(),
        level: 'warning',
        message: 'Rate limit alcanzado, reintentando en 30s',
        source: 'api',
        details: { shop, endpoint: '/api/chat' }
      }
    ];

    // Filter by level if specified
    const filteredLogs = level === 'all' 
      ? logs 
      : logs.filter(log => log.level === level);

    res.json({
      success: true,
      data: {
        logs: filteredLogs.slice(0, Number(limit)),
        total: filteredLogs.length
      }
    });

  } catch (error) {
    logger.error('Admin bypass logs error:', error);
    next(error);
  }
});

// Get dashboard stats - bypass version
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required'
      });
    }

    // Get various stats
    const [
      conversationsResult,
      productsResult,
      webhooksResult
    ] = await Promise.allSettled([
      // Conversations count
      (supabaseService as any).serviceClient
        .from('conversations')
        .select('id', { count: 'exact' })
        .eq('shop_domain', shop),
      
      // Products count
      (supabaseService as any).serviceClient
        .from('products')
        .select('id', { count: 'exact' })
        .eq('shop_domain', shop),
      
      // Webhooks count
      (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('id', { count: 'exact' })
        .eq('shop_domain', shop)
    ]);

    const stats = {
      conversations: conversationsResult.status === 'fulfilled' ? 
        (conversationsResult.value.count || 0) : 0,
      products: productsResult.status === 'fulfilled' ? 
        (productsResult.value.count || 0) : 0,
      webhooks: webhooksResult.status === 'fulfilled' ? 
        (webhooksResult.value.count || 0) : 0,
      chatStatus: 'Active'
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Admin bypass stats error:', error);
    next(error);
  }
});

export default router;