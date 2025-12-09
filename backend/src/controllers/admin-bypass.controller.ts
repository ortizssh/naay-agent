import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { ShopifyService } from '@/services/shopify.service';
import { QueueService } from '@/services/queue.service';
import { ChatConversionsService } from '@/services/chat-conversions.service';
import { logger } from '@/utils/logger';
import { adminBypassRateLimit } from '@/middleware/rateLimiter';

const router = Router();
const supabaseService = new SupabaseService();
const chatConversionsService = new ChatConversionsService();

// Apply rate limiting to all admin-bypass routes
router.use(adminBypassRateLimit);

// Admin bypass endpoints - these don't require authentication
// Used by the admin panel when token auth is failing

// Sync products - bypass version
router.post(
  '/products/sync',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      logger.info('Starting product sync for shop via bypass:', shop);

      // Get store credentials
      const store = await supabaseService.getStore(shop);
      if (!store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
        });
      }

      // Initialize services and start sync
      const queueService = new QueueService();

      // Trigger full sync job
      await queueService.addFullSyncJob(shop, store.access_token);

      res.json({
        success: true,
        message: 'Sincronización de productos iniciada correctamente',
      });
    } catch (error) {
      logger.error('Admin bypass product sync error:', error);
      next(error);
    }
  }
);

// Settings endpoints - bypass version
router.get(
  '/settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Get app settings from database
      const { data: settings, error } = await (
        supabaseService as any
      ).serviceClient
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
          welcome_message:
            '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
          chat_position: 'bottom-right',
          chat_color: '#008060',
          auto_open_chat: false,
          show_agent_avatar: true,
          max_conversation_history: 50,
          enable_product_recommendations: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        // Create default settings
        const { error: createError } = await (
          supabaseService as any
        ).serviceClient
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
          settings: appSettings,
        },
      });
    } catch (error) {
      logger.error('Admin bypass get settings error:', error);
      next(error);
    }
  }
);

router.post(
  '/settings/update',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, ...settingsData } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
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
          settings: data,
        },
      });
    } catch (error) {
      logger.error('Admin bypass update settings error:', error);
      next(error);
    }
  }
);

router.post(
  '/settings/reset',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Default settings with widget always enabled
      const defaultSettings = {
        chat_enabled: true,
        welcome_message:
          '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        chat_position: 'bottom-right',
        chat_color: '#008060',
        auto_open_chat: false,
        show_agent_avatar: true,
        max_conversation_history: 50,
        enable_product_recommendations: true,
        updated_at: new Date(),
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
          settings: data,
        },
      });
    } catch (error) {
      logger.error('Admin bypass reset settings error:', error);
      next(error);
    }
  }
);

// Webhook stats - bypass version
router.get(
  '/webhooks/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Get webhook events from database
      const { data: events, error } = await (
        supabaseService as any
      ).serviceClient
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
        today:
          events?.filter(event => new Date(event.created_at) >= today).length ||
          0,
        pending:
          events?.filter(event => event.status === 'pending').length || 0,
        failed: events?.filter(event => event.status === 'failed').length || 0,
        success:
          events?.filter(event => event.status === 'completed').length || 0,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Admin bypass webhook stats error:', error);
      next(error);
    }
  }
);

// Webhook management - bypass versions
router.post(
  '/webhooks/create',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Get store credentials
      const store = await supabaseService.getStore(shop);
      if (!store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
        });
      }

      const shopifyService = new ShopifyService();

      // Recreate essential webhooks
      await shopifyService.createWebhooks(shop, store.access_token);

      res.json({
        success: true,
        message: 'Webhooks recreados correctamente',
      });
    } catch (error) {
      logger.error('Admin bypass create webhooks error:', error);
      next(error);
    }
  }
);

router.post(
  '/webhooks/test',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Get store credentials
      const store = await supabaseService.getStore(shop);
      if (!store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
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
          domain: response.data.shop.primaryDomain.host,
        },
      });
    } catch (error) {
      logger.error('Admin bypass test webhooks error:', error);
      next(error);
    }
  }
);

// Get recommended products stats - bypass version
router.get(
  '/analytics/products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(days));

      // Get product mentions from chat messages (agent responses)
      const { data: conversations, error } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('content, metadata, timestamp')
        .eq('role', 'agent')
        .gte('timestamp', daysAgo.toISOString());

      if (error) {
        logger.error(
          'Database error fetching conversations for analytics:',
          error
        );
        // Return empty result instead of throwing error
        return res.json({
          success: true,
          data: {
            topProducts: [],
            totalConversations: 0,
            periodDays: Number(days),
          },
        });
      }

      // Analyze product recommendations
      const productMentions: { [key: string]: number } = {};
      const productNames: { [key: string]: string } = {};

      conversations?.forEach(conv => {
        // Extract product mentions from AI responses
        const response = conv.content;
        const metadata = conv.metadata;

        // Look for product references in the response
        if (metadata && metadata.recommended_products) {
          metadata.recommended_products.forEach((product: any) => {
            const productId = product.id || product.product_id;
            if (productId) {
              productMentions[productId] =
                (productMentions[productId] || 0) + 1;
              productNames[productId] =
                product.title || product.name || `Producto ${productId}`;
            }
          });
        }

        // Also check for product mentions in the text
        const productRegex =
          /(?:recomiendo|sugiero|prueba|considera|producto|cosmético)\s+([^.]+)/gi;
        let match;
        while ((match = productRegex.exec(response)) !== null) {
          const productRef = match[1].trim();
          if (productRef && productRef.length > 3) {
            productMentions[productRef] =
              (productMentions[productRef] || 0) + 1;
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
          percentage: Math.round((count / conversations.length) * 100),
        }))
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 10);

      res.json({
        success: true,
        data: {
          topProducts: sortedProducts,
          totalConversations: conversations.length,
          periodDays: Number(days),
        },
      });
    } catch (error) {
      logger.error('Admin bypass product analytics error:', error);
      next(error);
    }
  }
);

// Get system logs - bypass version
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, level = 'all', limit = 100 } = req.query;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter required',
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
        details: { shop, action: 'widget_load' },
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'info',
        message: 'Conversación iniciada',
        source: 'chat',
        details: { shop, session_id: 'conv_' + Date.now() },
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'info',
        message: 'Sincronización de productos completada',
        source: 'sync',
        details: { shop, products_synced: 25 },
      },
      {
        timestamp: new Date(Date.now() - 900000).toISOString(),
        level: 'warning',
        message: 'Rate limit alcanzado, reintentando en 30s',
        source: 'api',
        details: { shop, endpoint: '/api/chat' },
      },
    ];

    // Filter by level if specified
    const filteredLogs =
      level === 'all' ? logs : logs.filter(log => log.level === level);

    res.json({
      success: true,
      data: {
        logs: filteredLogs.slice(0, Number(limit)),
        total: filteredLogs.length,
      },
    });
  } catch (error) {
    logger.error('Admin bypass logs error:', error);
    next(error);
  }
});

// Debug endpoint to check database stats
router.get('/debug/db-stats', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    logger.info('Debug: Checking data for today', {
      date: today.toISOString().split('T')[0],
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    // Get all chat messages for today
    const { data: todayMessages, error: todayError } = await (
      supabaseService as any
    ).serviceClient
      .from('chat_messages')
      .select('id, session_id, role, timestamp, content')
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (todayError) {
      throw todayError;
    }

    // Group by session_id for conversations
    const sessionsToday = new Set<string>();
    const messagesByRole: { [key: string]: number } = {
      client: 0,
      agent: 0,
      system: 0,
    };

    todayMessages?.forEach((msg: any) => {
      sessionsToday.add(msg.session_id);
      messagesByRole[msg.role] = (messagesByRole[msg.role] || 0) + 1;
    });

    // Get all historical data using pagination to overcome Supabase 1000 limit
    const { count: totalHistoricalCount } = await (supabaseService as any).serviceClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    const allMessages = [];
    const batchSize = 1000;
    const totalBatches = Math.ceil((totalHistoricalCount || 0) / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = start + batchSize - 1;

      const { data: batch } = await (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('id, session_id, timestamp')
        .range(start, end)
        .order('timestamp', { ascending: false });

      if (batch) allMessages.push(...batch);
    }

    const allSessions = new Set<string>();
    allMessages?.forEach((msg: any) => {
      allSessions.add(msg.session_id);
    });

    res.json({
      success: true,
      data: {
        today: {
          date: today.toISOString().split('T')[0],
          conversations: sessionsToday.size,
          totalMessages: todayMessages?.length || 0,
          messagesByRole,
          latestMessages: todayMessages?.slice(0, 5),
        },
        historical: {
          totalConversations: allSessions.size,
          totalMessages: allMessages?.length || 0,
          oldestMessage: allMessages?.[allMessages.length - 1]?.timestamp,
          newestMessage: allMessages?.[0]?.timestamp,
        },
      },
    });
  } catch (error: any) {
    logger.error('Debug today error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Real database analysis endpoint
router.get('/debug/real-data', async (req: Request, res: Response) => {
  try {
    // Get exact count
    const { count: totalCount } = await (supabaseService as any).serviceClient
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    // Get multiple batches to overcome Supabase limits
    const batches = [];
    const batchSize = 1000;
    const totalBatches = Math.ceil((totalCount || 0) / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = start + batchSize - 1;

      const { data: batch } = await (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('session_id, timestamp, role')
        .range(start, end)
        .order('timestamp', { ascending: false });

      if (batch) batches.push(...batch);
    }

    // Analyze the data
    const uniqueSessions = new Set<string>();
    const messagesByDate: { [key: string]: number } = {};
    const sessionsByDate: { [key: string]: Set<string> } = {};
    const today = new Date().toISOString().split('T')[0];

    batches.forEach((msg: any) => {
      if (msg.session_id) {
        uniqueSessions.add(msg.session_id);

        const dateKey = new Date(msg.timestamp).toISOString().split('T')[0];
        messagesByDate[dateKey] = (messagesByDate[dateKey] || 0) + 1;

        if (!sessionsByDate[dateKey]) {
          sessionsByDate[dateKey] = new Set<string>();
        }
        sessionsByDate[dateKey].add(msg.session_id);
      }
    });

    const last7Days = Object.entries(sessionsByDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7)
      .map(([date, sessions]) => ({
        date,
        conversations: sessions.size,
        messages: messagesByDate[date] || 0,
      }));

    res.json({
      success: true,
      data: {
        totalRecordsInDB: totalCount,
        batchesFetched: Math.min(totalBatches, 3),
        recordsAnalyzed: batches.length,
        uniqueConversations: uniqueSessions.size,
        todayDate: today,
        todayConversations: sessionsByDate[today]?.size || 0,
        todayMessages: messagesByDate[today] || 0,
        last7Days,
        oldestInSample: batches[batches.length - 1]?.timestamp,
        newestInSample: batches[0]?.timestamp,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Get dashboard stats - bypass version
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      logger.info('Admin bypass: Getting stats', { shop });

      // DEBUG: Check what's actually in the database
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);

      logger.info('DEBUG: Checking database content', {
        today: today.toISOString().split('T')[0],
        startOfToday: startOfToday.toISOString(),
      });

      // Get ALL messages from chat_messages table using pagination to overcome Supabase 1000 limit
      // First get exact count
      const { count: totalCount } = await (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true });

      logger.info('📊 Database query starting:', {
        totalRecordsInTable: totalCount,
      });

      // Fetch all records in batches using range pagination
      const allMessages = [];
      const batchSize = 1000;
      const totalBatches = Math.ceil((totalCount || 0) / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize - 1;

        const { data: batch, error: batchError } = await (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('session_id, timestamp, role, id, content, metadata')
          .range(start, end)
          .order('timestamp', { ascending: false });

        if (batchError) {
          logger.error(`Error fetching batch ${i + 1}:`, batchError);
          break;
        }

        if (batch) {
          allMessages.push(...batch);
        }

        logger.info(`📊 Fetched batch ${i + 1}/${totalBatches}:`, {
          batchSize: batch?.length || 0,
          totalFetched: allMessages.length,
        });
      }

      const messagesError = allMessages.length === 0 ? new Error('No messages fetched') : null;

      logger.info('📊 Database query result:', {
        recordsFetched: allMessages?.length || 0,
        totalRecordsInTable: totalCount,
        hasError: !!messagesError,
      });

      if (messagesError) {
        logger.error('Error fetching chat messages:', messagesError);
        throw messagesError;
      }

      // Count total messages and unique conversations
      const totalMessages = allMessages?.length || 0;
      const uniqueSessionIds = new Set<string>();
      const messagesByDate: { [key: string]: number } = {};
      const conversationsByDate: { [key: string]: Set<string> } = {};

      if (allMessages) {
        allMessages.forEach((msg: any) => {
          if (msg.session_id) {
            uniqueSessionIds.add(msg.session_id);

            // Group by date
            const dateKey = new Date(msg.timestamp).toISOString().split('T')[0];
            messagesByDate[dateKey] = (messagesByDate[dateKey] || 0) + 1;

            if (!conversationsByDate[dateKey]) {
              conversationsByDate[dateKey] = new Set<string>();
            }
            conversationsByDate[dateKey].add(msg.session_id);
          }
        });
      }

      const conversationCount = uniqueSessionIds.size;
      const todayKey = today.toISOString().split('T')[0];
      const todayConversations = conversationsByDate[todayKey]?.size || 0;
      const todayMessages = messagesByDate[todayKey] || 0;

      // Log detailed analysis
      logger.info('💾 Database Analysis Complete', {
        totalMessages,
        totalConversations: conversationCount,
        todayKey,
        todayConversations,
        todayMessages,
        last5Days: Object.entries(conversationsByDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 5)
          .map(([date, sessions]) => ({
            date,
            conversations: sessions.size,
            messages: messagesByDate[date] || 0,
          })),
      });

      // Get recommended products from agent messages
      let recommendedProducts = 0;
      let totalRecommendations = 0;

      try {
        // Filter agent messages from already loaded messages
        const agentMessages =
          allMessages?.filter(
            (msg: any) => msg.role === 'agent' && msg.content
          ) || [];

        logger.info('📊 Analyzing agent messages for products', {
          totalAgentMessages: agentMessages.length,
          totalMessages: allMessages?.length || 0,
        });

        if (agentMessages.length > 0) {
          const uniqueProducts = new Set<string>();

          agentMessages.forEach((message: any) => {
            // Use the same extraction logic as analytics endpoints
            const products = extractProductsFromMessage(
              message.content || '',
              message.metadata
            );

            products.forEach(productId => {
              uniqueProducts.add(productId);
              totalRecommendations++;
            });
          });

          recommendedProducts = uniqueProducts.size;

          logger.info('📦 Product recommendation stats calculated:', {
            uniqueProducts: recommendedProducts,
            totalRecommendations: totalRecommendations,
            messagesAnalyzed: agentMessages.length,
          });
        }
      } catch (error) {
        logger.error(
          'Error analyzing product recommendations from chat messages:',
          error
        );
      }

      const stats = {
        conversations: conversationCount || 0,
        recommendedProducts: recommendedProducts,
        totalRecommendations: totalRecommendations,
        chatStatus: 'Active',
      };

      logger.info('📈 Final stats calculated:', stats);

      res.json({
        success: true,
        data: stats,
      });
      return;
    } catch (error) {
      logger.error('Admin bypass stats error:', error);
      // Return demo stats on error
      res.json({
        success: true,
        data: {
          conversations: 0,
          recommendedProducts: 0,
          totalRecommendations: 0,
          chatStatus: 'Error',
        },
      });
      return;
    }
  }
);

// Get conversations - bypass version
router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = 50, page = 1, date } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Use date filter if provided, otherwise default to today
      const filterDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);

      logger.info('Admin bypass: Getting conversations', {
        shop,
        limit,
        page,
        offset,
        date: filterDate.toISOString().split('T')[0],
      });

      // Get messages for the specified date and group by session_id
      let query = (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('session_id, content, timestamp, role')
        .not('session_id', 'is', null)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: false });

      const { data: allMessages, error: messagesError } = await query;

      if (messagesError) {
        logger.error('Error fetching chat messages:', messagesError);
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit: limitNum,
            totalPages: 0,
            currentPage: pageNum,
          },
        });
      }

      if (!allMessages || allMessages.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit: limitNum,
            totalPages: 0,
            currentPage: pageNum,
          },
        });
      }

      // Group messages by session_id and get the latest message for each
      const sessionsMap = new Map();

      allMessages.forEach((message: any) => {
        const sessionId = message.session_id;
        if (!sessionsMap.has(sessionId)) {
          sessionsMap.set(sessionId, {
            session_id: sessionId,
            last_message: message.content,
            last_activity: message.timestamp,
            message_count: 0,
            status: 'active',
          });
        }

        const session = sessionsMap.get(sessionId);
        session.message_count++;

        // Keep the most recent message (first due to desc order)
        if (new Date(message.timestamp) > new Date(session.last_activity)) {
          session.last_message = message.content;
          session.last_activity = message.timestamp;
        }
      });

      // Convert to array and sort by last activity
      const allSessions = Array.from(sessionsMap.values()).sort(
        (a, b) =>
          new Date(b.last_activity).getTime() -
          new Date(a.last_activity).getTime()
      );

      // Apply pagination
      const totalSessions = allSessions.length;
      const paginatedSessions = allSessions.slice(offset, offset + limitNum);

      const conversationsList = paginatedSessions;

      res.json({
        success: true,
        data: conversationsList,
        pagination: {
          total: totalSessions || 0,
          limit: limitNum,
          totalPages: Math.ceil((totalSessions || 0) / limitNum),
          currentPage: pageNum,
        },
      });
    } catch (error) {
      logger.error('Admin bypass conversations error:', error);
      next(error);
    }
  }
);

// Get single conversation details
router.get(
  '/conversations/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      // logger.info('Admin bypass: Getting conversation details', { sessionId });

      // Handle demo sessions
      if (sessionId.startsWith('demo-session-')) {
        const demoMessages =
          sessionId === 'demo-session-1'
            ? [
                {
                  id: 'demo-1',
                  role: 'client',
                  content: 'Hola, ¿puedes ayudarme a encontrar un producto?',
                  timestamp: new Date(Date.now() - 3600000).toISOString(),
                },
                {
                  id: 'demo-2',
                  role: 'agent',
                  content:
                    '¡Hola! Claro, estaré encantado de ayudarte. ¿Qué tipo de producto estás buscando?',
                  timestamp: new Date(Date.now() - 3500000).toISOString(),
                },
                {
                  id: 'demo-3',
                  role: 'client',
                  content:
                    'Busco productos para piel sensible, algo que calme y repare.',
                  timestamp: new Date(Date.now() - 3000000).toISOString(),
                },
                {
                  id: 'demo-4',
                  role: 'agent',
                  content:
                    'Perfecto, podemos organizar la compra en dos boletas para aprovechar el 3x2 y el descuento "PIELPRESENTE" por separado. Para la boleta 3x2 te recomiendo elegir la **Delicate Touch | Emulsión Recuperadora | Calmante**, ideal para piel sensible que calma y repara. Para la otra compra con descuento, podrías escoger productos complementarios como el **Gel Aloe Vera Enriquecido** o la **Crema facial de Bardana** para piel grasa. ¿Quieres que te facilite los enlaces para agregarlos a cada carrito? 🌿✨ { "output": [ { "product": { "id": 1391335309410, "title": "Delicate Touch | Emulsión Recuperadora | Calmante", "image": { "src": "https://cdn.shopify.com/s/files/1/0015/4222/6018/files/emulsion_regalo_dc8a3946-e664-4967-b15d-f486b009c3c6.png?v=1764001376" }, "price": 23992, "handle": "emulsion-recuperadora", "variant_id": 12357877825634 } }, { "product": { "id": 7460599988447, "title": "Básicos faciales + Crema facial de Bardana para piel grasa", "image": { "src": "https://cdn.shopify.com/s/files/1/0015/4222/6018/products/1-NAAYweb4436.jpg?v=1669746621" }, "price": 89520, "handle": "basicos-faciales-crema-facial-de-bardana", "variant_id": 42114960261343 } }, { "product": { "id": 1391318696034, "title": "Gel Aloe Vera Enriquecido", "image": { "src": "https://cdn.shopify.com/s/files/1/0015/4222/6018/files/aloe_enriquecido.png?v=1736171363" }, "price": 15588, "handle": "gel-aloe-enriquecido", "variant_id": 12357793611874 } } ] }',
                  timestamp: new Date(Date.now() - 2500000).toISOString(),
                },
                {
                  id: 'demo-5',
                  role: 'client',
                  content: '¡Perfecto! Me interesan esos productos.',
                  timestamp: new Date(Date.now() - 2000000).toISOString(),
                },
              ]
            : [
                {
                  id: 'demo-6',
                  role: 'client',
                  content: '¿Cuánto cuesta el envío?',
                  timestamp: new Date(Date.now() - 86400000).toISOString(),
                },
                {
                  id: 'demo-7',
                  role: 'agent',
                  content:
                    'El envío estándar es gratuito para compras superiores a $50. Para envío express (1-2 días) el costo es de $15.',
                  timestamp: new Date(Date.now() - 86300000).toISOString(),
                },
                {
                  id: 'demo-8',
                  role: 'client',
                  content: 'Perfecto, gracias por la información.',
                  timestamp: new Date(Date.now() - 86200000).toISOString(),
                },
              ];

        return res.json({
          success: true,
          data: demoMessages,
        });
      }

      const { data: messages, error } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('id, role, content, timestamp')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) {
        logger.error('Error fetching conversation details:', error);
        throw error;
      }

      if (!messages || messages.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const conversation = {
        session_id: sessionId,
        message_count: messages.length,
        first_message_timestamp: messages[0].timestamp,
        last_message_timestamp: messages[messages.length - 1].timestamp,
        messages: messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      };

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      logger.error('Admin bypass conversation details error:', error);
      next(error);
    }
  }
);

// Get conversion metrics (new improved version with quantities)
router.get(
  '/analytics/conversion-new',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);

      logger.info('Analyzing chat conversions with new service', {
        shop: shop as string,
        daysBack: daysCount,
      });

      // Use new chat conversions service
      const metrics = await chatConversionsService.analyzeConversions(
        shop as string,
        daysCount
      );

      return res.json({
        success: true,
        data: {
          totalConversations: metrics.totalConversations,
          totalConversions: metrics.totalConversions,
          conversionRate: metrics.conversionRate,
          totalOrdersCount: metrics.totalOrdersCount,
          averageOrderQuantity: metrics.averageOrderQuantity,
          averageTimeToConversion: metrics.averageTimeToConversion,
          period: `${daysCount} días`,
        },
      });
    } catch (error) {
      logger.error('Error analyzing chat conversions (new):', error);
      return res.status(500).json({
        success: false,
        error: 'Error analyzing conversions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get conversion metrics (chat to sales) - Legacy endpoint
router.get(
  '/analytics/conversion',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Get chat sessions from the period
      const { data: chatSessions, error: chatError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, timestamp, content, metadata')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('session_id', 'is', null)
        .eq('role', 'agent');

      if (chatError) {
        logger.error('Error fetching chat sessions:', chatError);
        return res.json({
          success: true,
          data: {
            conversionRate: 0,
            totalConversations: 0,
            conversionsCount: 0,
            revenueAttributed: 0,
            averageConversionTime: 0,
          },
        });
      }

      // Group by session and extract mentioned products
      const sessionProducts = new Map();
      const sessionTimes = new Map();

      if (chatSessions) {
        chatSessions.forEach((message: any) => {
          const sessionId = message.session_id;
          const timestamp = new Date(message.timestamp);

          if (!sessionTimes.has(sessionId)) {
            sessionTimes.set(sessionId, timestamp);
          }

          // Extract mentioned products from content
          const mentionedProducts = extractProductsFromMessage(
            message.content,
            message.metadata
          );
          if (mentionedProducts.length > 0) {
            if (!sessionProducts.has(sessionId)) {
              sessionProducts.set(sessionId, new Set());
            }
            mentionedProducts.forEach(productId => {
              sessionProducts.get(sessionId).add(productId);
            });
          }
        });
      }

      // Get orders from the same period + 48h buffer
      const extendedEndDate = new Date(endDate);
      extendedEndDate.setHours(extendedEndDate.getHours() + 48);

      let orders = [];
      let conversions = 0;
      let totalRevenue = 0;
      let conversionTimes = [];

      try {
        const store = await supabaseService.getStore(shop as string);
        if (store) {
          const shopifyService = new ShopifyService();
          orders = await shopifyService.getOrdersByDateRange(
            store.shop_domain,
            store.access_token,
            startDate.toISOString(),
            extendedEndDate.toISOString()
          );

          // Analyze conversions
          orders.forEach((order: any) => {
            const orderTime = new Date(order.created_at);

            // Check if this order has products mentioned in chat sessions within 48h before order
            sessionProducts.forEach((productIds, sessionId) => {
              const sessionTime = sessionTimes.get(sessionId);
              if (!sessionTime) return;

              const timeDiff = orderTime.getTime() - sessionTime.getTime();
              const hoursAfterChat = timeDiff / (1000 * 60 * 60);

              // Check if order was within 48 hours of chat session
              if (hoursAfterChat >= 0 && hoursAfterChat <= 48) {
                // Check if any order line items match mentioned products
                const orderProductIds =
                  order.line_items
                    ?.map(
                      (item: any) =>
                        item.variant?.product_id?.toString() ||
                        item.product_id?.toString()
                    )
                    .filter(Boolean) || [];

                const hasMatchingProduct = orderProductIds.some(
                  (orderProductId: string) =>
                    Array.from(productIds).includes(orderProductId)
                );

                if (hasMatchingProduct) {
                  conversions++;
                  totalRevenue += parseFloat(order.total_price || '0');
                  conversionTimes.push(hoursAfterChat);
                }
              }
            });
          });
        }
      } catch (error) {
        logger.error('Error analyzing conversions:', error);
      }

      const totalSessions = sessionProducts.size;
      const conversionRate =
        totalSessions > 0 ? (conversions / totalSessions) * 100 : 0;
      const averageConversionTime =
        conversionTimes.length > 0
          ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
          : 0;

      res.json({
        success: true,
        data: {
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalConversations: totalSessions,
          conversionsCount: conversions,
          revenueAttributed: Math.round(totalRevenue * 100) / 100,
          averageConversionTime: Math.round(averageConversionTime * 100) / 100,
          period_days: daysCount,
        },
      });
    } catch (error) {
      logger.error('Admin bypass conversion analytics error:', error);
      res.json({
        success: true,
        data: {
          conversionRate: 0,
          totalConversations: 0,
          conversionsCount: 0,
          revenueAttributed: 0,
          averageConversionTime: 0,
        },
      });
    }
  }
);

// Get analytics/top-recommended-products
router.get(
  '/analytics/top-recommended-products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Get mentioned products from chat messages
      const { data: chatMessages, error: chatError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, content, metadata, timestamp')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('content', 'is', null)
        .eq('role', 'agent');

      if (chatError) throw chatError;

      // Extract and count product recommendations
      const productCounts: {
        [productId: string]: { count: number; details?: any };
      } = {};

      if (chatMessages) {
        const productDetailsMap = new Map<string, any>();

        for (const message of chatMessages) {
          const products = extractProductsFromMessage(
            message.content || '',
            message.metadata
          );
          extractProductDetailsFromMessage(
            message.content || '',
            message.metadata,
            productDetailsMap
          );

          for (const productId of products) {
            if (!productCounts[productId]) {
              productCounts[productId] = { count: 0 };
            }
            productCounts[productId].count++;

            // Store product details if found
            const productDetail = productDetailsMap.get(productId);
            if (productDetail && !productCounts[productId].details) {
              productCounts[productId].details = productDetail;
            }
          }
        }
      }

      // Get top 10 products and enrich with database info
      const topProductIds = Object.entries(productCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([productId, data]) => ({ productId, ...data }));

      // Get complete product details from database
      const productIds = topProductIds.map(item => item.productId);
      const { data: dbProducts, error: dbError } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select('id, title, handle, vendor, product_type, images')
        .in('id', productIds);

      if (dbError) {
        logger.error('Error fetching product details from database:', dbError);
      }

      // Create enriched products with database data
      const enrichedProducts = topProductIds.map(item => {
        const dbProduct = dbProducts?.find(
          p => p.id.toString() === item.productId
        );

        // Extract first image from images array
        let productImage = '';
        if (
          dbProduct?.images &&
          Array.isArray(dbProduct.images) &&
          dbProduct.images.length > 0
        ) {
          productImage =
            dbProduct.images[0]?.src ||
            dbProduct.images[0]?.url ||
            dbProduct.images[0];
        }

        return {
          productId: item.productId,
          recommendations: item.count,
          title:
            dbProduct?.title ||
            item.details?.title ||
            `Producto ${item.productId}`,
          handle: dbProduct?.handle || item.details?.handle || '',
          image: productImage || item.details?.image || '',
          price: item.details?.price || 0, // Remove price from DB as it's not in select
          vendor: dbProduct?.vendor || item.details?.vendor || '',
          productType:
            dbProduct?.product_type || item.details?.productType || 'Producto',
        };
      });

      res.json({
        success: true,
        data: {
          products: enrichedProducts,
          period: `${daysCount} días`,
          totalRecommendations: Object.values(productCounts).reduce(
            (sum, item) => sum + item.count,
            0
          ),
        },
      });
    } catch (error) {
      logger.error('Admin bypass top recommended products error:', error);
      next(error);
    }
  }
);

// Get product performance analysis (mentioned vs sold) - legacy endpoint
router.get(
  '/analytics/products-performance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Get mentioned products from chat messages
      const { data: chatSessions, error: chatError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, content, metadata')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('session_id', 'is', null)
        .eq('role', 'agent');

      const productMentions = new Map();
      const productDetails = new Map();

      if (chatSessions) {
        chatSessions.forEach((message: any) => {
          const mentionedProducts = extractProductsFromMessage(
            message.content,
            message.metadata
          );

          // Also extract product details from JSON for titles
          extractProductDetailsFromMessage(
            message.content,
            message.metadata,
            productDetails
          );

          mentionedProducts.forEach(productId => {
            productMentions.set(
              productId,
              (productMentions.get(productId) || 0) + 1
            );
          });
        });
      }

      // Get sales data for the same period
      const productSales = new Map();
      let totalRevenue = 0;

      try {
        const store = await supabaseService.getStore(shop as string);
        if (store) {
          const shopifyService = new ShopifyService();
          const orders = await shopifyService.getOrdersByDateRange(
            store.shop_domain,
            store.access_token,
            startDate.toISOString(),
            endDate.toISOString()
          );

          orders.forEach((order: any) => {
            totalRevenue += parseFloat(order.total_price || '0');

            order.line_items?.forEach((item: any) => {
              const productId = (
                item.variant?.product_id || item.product_id
              )?.toString();
              if (productId) {
                const currentSales = productSales.get(productId) || {
                  quantity: 0,
                  revenue: 0,
                };
                currentSales.quantity += parseInt(item.quantity || '0');
                currentSales.revenue +=
                  parseFloat(item.price || '0') *
                  parseInt(item.quantity || '0');
                productSales.set(productId, currentSales);

                // Store product name if available
                if (item.title && !productDetails.has(productId)) {
                  productDetails.set(productId, { title: item.title });
                }
              }
            });
          });
        }
      } catch (error) {
        logger.error('Error fetching product sales:', error);
      }

      // Combine mentioned and sold data
      const allProductIds = new Set([
        ...productMentions.keys(),
        ...productSales.keys(),
      ]);

      const productAnalysis = Array.from(allProductIds)
        .map(productId => {
          const mentions = productMentions.get(productId) || 0;
          const sales = productSales.get(productId) || {
            quantity: 0,
            revenue: 0,
          };
          const details = productDetails.get(productId) || {};

          // Calculate gap percentage
          const gapPercentage =
            mentions > 0 && sales.quantity === 0
              ? -100
              : mentions === 0 && sales.quantity > 0
                ? 100
                : mentions > 0
                  ? Math.round(((sales.quantity - mentions) / mentions) * 100)
                  : 0;

          return {
            productId,
            title: details.title || `Product ${productId}`,
            mentions,
            salesQuantity: sales.quantity,
            salesRevenue: sales.revenue,
            gapPercentage,
            conversionRate:
              mentions > 0 ? (sales.quantity / mentions) * 100 : 0,
          };
        })
        .filter(item => item.mentions > 0 || item.salesQuantity > 0) // Only show products with activity
        .sort(
          (a, b) =>
            b.mentions + b.salesQuantity - (a.mentions + a.salesQuantity)
        ) // Sort by total activity
        .slice(0, 20); // Top 20 products

      // Calculate summary metrics
      const totalMentions = Array.from(productMentions.values()).reduce(
        (sum, count) => sum + count,
        0
      );
      const totalSalesQuantity = Array.from(productSales.values()).reduce(
        (sum, sales) => sum + sales.quantity,
        0
      );
      const averageConversionRate =
        productAnalysis.length > 0
          ? productAnalysis.reduce(
              (sum, item) => sum + item.conversionRate,
              0
            ) / productAnalysis.length
          : 0;

      res.json({
        success: true,
        data: {
          products: productAnalysis,
          summary: {
            totalMentions,
            totalSalesQuantity,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            averageConversionRate:
              Math.round(averageConversionRate * 100) / 100,
            analyzedProducts: productAnalysis.length,
          },
          period_days: daysCount,
        },
      });
    } catch (error) {
      logger.error('Admin bypass product performance error:', error);
      res.json({
        success: true,
        data: {
          products: [],
          summary: {
            totalMentions: 0,
            totalSalesQuantity: 0,
            totalRevenue: 0,
            averageConversionRate: 0,
            analyzedProducts: 0,
          },
        },
      });
    }
  }
);

// Get analytics data for charts (conversations + sales)
router.get(
  '/analytics/chart',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // logger.info('Admin bypass: Getting analytics chart data', { shop, days });

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Initialize daily data map
      const dailyDataMap = new Map();
      for (let i = 0; i < daysCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        dailyDataMap.set(dateKey, {
          date: dateKey,
          conversations: 0,
          sales: 0,
          orders_count: 0,
        });
      }

      // Get conversations data using pagination to get all records
      try {
        // First get exact count for the date range
        const { count: totalCount } = await (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .not('session_id', 'is', null);

        // Fetch all messages in batches if needed
        const chatMessages = [];
        if (totalCount && totalCount > 1000) {
          const batchSize = 1000;
          const totalBatches = Math.ceil(totalCount / batchSize);

          for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = start + batchSize - 1;

            const { data: batch, error: batchError } = await (supabaseService as any).serviceClient
              .from('chat_messages')
              .select('session_id, timestamp')
              .gte('timestamp', startDate.toISOString())
              .lte('timestamp', endDate.toISOString())
              .not('session_id', 'is', null)
              .range(start, end)
              .order('timestamp', { ascending: false });

            if (batchError) {
              logger.error(`Error fetching chart batch ${i + 1}:`, batchError);
              break;
            }

            if (batch) {
              chatMessages.push(...batch);
            }
          }
        } else {
          // For smaller datasets, use normal query
          const { data: messages, error: chatError } = await (supabaseService as any).serviceClient
            .from('chat_messages')
            .select('session_id, timestamp')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .not('session_id', 'is', null);

          if (chatError) {
            throw chatError;
          }
          if (messages) chatMessages.push(...messages);
        }

        if (chatMessages && chatMessages.length > 0) {
          // FIXED: Find the first message timestamp for each session (conversation start date)
          // This ensures we count conversations on the date they actually started
          const sessionFirstMessages = new Map();

          // Find the earliest message for each session
          chatMessages.forEach((msg: any) => {
            const sessionId = msg.session_id;
            const timestamp = new Date(msg.timestamp);

            if (
              !sessionFirstMessages.has(sessionId) ||
              timestamp < sessionFirstMessages.get(sessionId)
            ) {
              sessionFirstMessages.set(sessionId, timestamp);
            }
          });

          // Count conversations by their start date
          const conversationsByStartDate = new Map();
          sessionFirstMessages.forEach((firstMessageDate, sessionId) => {
            const dateKey = firstMessageDate.toISOString().split('T')[0];
            if (!conversationsByStartDate.has(dateKey)) {
              conversationsByStartDate.set(dateKey, 0);
            }
            conversationsByStartDate.set(
              dateKey,
              conversationsByStartDate.get(dateKey) + 1
            );
          });

          // Update daily data map with correct conversation counts
          conversationsByStartDate.forEach((count, dateKey) => {
            if (dailyDataMap.has(dateKey)) {
              dailyDataMap.get(dateKey).conversations = count;
            }
          });

          logger.info('Analytics chart conversations calculated', {
            totalSessions: sessionFirstMessages.size,
            totalMessagesAnalyzed: chatMessages.length,
            dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            conversationsByDate: Array.from(
              conversationsByStartDate.entries()
            ).map(([date, count]) => ({ date, count })),
          });
        }
      } catch (error) {
        logger.error('Error fetching conversation data:', error);
      }

      // Get sales data
      try {
        // Get store credentials
        const store = await supabaseService.getStore(shop as string);

        if (store) {
          const shopifyService = new ShopifyService();

          try {
            // Query orders from Shopify
            const orders = await shopifyService.getOrdersByDateRange(
              store.shop_domain,
              store.access_token,
              startDate.toISOString(),
              endDate.toISOString()
            );

            // Process orders
            orders.forEach((order: any) => {
              const orderDate = new Date(order.created_at)
                .toISOString()
                .split('T')[0];
              const orderTotal = parseFloat(order.total_price || '0');

              if (dailyDataMap.has(orderDate)) {
                const dayData = dailyDataMap.get(orderDate);
                dayData.sales += orderTotal;
                dayData.orders_count += 1;
              }
            });
          } catch (shopifyError) {
            logger.error('Error fetching orders from Shopify:', shopifyError);

            // Generate demo sales data when Shopify is unavailable
            const demoSales = generateDemoSalesData();
            demoSales.daily_sales.forEach((daySale: any) => {
              if (dailyDataMap.has(daySale.date)) {
                const dayData = dailyDataMap.get(daySale.date);
                dayData.sales = parseFloat(daySale.total_sales);
                dayData.orders_count = daySale.orders_count;
              }
            });
          }
        }
      } catch (error) {
        logger.error('Error fetching sales data:', error);
      }

      // Convert to array and sort by date
      const chartData = Array.from(dailyDataMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate totals
      const totalConversations = chartData.reduce(
        (sum, day) => sum + day.conversations,
        0
      );
      const totalSales = chartData.reduce((sum, day) => sum + day.sales, 0);
      const totalOrders = chartData.reduce(
        (sum, day) => sum + day.orders_count,
        0
      );

      // Only use demo data for conversations if there are no real conversations
      // Always try to use real sales data from Shopify
      if (totalConversations === 0 && totalSales === 0 && totalOrders === 0) {
        // Generate demo conversations but keep real sales data structure
        const demoConversations = generateDemoConversationsData(daysCount);

        // Merge demo conversations with real (empty) sales data
        chartData.forEach((day, index) => {
          if (demoConversations[index]) {
            day.conversations = demoConversations[index].conversations;
          }
        });

        // Recalculate totals
        const newTotalConversations = chartData.reduce(
          (sum, day) => sum + day.conversations,
          0
        );

        return res.json({
          success: true,
          data: {
            daily_data: chartData,
            totals: {
              conversations: newTotalConversations,
              sales: totalSales,
              orders: totalOrders,
              average_order: totalOrders > 0 ? totalSales / totalOrders : 0,
            },
            period_days: daysCount,
          },
        });
      }

      res.json({
        success: true,
        data: {
          daily_data: chartData,
          totals: {
            conversations: totalConversations,
            sales: totalSales,
            orders: totalOrders,
            average_order: totalOrders > 0 ? totalSales / totalOrders : 0,
          },
          period_days: daysCount,
        },
      });
    } catch (error) {
      logger.error('Admin bypass analytics chart error:', error);

      // Return demo data on error
      const demoData = generateDemoAnalyticsData(
        parseInt(req.query.days as string) || 30
      );
      res.json({
        success: true,
        data: demoData,
      });
    }
  }
);

// Get sales chart data (legacy endpoint - kept for compatibility)
router.get(
  '/sales/chart',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Admin bypass: Getting sales chart data');

      // Get shop from database (assuming there's at least one shop)
      const shopsQuery = await (supabaseService as any).serviceClient
        .from('shops')
        .select('shop_domain, access_token')
        .limit(1)
        .single();

      if (shopsQuery.error || !shopsQuery.data) {
        logger.warn('No shop found for sales data');
        return res.json({
          success: false,
          message: 'No hay tienda configurada',
        });
      }

      const shopifyService = new ShopifyService();

      // Get sales data from last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      try {
        // Query orders from Shopify
        const orders = await shopifyService.getOrdersByDateRange(
          shopsQuery.data.shop_domain,
          shopsQuery.data.access_token,
          startDate.toISOString(),
          endDate.toISOString()
        );

        logger.info('Retrieved orders:', { count: orders.length });

        // Process orders to create daily sales data
        const dailySalesMap = new Map();
        let totalAmount = 0;
        let totalOrders = 0;

        // Initialize all days with 0 sales
        for (let i = 0; i < 30; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateKey = date.toISOString().split('T')[0];
          dailySalesMap.set(dateKey, {
            date: dateKey,
            total_sales: '0',
            orders_count: 0,
          });
        }

        // Process actual orders
        orders.forEach((order: any) => {
          const orderDate = new Date(order.created_at)
            .toISOString()
            .split('T')[0];
          const orderTotal = parseFloat(order.total_price || '0');

          if (dailySalesMap.has(orderDate)) {
            const dayData = dailySalesMap.get(orderDate);
            dayData.total_sales = (
              parseFloat(dayData.total_sales) + orderTotal
            ).toFixed(2);
            dayData.orders_count += 1;
          }

          totalAmount += orderTotal;
          totalOrders += 1;
        });

        const dailySales = Array.from(dailySalesMap.values()).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const averageOrder = totalOrders > 0 ? totalAmount / totalOrders : 0;

        res.json({
          success: true,
          data: {
            daily_sales: dailySales,
            total_amount: totalAmount,
            total_orders: totalOrders,
            average_order: averageOrder,
          },
        });
      } catch (shopifyError) {
        logger.error('Error fetching orders from Shopify:', shopifyError);

        // Return demo data when Shopify is unavailable
        const demoData = generateDemoSalesData();
        res.json({
          success: true,
          data: demoData,
        });
      }
    } catch (error) {
      logger.error('Admin bypass sales chart error:', error);

      // Return demo data on any error
      const demoData = generateDemoSalesData();
      res.json({
        success: true,
        data: demoData,
      });
    }
  }
);

// Helper function to generate demo conversations data only
function generateDemoConversationsData(days: number = 30) {
  const conversationsData = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic conversation patterns
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseConversations = isWeekend ? 2 : 8;
    const conversations = Math.max(
      0,
      baseConversations + Math.floor(Math.random() * 5) - 2
    );

    conversationsData.push({
      conversations: conversations,
    });
  }

  return conversationsData;
}

// Helper function to generate demo analytics data (fallback only)
function generateDemoAnalyticsData(days: number = 30) {
  const dailyData = [];
  const today = new Date();
  let totalConversations = 0;
  let totalSales = 0;
  let totalOrders = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    // Generate random data with realistic patterns
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Conversations: more on weekdays, fewer on weekends
    const baseConversations = isWeekend ? 2 : 8;
    const conversations = Math.max(
      0,
      baseConversations + Math.floor(Math.random() * 5) - 2
    );

    // Sales: higher on weekends typically
    const baseSales = isWeekend ? 800 : 1200;
    const salesVariation = (Math.random() - 0.5) * 600;
    const sales = Math.max(0, baseSales + salesVariation);

    const orders = Math.floor(sales / 150) + Math.floor(Math.random() * 3);

    totalConversations += conversations;
    totalSales += sales;
    totalOrders += orders;

    dailyData.push({
      date: dateKey,
      conversations: conversations,
      sales: Number(sales.toFixed(2)),
      orders_count: orders,
    });
  }

  return {
    daily_data: dailyData,
    totals: {
      conversations: totalConversations,
      sales: Number(totalSales.toFixed(2)),
      orders: totalOrders,
      average_order: totalOrders > 0 ? totalSales / totalOrders : 0,
    },
    period_days: days,
  };
}

// Helper function to generate demo sales data
function generateDemoSalesData() {
  const dailySales = [];
  const today = new Date();
  let totalAmount = 0;
  const totalOrders = Math.floor(Math.random() * 100) + 50;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    // Generate random sales data with some pattern
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseAmount = isWeekend ? 800 : 1200;
    const randomVariation = (Math.random() - 0.5) * 600;
    const dailyAmount = Math.max(0, baseAmount + randomVariation);

    totalAmount += dailyAmount;

    dailySales.push({
      date: dateKey,
      total_sales: dailyAmount.toFixed(2),
      orders_count:
        Math.floor(dailyAmount / 150) + Math.floor(Math.random() * 3),
    });
  }

  return {
    daily_sales: dailySales,
    total_amount: totalAmount,
    total_orders: totalOrders,
    average_order: totalOrders > 0 ? totalAmount / totalOrders : 0,
  };
}

// Helper function to extract product IDs from chat messages
function extractProductsFromMessage(content: string, metadata: any): string[] {
  const productIds = new Set<string>();

  try {
    // Extract from metadata if available
    if (metadata) {
      if (metadata.recommended_products) {
        metadata.recommended_products.forEach((product: any) => {
          if (product.id) {
            productIds.add(product.id.toString());
          }
        });
      }
      if (metadata.products) {
        metadata.products.forEach((product: any) => {
          if (product.id) {
            productIds.add(product.id.toString());
          }
        });
      }
    }

    if (content) {
      // Extract from JSON patterns in content
      const jsonRegex = /\{\s*"output"\s*:\s*\[[^\]]*\]\s*\}/g;
      const matches = content.match(jsonRegex);

      if (matches) {
        matches.forEach(match => {
          try {
            const jsonData = JSON.parse(match);
            if (jsonData.output && Array.isArray(jsonData.output)) {
              jsonData.output.forEach((item: any) => {
                if (item.product && item.product.id) {
                  productIds.add(item.product.id.toString());
                }
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        });
      }

      // Extract simple product ID patterns
      const simpleJsonRegex = /\{\s*"id"\s*:\s*(\d+)[^}]*\}/g;
      const simpleMatches = content.match(simpleJsonRegex);

      if (simpleMatches) {
        simpleMatches.forEach(match => {
          try {
            const productData = JSON.parse(match);
            if (productData.id) {
              productIds.add(productData.id.toString());
            }
          } catch (e) {
            // Ignore parsing errors
          }
        });
      }

      // Extract product_id mentions
      const productIdRegex = /product[_-]?id["\s]*:?\s*["']?(\d+)["']?/gi;
      const idMatches = content.matchAll(productIdRegex);
      for (const match of idMatches) {
        if (match[1]) {
          productIds.add(match[1]);
        }
      }
    }
  } catch (error) {
    // Ignore extraction errors
  }

  return Array.from(productIds);
}

// Helper function to extract product details from chat messages
function extractProductDetailsFromMessage(
  content: string,
  metadata: any,
  productDetailsMap: Map<string, any>
) {
  try {
    // Extract from metadata if available
    if (metadata) {
      if (metadata.recommended_products) {
        metadata.recommended_products.forEach((product: any) => {
          if (product.id) {
            productDetailsMap.set(product.id.toString(), {
              title: product.title || product.name || `Product ${product.id}`,
              price: product.price,
              handle: product.handle,
            });
          }
        });
      }
      if (metadata.products) {
        metadata.products.forEach((product: any) => {
          if (product.id) {
            productDetailsMap.set(product.id.toString(), {
              title: product.title || product.name || `Product ${product.id}`,
              price: product.price,
              handle: product.handle,
            });
          }
        });
      }
    }

    if (content) {
      // Extract from JSON patterns in content
      const jsonRegex = /\{\s*"output"\s*:\s*\[[^\]]*\]\s*\}/g;
      const matches = content.match(jsonRegex);

      if (matches) {
        matches.forEach(match => {
          try {
            const jsonData = JSON.parse(match);
            if (jsonData.output && Array.isArray(jsonData.output)) {
              jsonData.output.forEach((item: any) => {
                if (item.product && item.product.id) {
                  productDetailsMap.set(item.product.id.toString(), {
                    title: item.product.title || `Product ${item.product.id}`,
                    price: item.product.price,
                    handle: item.product.handle,
                  });
                }
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        });
      }

      // Extract simple product data
      const simpleJsonRegex =
        /\{\s*"id"\s*:\s*(\d+)[^}]*"title"\s*:\s*"([^"]*)"[^}]*\}/g;
      let match;
      while ((match = simpleJsonRegex.exec(content)) !== null) {
        try {
          const productData = JSON.parse(match[0]);
          if (productData.id && productData.title) {
            productDetailsMap.set(productData.id.toString(), {
              title: productData.title,
              price: productData.price,
              handle: productData.handle,
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  } catch (error) {
    // Ignore extraction errors
  }
}

// Get comprehensive product metrics for admin dashboard
router.get(
  '/metrics/products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      // Get all agent messages from the period
      const { data: chatMessages, error: chatError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, content, metadata, timestamp')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('content', 'is', null)
        .eq('role', 'agent')
        .order('timestamp', { ascending: false });

      if (chatError) {
        logger.error(
          'Error fetching chat messages for product metrics:',
          chatError
        );
        return res.json({
          success: true,
          data: {
            topRecommendedProducts: [],
            productMetrics: {
              totalUniqueProducts: 0,
              totalRecommendations: 0,
              averageRecommendationsPerProduct: 0,
              topProductScore: 0,
            },
            trendingProducts: [],
            productCategories: [],
            sentimentAnalysis: {
              positive: 0,
              neutral: 0,
              negative: 0,
            },
          },
        });
      }

      // Enhanced product extraction and analysis
      const productCounts: {
        [productId: string]: {
          count: number;
          details?: any;
          sessions: Set<string>;
          timestamps: Date[];
          sentimentScore: number;
        };
      } = {};
      const productDetailsMap = new Map<string, any>();
      const categoryAnalysis = new Map<string, number>();
      const sentimentStats = { positive: 0, neutral: 0, negative: 0 };

      if (chatMessages) {
        for (const message of chatMessages) {
          // Extract products with enhanced algorithm
          const products = extractProductsFromMessageEnhanced(
            message.content || '',
            message.metadata
          );

          // Extract product details
          extractProductDetailsFromMessage(
            message.content || '',
            message.metadata,
            productDetailsMap
          );

          // Analyze sentiment of the message
          const sentiment = analyzeMessageSentiment(message.content || '');
          sentimentStats[sentiment]++;

          // Process each product found
          for (const productId of products) {
            if (!productCounts[productId]) {
              productCounts[productId] = {
                count: 0,
                sessions: new Set(),
                timestamps: [],
                sentimentScore: 0,
              };
            }

            productCounts[productId].count++;
            productCounts[productId].sessions.add(message.session_id);
            productCounts[productId].timestamps.push(
              new Date(message.timestamp)
            );
            productCounts[productId].sentimentScore +=
              sentiment === 'positive' ? 1 : sentiment === 'negative' ? -1 : 0;

            // Store product details if found
            const productDetail = productDetailsMap.get(productId);
            if (productDetail && !productCounts[productId].details) {
              productCounts[productId].details = productDetail;

              // Analyze categories
              const category = productDetail.productType || 'Sin categoría';
              categoryAnalysis.set(
                category,
                (categoryAnalysis.get(category) || 0) + 1
              );
            }
          }
        }
      }

      // Get top products with enriched database info
      const topProductIds = Object.entries(productCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 20) // Increased from 10 to 20
        .map(([productId, data]) => ({ productId, ...data }));

      // Get complete product details from database
      const productIds = topProductIds.map(item => item.productId);
      const { data: dbProducts, error: dbError } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select('id, title, handle, vendor, product_type, images, created_at')
        .in('id', productIds);

      if (dbError) {
        logger.error('Error fetching product details from database:', dbError);
      }

      // Create enriched products with advanced metrics
      const enrichedProducts = topProductIds.map(item => {
        const dbProduct = dbProducts?.find(
          p => p.id.toString() === item.productId
        );

        // Extract first image from images array
        let productImage = '';
        if (
          dbProduct?.images &&
          Array.isArray(dbProduct.images) &&
          dbProduct.images.length > 0
        ) {
          productImage =
            dbProduct.images[0]?.src ||
            dbProduct.images[0]?.url ||
            dbProduct.images[0];
        }

        // Calculate advanced metrics
        const uniqueSessions = item.sessions.size;
        const averageRecommendationsPerSession = item.count / uniqueSessions;
        const recentActivity = item.timestamps.filter(
          t => new Date().getTime() - t.getTime() < 7 * 24 * 60 * 60 * 1000
        ).length;
        const trendScore =
          recentActivity / Math.max(1, item.count - recentActivity);

        return {
          productId: item.productId,
          recommendations: item.count,
          uniqueSessions,
          averageRecommendationsPerSession:
            Math.round(averageRecommendationsPerSession * 100) / 100,
          recentActivity,
          trendScore: Math.round(trendScore * 100) / 100,
          sentimentScore: item.sentimentScore,
          title:
            dbProduct?.title ||
            item.details?.title ||
            `Producto ${item.productId}`,
          handle: dbProduct?.handle || item.details?.handle || '',
          image: productImage || item.details?.image || '',
          price: item.details?.price || 0,
          vendor: dbProduct?.vendor || item.details?.vendor || '',
          productType:
            dbProduct?.product_type || item.details?.productType || 'Producto',
          createdAt: dbProduct?.created_at || null,
          isNew: dbProduct?.created_at
            ? new Date().getTime() - new Date(dbProduct.created_at).getTime() <
              30 * 24 * 60 * 60 * 1000
            : false,
        };
      });

      // Calculate trending products (high recent activity)
      const trendingProducts = enrichedProducts
        .filter(p => p.recentActivity > 0)
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 5);

      // Product categories analysis
      const productCategories = Array.from(categoryAnalysis.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: Math.round((count / enrichedProducts.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate summary metrics
      const totalRecommendations = Object.values(productCounts).reduce(
        (sum, item) => sum + item.count,
        0
      );
      const totalUniqueProducts = Object.keys(productCounts).length;
      const averageRecommendationsPerProduct =
        totalUniqueProducts > 0
          ? totalRecommendations / totalUniqueProducts
          : 0;
      const topProductScore =
        enrichedProducts.length > 0 ? enrichedProducts[0].recommendations : 0;

      // Sentiment analysis percentages
      const totalMessages =
        sentimentStats.positive +
        sentimentStats.neutral +
        sentimentStats.negative;
      const sentimentPercentages = {
        positive:
          totalMessages > 0
            ? Math.round((sentimentStats.positive / totalMessages) * 100)
            : 0,
        neutral:
          totalMessages > 0
            ? Math.round((sentimentStats.neutral / totalMessages) * 100)
            : 0,
        negative:
          totalMessages > 0
            ? Math.round((sentimentStats.negative / totalMessages) * 100)
            : 0,
      };

      res.json({
        success: true,
        data: {
          topRecommendedProducts: enrichedProducts,
          productMetrics: {
            totalUniqueProducts,
            totalRecommendations,
            averageRecommendationsPerProduct:
              Math.round(averageRecommendationsPerProduct * 100) / 100,
            topProductScore,
          },
          trendingProducts,
          productCategories,
          sentimentAnalysis: sentimentPercentages,
          period: `${daysCount} días`,
        },
      });
    } catch (error) {
      logger.error('Admin bypass product metrics error:', error);
      res.json({
        success: true,
        data: {
          topRecommendedProducts: [],
          productMetrics: {
            totalUniqueProducts: 0,
            totalRecommendations: 0,
            averageRecommendationsPerProduct: 0,
            topProductScore: 0,
          },
          trendingProducts: [],
          productCategories: [],
          sentimentAnalysis: {
            positive: 0,
            neutral: 0,
            negative: 0,
          },
        },
      });
    }
  }
);

// Enhanced product extraction function
function extractProductsFromMessageEnhanced(
  content: string,
  metadata: any
): string[] {
  const productIds = new Set<string>();

  try {
    // Use existing extraction function as base
    const basicIds = extractProductsFromMessage(content, metadata);
    basicIds.forEach(id => productIds.add(id));

    if (content) {
      // Enhanced patterns for better product detection

      // Look for product mentions in more contexts
      const productMentionPatterns = [
        /(?:recomiendo|sugiero|prueba|considera|te.*gust[ae].*|ideal.*para|perfecto.*para).*?(?:producto|crema|gel|bálsamo|emulsión|espuma).*?"([^"]+)"/gi,
        /\*\*([^*]+(?:crema|gel|bálsamo|emulsión|espuma|producto)[^*]*)\*\*/gi,
        /(?:el|la|este|esta)\s+([^.]+(?:crema|gel|bálsamo|emulsión|espuma|producto)[^.]*)/gi,
      ];

      productMentionPatterns.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 5 && match[1].length < 100) {
            // Create a pseudo-ID from the product name for tracking
            const pseudoId = `name_${match[1].toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            productIds.add(pseudoId);
          }
        }
      });

      // Look for variant_id mentions
      const variantIdRegex = /variant[_-]?id["\s]*:?\s*["']?(\d+)["']?/gi;
      const variantMatches = content.matchAll(variantIdRegex);
      for (const match of variantMatches) {
        if (match[1]) {
          productIds.add(`variant_${match[1]}`);
        }
      }

      // Look for handle mentions
      const handleRegex = /"handle"\s*:\s*"([^"]+)"/gi;
      const handleMatches = content.matchAll(handleRegex);
      for (const match of handleMatches) {
        if (match[1]) {
          productIds.add(`handle_${match[1]}`);
        }
      }
    }
  } catch (error) {
    // Ignore extraction errors
  }

  return Array.from(productIds);
}

// Simple sentiment analysis function
function analyzeMessageSentiment(
  content: string
): 'positive' | 'neutral' | 'negative' {
  const positiveWords = [
    'excelente',
    'perfecto',
    'genial',
    'ideal',
    'recomiendo',
    'me gusta',
    'fantástico',
    'increíble',
    'maravilloso',
  ];
  const negativeWords = [
    'problema',
    'error',
    'mal',
    'terrible',
    'horrible',
    'no funciona',
    'decepcionante',
    'malo',
  ];

  const lowerContent = content.toLowerCase();

  const positiveCount = positiveWords.filter(word =>
    lowerContent.includes(word)
  ).length;
  const negativeCount = negativeWords.filter(word =>
    lowerContent.includes(word)
  ).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Get approximate conversion estimation based on conversations and sales correlation
router.get(
  '/analytics/approximate-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysCount = parseInt(days as string);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);

      logger.info('Calculating approximate conversions', {
        shop: shop as string,
        daysBack: daysCount,
        dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      });

      // Get daily conversation data using existing pagination logic
      const { count: totalCount } = await (supabaseService as any).serviceClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('session_id', 'is', null);

      const chatMessages = [];
      if (totalCount && totalCount > 1000) {
        const batchSize = 1000;
        const totalBatches = Math.ceil(totalCount / batchSize);

        for (let i = 0; i < totalBatches; i++) {
          const start = i * batchSize;
          const end = start + batchSize - 1;

          const { data: batch, error: batchError } = await (supabaseService as any).serviceClient
            .from('chat_messages')
            .select('session_id, timestamp, role')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .not('session_id', 'is', null)
            .range(start, end)
            .order('timestamp', { ascending: false });

          if (batchError) {
            logger.error(`Error fetching batch ${i + 1}:`, batchError);
            break;
          }

          if (batch) {
            chatMessages.push(...batch);
          }
        }
      } else {
        const { data: messages, error: chatError } = await (supabaseService as any).serviceClient
          .from('chat_messages')
          .select('session_id, timestamp, role')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .not('session_id', 'is', null);

        if (chatError) throw chatError;
        if (messages) chatMessages.push(...messages);
      }

      // Group conversations by date
      const dailyConversations = new Map<string, Set<string>>();
      const sessionFirstMessages = new Map<string, Date>();

      chatMessages.forEach((msg: any) => {
        const sessionId = msg.session_id;
        const timestamp = new Date(msg.timestamp);

        if (!sessionFirstMessages.has(sessionId) || timestamp < sessionFirstMessages.get(sessionId)!) {
          sessionFirstMessages.set(sessionId, timestamp);
        }
      });

      sessionFirstMessages.forEach((firstMessageDate, sessionId) => {
        const dateKey = firstMessageDate.toISOString().split('T')[0];
        if (!dailyConversations.has(dateKey)) {
          dailyConversations.set(dateKey, new Set());
        }
        dailyConversations.get(dateKey)!.add(sessionId);
      });

      // Get sales data from Shopify
      const dailySales = new Map<string, { orders: number; revenue: number }>();
      
      try {
        const store = await supabaseService.getStore(shop as string);
        if (store) {
          const shopifyService = new ShopifyService();
          
          // Extend date range to capture sales that might be influenced by earlier conversations
          const extendedEndDate = new Date(endDate);
          extendedEndDate.setDate(extendedEndDate.getDate() + 2); // Add 2 day buffer
          
          const orders = await shopifyService.getOrdersByDateRange(
            store.shop_domain,
            store.access_token,
            startDate.toISOString(),
            extendedEndDate.toISOString()
          );

          orders.forEach((order: any) => {
            const orderDate = new Date(order.created_at).toISOString().split('T')[0];
            const orderValue = parseFloat(order.total_price || '0');
            
            if (!dailySales.has(orderDate)) {
              dailySales.set(orderDate, { orders: 0, revenue: 0 });
            }
            
            const dayData = dailySales.get(orderDate)!;
            dayData.orders += 1;
            dayData.revenue += orderValue;
          });
        }
      } catch (error) {
        logger.warn('Could not fetch Shopify sales data for approximation:', error);
      }

      // Calculate approximate conversions using multiple correlation methods
      const approximateConversions = calculateApproximateConversions(
        dailyConversations,
        dailySales,
        startDate,
        endDate
      );

      logger.info('Approximate conversions calculated', {
        totalConversations: Array.from(dailyConversations.values()).reduce((sum, sessions) => sum + sessions.size, 0),
        totalOrders: Array.from(dailySales.values()).reduce((sum, day) => sum + day.orders, 0),
        approximateConversions: approximateConversions.estimatedConversions,
        confidence: approximateConversions.confidence,
        method: approximateConversions.method,
      });

      res.json({
        success: true,
        data: {
          ...approximateConversions,
          period: `${daysCount} días`,
          totalConversations: Array.from(dailyConversations.values()).reduce((sum, sessions) => sum + sessions.size, 0),
          totalOrders: Array.from(dailySales.values()).reduce((sum, day) => sum + day.orders, 0),
          totalRevenue: Math.round(Array.from(dailySales.values()).reduce((sum, day) => sum + day.revenue, 0) * 100) / 100,
          dailyBreakdown: Array.from(dailyConversations.entries())
            .map(([date, sessions]) => {
              const salesData = dailySales.get(date) || { orders: 0, revenue: 0 };
              return {
                date,
                conversations: sessions.size,
                orders: salesData.orders,
                revenue: Math.round(salesData.revenue * 100) / 100,
              };
            })
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } catch (error) {
      logger.error('Error calculating approximate conversions:', error);
      res.status(500).json({
        success: false,
        error: 'Error calculating approximate conversions',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Calculate approximate conversions using correlation analysis between conversations and sales
 */
function calculateApproximateConversions(
  dailyConversations: Map<string, Set<string>>,
  dailySales: Map<string, { orders: number; revenue: number }>,
  startDate: Date,
  endDate: Date
) {
  const results = {
    estimatedConversions: 0,
    confidence: 0,
    method: 'correlation_analysis',
    details: {
      sameDay: 0,
      nextDay: 0,
      weekAverage: 0,
      correlationScore: 0,
    }
  };

  const allDates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    allDates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Method 1: Same day correlation (immediate conversions)
  let sameDayConversions = 0;
  let sameDayValidDays = 0;
  
  allDates.forEach(date => {
    const conversations = dailyConversations.get(date)?.size || 0;
    const orders = dailySales.get(date)?.orders || 0;
    
    if (conversations > 0) {
      sameDayValidDays++;
      // Assume a percentage of orders on days with conversations are chat-influenced
      sameDayConversions += Math.min(orders, Math.floor(conversations * 0.3)); // Conservative 30% same-day conversion
    }
  });

  results.details.sameDay = sameDayConversions;

  // Method 2: Next day correlation (delayed conversions)
  let nextDayConversions = 0;
  let nextDayValidDays = 0;

  allDates.forEach((date, index) => {
    if (index < allDates.length - 1) {
      const conversations = dailyConversations.get(date)?.size || 0;
      const nextDayOrders = dailySales.get(allDates[index + 1])?.orders || 0;
      
      if (conversations > 0 && nextDayOrders > 0) {
        nextDayValidDays++;
        // Assume a smaller percentage for next-day influence
        nextDayConversions += Math.min(nextDayOrders, Math.floor(conversations * 0.2)); // Conservative 20% next-day conversion
      }
    }
  });

  results.details.nextDay = nextDayConversions;

  // Method 3: Weekly average approach
  const totalConversations = Array.from(dailyConversations.values()).reduce((sum, sessions) => sum + sessions.size, 0);
  const totalOrders = Array.from(dailySales.values()).reduce((sum, day) => sum + day.orders, 0);
  
  let weeklyAverageConversions = 0;
  if (totalConversations > 0 && totalOrders > 0) {
    // Calculate conversation-to-order correlation
    const averageConversionRate = Math.min(0.25, totalOrders / totalConversations); // Cap at 25% conversion rate
    weeklyAverageConversions = Math.floor(totalConversations * averageConversionRate);
  }

  results.details.weekAverage = weeklyAverageConversions;

  // Method 4: Calculate correlation coefficient
  const correlationData = allDates.map(date => ({
    conversations: dailyConversations.get(date)?.size || 0,
    orders: dailySales.get(date)?.orders || 0,
  })).filter(day => day.conversations > 0 || day.orders > 0);

  let correlationScore = 0;
  if (correlationData.length > 2) {
    correlationScore = calculateCorrelation(
      correlationData.map(d => d.conversations),
      correlationData.map(d => d.orders)
    );
  }

  results.details.correlationScore = Math.round(correlationScore * 100) / 100;

  // Combine methods with weighted approach
  const weights = {
    sameDay: 0.4,
    nextDay: 0.3,
    weekAverage: 0.3,
  };

  results.estimatedConversions = Math.round(
    (results.details.sameDay * weights.sameDay) +
    (results.details.nextDay * weights.nextDay) +
    (results.details.weekAverage * weights.weekAverage)
  );

  // Calculate confidence based on data quality and correlation
  let confidence = 0;
  
  if (totalConversations > 10 && totalOrders > 0) {
    confidence += 30; // Base confidence for having data
  }
  
  if (correlationScore > 0.3) {
    confidence += 40; // Higher confidence for positive correlation
  } else if (correlationScore > 0) {
    confidence += 20;
  }
  
  if (sameDayValidDays > 3) {
    confidence += 20; // More confidence with more data points
  }
  
  if (nextDayValidDays > 2) {
    confidence += 10; // Additional confidence for delayed pattern
  }

  results.confidence = Math.min(confidence, 85); // Cap confidence at 85%

  return results;
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

export default router;
