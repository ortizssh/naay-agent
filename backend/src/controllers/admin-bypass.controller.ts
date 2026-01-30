import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { ShopifyService } from '@/services/shopify.service';
import { QueueService } from '@/services/queue.service';
import { ChatConversionsService } from '@/services/chat-conversions.service';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';
import { logger } from '@/utils/logger';
import { adminBypassRateLimit } from '@/middleware/rateLimiter';

const router = Router();
const supabaseService = new SupabaseService();
const shopifyService = new ShopifyService();
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
    const { count: totalHistoricalCount } = await (
      supabaseService as any
    ).serviceClient
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

        const { data: batch, error: batchError } = await (
          supabaseService as any
        ).serviceClient
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

      const messagesError =
        allMessages.length === 0 ? new Error('No messages fetched') : null;

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
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today

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
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today

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

// Get recommendations count filtered by period
router.get(
  '/analytics/recommendations-count',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 14 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map shop name if needed
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;
      const daysBack = parseInt(days as string) || 14;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      logger.info('Getting recommendations count', {
        shop: actualShop,
        daysBack,
        cutoffDate: cutoffDate.toISOString(),
      });

      // Get count from simple_recommendations table
      const { count, error } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', actualShop)
        .gte('recommended_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Error getting recommendations count:', error);
        throw error;
      }

      logger.info('Recommendations count retrieved', {
        shop: actualShop,
        count: count || 0,
        daysBack,
      });

      res.json({
        success: true,
        data: {
          count: count || 0,
          shop: actualShop,
          period: `${daysBack} days`,
          cutoffDate: cutoffDate.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Admin bypass recommendations count error:', error);
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
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today

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
      endDate.setHours(23, 59, 59, 999); // Include all of today
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today
      startDate.setHours(0, 0, 0, 0); // Start from beginning of the day

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
        const { count: totalCount } = await (
          supabaseService as any
        ).serviceClient
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

            const { data: batch, error: batchError } = await (
              supabaseService as any
            ).serviceClient
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
          const { data: messages, error: chatError } = await (
            supabaseService as any
          ).serviceClient
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
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today

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
      startDate.setDate(startDate.getDate() - daysCount + 1); // Include today

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

          const { data: batch, error: batchError } = await (
            supabaseService as any
          ).serviceClient
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
        const { data: messages, error: chatError } = await (
          supabaseService as any
        ).serviceClient
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

        if (
          !sessionFirstMessages.has(sessionId) ||
          timestamp < sessionFirstMessages.get(sessionId)!
        ) {
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
            const orderDate = new Date(order.created_at)
              .toISOString()
              .split('T')[0];
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
        logger.warn(
          'Could not fetch Shopify sales data for approximation:',
          error
        );
      }

      // Calculate approximate conversions using multiple correlation methods
      const approximateConversions = calculateApproximateConversions(
        dailyConversations,
        dailySales,
        startDate,
        endDate
      );

      logger.info('Approximate conversions calculated', {
        totalConversations: Array.from(dailyConversations.values()).reduce(
          (sum, sessions) => sum + sessions.size,
          0
        ),
        totalOrders: Array.from(dailySales.values()).reduce(
          (sum, day) => sum + day.orders,
          0
        ),
        approximateConversions: approximateConversions.estimatedConversions,
        confidence: approximateConversions.confidence,
        method: approximateConversions.method,
      });

      res.json({
        success: true,
        data: {
          ...approximateConversions,
          period: `${daysCount} días`,
          totalConversations: Array.from(dailyConversations.values()).reduce(
            (sum, sessions) => sum + sessions.size,
            0
          ),
          totalOrders: Array.from(dailySales.values()).reduce(
            (sum, day) => sum + day.orders,
            0
          ),
          totalRevenue:
            Math.round(
              Array.from(dailySales.values()).reduce(
                (sum, day) => sum + day.revenue,
                0
              ) * 100
            ) / 100,
          dailyBreakdown: Array.from(dailyConversations.entries())
            .map(([date, sessions]) => {
              const salesData = dailySales.get(date) || {
                orders: 0,
                revenue: 0,
              };
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
    },
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
        nextDayConversions += Math.min(
          nextDayOrders,
          Math.floor(conversations * 0.2)
        ); // Conservative 20% next-day conversion
      }
    }
  });

  results.details.nextDay = nextDayConversions;

  // Method 3: Weekly average approach
  const totalConversations = Array.from(dailyConversations.values()).reduce(
    (sum, sessions) => sum + sessions.size,
    0
  );
  const totalOrders = Array.from(dailySales.values()).reduce(
    (sum, day) => sum + day.orders,
    0
  );

  let weeklyAverageConversions = 0;
  if (totalConversations > 0 && totalOrders > 0) {
    // Calculate conversation-to-order correlation
    const averageConversionRate = Math.min(
      0.25,
      totalOrders / totalConversations
    ); // Cap at 25% conversion rate
    weeklyAverageConversions = Math.floor(
      totalConversations * averageConversionRate
    );
  }

  results.details.weekAverage = weeklyAverageConversions;

  // Method 4: Calculate correlation coefficient
  const correlationData = allDates
    .map(date => ({
      conversations: dailyConversations.get(date)?.size || 0,
      orders: dailySales.get(date)?.orders || 0,
    }))
    .filter(day => day.conversations > 0 || day.orders > 0);

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
    results.details.sameDay * weights.sameDay +
      results.details.nextDay * weights.nextDay +
      results.details.weekAverage * weights.weekAverage
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
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

// Product Analytics Bypass - for admin panel
router.get(
  '/products/recommended-analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 14, limit = 50 } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map frontend shop name to database shop name
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      const daysBack = parseInt(days as string) || 14;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);

      logger.info('Loading product analytics via bypass', {
        shop,
        actualShop,
        daysBack,
        limitNum,
      });

      // Get products that have been recommended by AI in the specified period
      const { data: allRecommendations, error: recError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('product_id, product_title, shop_domain, recommended_at')
        .eq('shop_domain', shop)
        .gte(
          'recommended_at',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('recommended_at', { ascending: false });

      // Group recommendations manually
      const recommendedProducts = [];
      if (allRecommendations && allRecommendations.length > 0) {
        const grouped = new Map();

        allRecommendations.forEach(rec => {
          const key = rec.product_id;
          if (!grouped.has(key)) {
            grouped.set(key, {
              product_id: rec.product_id,
              product_title: rec.product_title,
              shop_domain: rec.shop_domain,
              recommendation_count: 0,
              first_recommended: rec.recommended_at,
              last_recommended: rec.recommended_at,
            });
          }

          const existing = grouped.get(key);
          existing.recommendation_count++;

          if (
            new Date(rec.recommended_at) < new Date(existing.first_recommended)
          ) {
            existing.first_recommended = rec.recommended_at;
          }
          if (
            new Date(rec.recommended_at) > new Date(existing.last_recommended)
          ) {
            existing.last_recommended = rec.recommended_at;
          }
        });

        recommendedProducts.push(
          ...Array.from(grouped.values())
            .sort((a, b) => b.recommendation_count - a.recommendation_count)
            .slice(0, limitNum)
        );
      }

      if (recError) {
        logger.error('Error fetching recommended products:', recError);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch recommended products: ${recError.message}`,
        });
      }

      // Get conversion data for these products
      const productIds = (recommendedProducts || []).map(p => p.product_id);

      let conversionsData = [];
      if (productIds.length > 0) {
        const { data: allConversions, error: convError } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_conversions')
          .select(
            'product_id, order_amount, total_order_amount, minutes_to_conversion'
          )
          .eq('shop_domain', shop)
          .in('product_id', productIds)
          .gte(
            'purchased_at',
            new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
          );

        if (convError) {
          logger.warn('Error fetching conversion data:', convError);
        } else {
          // Group conversions manually
          const grouped = new Map();
          (allConversions || []).forEach(conv => {
            const key = conv.product_id;
            if (!grouped.has(key)) {
              grouped.set(key, {
                product_id: conv.product_id,
                conversion_count: 0,
                total_revenue: 0,
                total_time: 0,
                amounts: [],
              });
            }

            const existing = grouped.get(key);
            existing.conversion_count++;
            existing.total_revenue += parseFloat(
              conv.order_amount || conv.total_order_amount || 0
            );
            existing.total_time += parseFloat(conv.minutes_to_conversion || 0);
            existing.amounts.push(
              parseFloat(conv.order_amount || conv.total_order_amount || 0)
            );
          });

          conversionsData = Array.from(grouped.values()).map(item => ({
            product_id: item.product_id,
            conversion_count: item.conversion_count,
            total_revenue: item.total_revenue,
            avg_order_value:
              item.amounts.length > 0
                ? item.total_revenue / item.amounts.length
                : 0,
            avg_conversion_time:
              item.conversion_count > 0
                ? item.total_time / item.conversion_count
                : 0,
          }));
        }
      }

      // Combine recommendation and conversion data
      const analytics = (recommendedProducts || [])
        .map(product => {
          const conversionData =
            conversionsData.find(c => c.product_id === product.product_id) ||
            {};

          const conversionCount =
            parseInt(conversionData.conversion_count) || 0;
          const recommendationCount =
            parseInt(product.recommendation_count) || 0;
          const conversionRate =
            recommendationCount > 0
              ? (conversionCount / recommendationCount) * 100
              : 0;

          return {
            productId: product.product_id,
            productTitle: product.product_title,
            recommendations: recommendationCount,
            conversions: conversionCount,
            conversionRate: Math.round(conversionRate * 100) / 100,
            totalRevenue: parseFloat(conversionData.total_revenue) || 0,
            avgOrderValue: parseFloat(conversionData.avg_order_value) || 0,
            avgConversionTime:
              parseFloat(conversionData.avg_conversion_time) || 0,
            firstRecommended: product.first_recommended,
            lastRecommended: product.last_recommended,
            performance:
              conversionRate >= 15
                ? 'excellent'
                : conversionRate >= 8
                  ? 'good'
                  : conversionRate >= 3
                    ? 'fair'
                    : 'poor',
          };
        })
        .sort((a, b) => b.conversionRate - a.conversionRate);

      // Calculate summary stats
      const totalRecommendations = analytics.reduce(
        (sum, p) => sum + p.recommendations,
        0
      );
      const totalConversions = analytics.reduce(
        (sum, p) => sum + p.conversions,
        0
      );
      const totalRevenue = analytics.reduce(
        (sum, p) => sum + p.totalRevenue,
        0
      );
      const overallConversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;

      logger.info(`Product analytics loaded for shop: ${shop}`, {
        daysBack,
        productsAnalyzed: analytics.length,
        totalRecommendations,
        totalConversions,
        overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      });

      res.json({
        success: true,
        data: {
          products: analytics,
          summary: {
            totalProducts: analytics.length,
            totalRecommendations,
            totalConversions,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            overallConversionRate:
              Math.round(overallConversionRate * 100) / 100,
            avgOrderValue:
              totalConversions > 0
                ? Math.round((totalRevenue / totalConversions) * 100) / 100
                : 0,
          },
          period: {
            days: daysBack,
            startDate: new Date(
              Date.now() - daysBack * 24 * 60 * 60 * 1000
            ).toISOString(),
            endDate: new Date().toISOString(),
          },
        },
      });
    } catch (error: any) {
      logger.error('Error loading product analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Individual Product Analytics Bypass
router.get(
  '/products/:productId/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;
      const { productId } = req.params;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map frontend shop name to database shop name
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;
      const daysBack = parseInt(days as string) || 30;

      // Get basic product info from products table
      const { data: product, error: productError } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select('id, title, description, handle, vendor, product_type')
        .eq('shop_domain', shop)
        .eq('id', productId)
        .single();

      if (productError && productError.code === 'PGRST116') {
        // Product not found in products table, create minimal product info
        const productInfo = {
          id: productId,
          title: `Producto ${productId}`,
          description: null,
          handle: null,
          vendor: null,
          product_type: null,
        };
        logger.info('Product not found in products table, using minimal info', {
          productId,
          shop,
        });
      } else if (productError) {
        logger.error('Error fetching product info:', productError);
        return res.status(500).json({
          success: false,
          error: `Failed to fetch product: ${productError.message}`,
        });
      }

      // Get recommendation statistics
      const { data: recStats } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', shop)
        .eq('product_id', productId)
        .gte(
          'recommended_at',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('recommended_at', { ascending: false });

      // Get conversion statistics
      const { data: convStats } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shop)
        .eq('product_id', productId)
        .gte(
          'purchased_at',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('purchased_at', { ascending: false });

      // Calculate metrics
      const totalRecommendations = recStats?.length || 0;
      const totalConversions = convStats?.length || 0;
      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;
      const totalRevenue =
        convStats?.reduce(
          (sum, conv) => sum + (parseFloat(conv.total_amount) || 0),
          0
        ) || 0;
      const avgConversionTime =
        convStats?.length > 0
          ? convStats.reduce(
              (sum, conv) => sum + (conv.minutes_to_conversion || 0),
              0
            ) / convStats.length
          : 0;

      // Get timeline data (daily breakdown)
      const timelineData = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const dayRecommendations =
          recStats?.filter(rec => rec.recommended_at.startsWith(dateStr))
            .length || 0;

        const dayConversions =
          convStats?.filter(conv => conv.purchased_at.startsWith(dateStr))
            .length || 0;

        const dayRevenue =
          convStats
            ?.filter(conv => conv.purchased_at.startsWith(dateStr))
            .reduce(
              (sum, conv) => sum + (parseFloat(conv.total_amount) || 0),
              0
            ) || 0;

        timelineData.push({
          date: dateStr,
          recommendations: dayRecommendations,
          conversions: dayConversions,
          revenue: Math.round(dayRevenue * 100) / 100,
          conversionRate:
            dayRecommendations > 0
              ? Math.round((dayConversions / dayRecommendations) * 100 * 100) /
                100
              : 0,
        });
      }

      const productResult = product || {
        id: productId,
        title: `Producto ${productId}`,
        handle: null,
        vendor: null,
        product_type: null,
      };

      const analytics = {
        product: {
          id: productResult.id,
          title: productResult.title,
          handle: productResult.handle,
          vendor: productResult.vendor,
          productType: productResult.product_type,
        },
        summary: {
          totalRecommendations,
          totalConversions,
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgOrderValue:
            totalConversions > 0
              ? Math.round((totalRevenue / totalConversions) * 100) / 100
              : 0,
          avgConversionTime: Math.round(avgConversionTime * 10) / 10,
          performance:
            conversionRate >= 15
              ? 'excellent'
              : conversionRate >= 8
                ? 'good'
                : conversionRate >= 3
                  ? 'fair'
                  : 'poor',
        },
        timeline: timelineData,
        recentRecommendations: recStats?.slice(0, 10) || [],
        recentConversions: convStats?.slice(0, 10) || [],
        period: {
          days: daysBack,
          startDate: new Date(
            Date.now() - daysBack * 24 * 60 * 60 * 1000
          ).toISOString(),
          endDate: new Date().toISOString(),
        },
      };

      logger.info(`Individual product analytics retrieved for ${productId}`, {
        shop,
        productId,
        recommendations: totalRecommendations,
        conversions: totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      });

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      logger.error('Error loading individual product analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Debug endpoint to see what data we have
router.get(
  '/debug/simple-data',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get all recommendations without shop filter to see what we have (remove limit)
      const { data: allRecommendations, error: recError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('shop_domain, product_id, product_title, recommended_at')
        .order('recommended_at', { ascending: false });

      // Get all conversions (remove limit)
      const { data: allConversions, error: convError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('shop_domain, product_id, order_id, purchased_at')
        .order('purchased_at', { ascending: false });

      // Get unique shops
      const shops = new Set();
      (allRecommendations || []).forEach(rec => shops.add(rec.shop_domain));
      (allConversions || []).forEach(conv => shops.add(conv.shop_domain));

      res.json({
        success: true,
        data: {
          summary: {
            totalRecommendations: allRecommendations?.length || 0,
            totalConversions: allConversions?.length || 0,
            uniqueShops: Array.from(shops),
            hasRecommendationError: !!recError,
            hasConversionError: !!convError,
          },
          recentRecommendations: (allRecommendations || []).slice(0, 10),
          recentConversions: (allConversions || []).slice(0, 10),
          errors: {
            recommendations: recError,
            conversions: convError,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error in debug endpoint:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Create demo data endpoint for testing
router.post(
  '/create-demo-data',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop = 'naaycl' } = req.body;

      logger.info('Creating demo data for shop:', shop);

      // Clear existing demo data first
      await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .delete()
        .eq('shop_domain', shop)
        .like('session_id', 'demo-%');

      await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', shop)
        .like('session_id', 'demo-%');

      // Create demo recommendations
      const demoRecommendations = [
        // Emulsión Recuperadora (más recomendado)
        {
          session_id: 'demo-session-001',
          product_id: '7849807528193',
          product_title: 'Emulsión Recuperadora Premium',
          recommended_at: '2025-12-10 10:15:00',
          expires_at: '2025-12-10 10:25:00',
        },
        {
          session_id: 'demo-session-002',
          product_id: '7849807528193',
          product_title: 'Emulsión Recuperadora Premium',
          recommended_at: '2025-12-10 09:30:00',
          expires_at: '2025-12-10 09:40:00',
        },
        {
          session_id: 'demo-session-003',
          product_id: '7849807528193',
          product_title: 'Emulsión Recuperadora Premium',
          recommended_at: '2025-12-10 08:45:00',
          expires_at: '2025-12-10 08:55:00',
        },
        {
          session_id: 'demo-session-004',
          product_id: '7849807528193',
          product_title: 'Emulsión Recuperadora Premium',
          recommended_at: '2025-12-10 11:20:00',
          expires_at: '2025-12-10 11:30:00',
        },
        {
          session_id: 'demo-session-005',
          product_id: '7849807528193',
          product_title: 'Emulsión Recuperadora Premium',
          recommended_at: '2025-12-10 12:10:00',
          expires_at: '2025-12-10 12:20:00',
        },

        // Gel Aloe Vera
        {
          session_id: 'demo-session-006',
          product_id: '7849807331585',
          product_title: 'Gel de Aloe Vera Enriquecido',
          recommended_at: '2025-12-10 10:30:00',
          expires_at: '2025-12-10 10:40:00',
        },
        {
          session_id: 'demo-session-007',
          product_id: '7849807331585',
          product_title: 'Gel de Aloe Vera Enriquecido',
          recommended_at: '2025-12-10 11:15:00',
          expires_at: '2025-12-10 11:25:00',
        },
        {
          session_id: 'demo-session-008',
          product_id: '7849807331585',
          product_title: 'Gel de Aloe Vera Enriquecido',
          recommended_at: '2025-12-10 09:20:00',
          expires_at: '2025-12-10 09:30:00',
        },

        // Crema Facial Bardana
        {
          session_id: 'demo-session-009',
          product_id: '7849806938369',
          product_title: 'Crema Facial de Bardana para Cutis Graso',
          recommended_at: '2025-12-10 10:00:00',
          expires_at: '2025-12-10 10:10:00',
        },
        {
          session_id: 'demo-session-010',
          product_id: '7849806938369',
          product_title: 'Crema Facial de Bardana para Cutis Graso',
          recommended_at: '2025-12-10 11:45:00',
          expires_at: '2025-12-10 11:55:00',
        },

        // Otros productos
        {
          session_id: 'demo-session-011',
          product_id: '7849807299841',
          product_title: 'Delicate Splendor | Crema Facial Antimanchas',
          recommended_at: '2025-12-10 09:50:00',
          expires_at: '2025-12-10 10:00:00',
        },
        {
          session_id: 'demo-session-012',
          product_id: '7849807168769',
          product_title: 'Bálsamo Multiusos Árnica',
          recommended_at: '2025-12-10 10:40:00',
          expires_at: '2025-12-10 10:50:00',
        },
      ];

      const recommendationsWithShop = demoRecommendations.map(rec => ({
        ...rec,
        shop_domain: shop,
      }));

      const { error: recError } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .insert(recommendationsWithShop);

      if (recError) {
        throw new Error(
          `Failed to insert recommendations: ${recError.message}`
        );
      }

      // Create demo conversions
      const demoConversions = [
        // Conversiones de Emulsión Recuperadora (3 de 5 = 60% conversión)
        {
          session_id: 'demo-session-001',
          order_id: 'DEMO-ORDER-001',
          product_id: '7849807528193',
          recommended_at: '2025-12-10 10:15:00',
          purchased_at: '2025-12-10 10:22:00',
          minutes_to_conversion: 7,
          confidence: 0.85,
          order_quantity: 1,
          order_amount: 25990,
          total_order_amount: 25990,
        },
        {
          session_id: 'demo-session-003',
          order_id: 'DEMO-ORDER-003',
          product_id: '7849807528193',
          recommended_at: '2025-12-10 08:45:00',
          purchased_at: '2025-12-10 08:52:00',
          minutes_to_conversion: 7,
          confidence: 0.85,
          order_quantity: 2,
          order_amount: 51980,
          total_order_amount: 51980,
        },
        {
          session_id: 'demo-session-005',
          order_id: 'DEMO-ORDER-005',
          product_id: '7849807528193',
          recommended_at: '2025-12-10 12:10:00',
          purchased_at: '2025-12-10 12:15:00',
          minutes_to_conversion: 5,
          confidence: 0.9,
          order_quantity: 1,
          order_amount: 25990,
          total_order_amount: 35990,
        },

        // Conversiones de Gel Aloe Vera (1 de 3 = 33% conversión)
        {
          session_id: 'demo-session-007',
          order_id: 'DEMO-ORDER-007',
          product_id: '7849807331585',
          recommended_at: '2025-12-10 11:15:00',
          purchased_at: '2025-12-10 11:23:00',
          minutes_to_conversion: 8,
          confidence: 0.8,
          order_quantity: 1,
          order_amount: 18990,
          total_order_amount: 18990,
        },

        // Conversión de Crema Facial Bardana (1 de 2 = 50% conversión)
        {
          session_id: 'demo-session-010',
          order_id: 'DEMO-ORDER-010',
          product_id: '7849806938369',
          recommended_at: '2025-12-10 11:45:00',
          purchased_at: '2025-12-10 11:50:00',
          minutes_to_conversion: 5,
          confidence: 0.9,
          order_quantity: 1,
          order_amount: 22990,
          total_order_amount: 22990,
        },
      ];

      const conversionsWithShop = demoConversions.map(conv => ({
        ...conv,
        shop_domain: shop,
      }));

      const { error: convError } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .insert(conversionsWithShop);

      if (convError) {
        throw new Error(`Failed to insert conversions: ${convError.message}`);
      }

      logger.info('Demo data created successfully', {
        shop,
        recommendations: recommendationsWithShop.length,
        conversions: conversionsWithShop.length,
      });

      res.json({
        success: true,
        message: 'Demo data created successfully',
        data: {
          shop,
          recommendations: recommendationsWithShop.length,
          conversions: conversionsWithShop.length,
        },
      });
    } catch (error: any) {
      logger.error('Error creating demo data:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Enhanced Conversion Analytics Endpoints
/**
 * Get conversion dashboard with historical data
 * GET /api/admin-bypass/conversions/dashboard?shop=example.myshopify.com&days=30
 */
router.get(
  '/conversions/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = '30' } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysNumber = parseInt(days as string) || 30;

      // Map frontend shop name to database shop name (same as other endpoints)
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      logger.info('Getting conversion dashboard', {
        shop: shop,
        actualShop: actualShop,
        days: daysNumber,
      });

      // Import and initialize enhanced service
      const { EnhancedConversionAnalyticsService } = await import(
        '@/services/enhanced-conversion-analytics.service'
      );
      const enhancedService = new EnhancedConversionAnalyticsService();

      const dashboard = await enhancedService.generateConversionDashboard(
        actualShop,
        daysNumber
      );

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error getting conversion dashboard:', error);
      next(error);
    }
  }
);

/**
 * Backfill historical recommendations from chat messages
 * POST /api/admin-bypass/conversions/backfill-recommendations
 * Body: { shop: string, fromDate?: string, toDate?: string }
 */
router.post(
  '/conversions/backfill-recommendations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, fromDate, toDate } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      logger.info('Starting historical recommendations backfill', {
        shop,
        fromDate,
        toDate,
      });

      // Import and initialize enhanced service
      const { EnhancedConversionAnalyticsService } = await import(
        '@/services/enhanced-conversion-analytics.service'
      );
      const enhancedService = new EnhancedConversionAnalyticsService();

      const fromDateParsed = fromDate ? new Date(fromDate) : undefined;
      const toDateParsed = toDate ? new Date(toDate) : undefined;

      const result = await enhancedService.backfillHistoricalRecommendations(
        shop,
        fromDateParsed,
        toDateParsed
      );

      res.json({
        success: true,
        message: 'Historical recommendations backfilled successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error backfilling historical recommendations:', error);
      next(error);
    }
  }
);

/**
 * Process historical conversions from Shopify orders
 * POST /api/admin-bypass/conversions/process-historical
 * Body: { shop: string }
 */
router.post(
  '/conversions/process-historical',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      logger.info('Processing historical conversions', { shop });

      // Import and initialize enhanced service
      const { EnhancedConversionAnalyticsService } = await import(
        '@/services/enhanced-conversion-analytics.service'
      );
      const enhancedService = new EnhancedConversionAnalyticsService();

      const result = await enhancedService.processHistoricalConversions(shop);

      res.json({
        success: true,
        message: 'Historical conversions processed successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error processing historical conversions:', error);
      next(error);
    }
  }
);

/**
 * Get conversion analytics summary with recommendations and conversions data
 * GET /api/admin-bypass/conversions/summary?shop=example.myshopify.com
 */
router.get(
  '/conversions/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = '30' } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysBack = parseInt(days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Map shop domain (same as other endpoints)
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      logger.info('Getting conversion summary', { shop, actualShop, daysBack });

      // Get ALL recommendations for the specified period with pagination
      let allRecommendations: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_recommendations')
          .select('id, recommended_at')
          .eq('shop_domain', actualShop)
          .gte('recommended_at', startDate.toISOString())
          .order('recommended_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (batchError) {
          throw new Error(
            `Failed to fetch recommendations: ${batchError.message}`
          );
        }

        if (batch && batch.length > 0) {
          allRecommendations.push(...batch);
          offset += batch.length;
          hasMore = batch.length === limit;
        } else {
          hasMore = false;
        }
      }

      // Get ALL conversions for the specified period with pagination
      let allConversions: any[] = [];
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_conversions')
          .select(
            'id, purchased_at, order_amount, minutes_to_conversion, product_id'
          )
          .eq('shop_domain', actualShop)
          .gte('purchased_at', startDate.toISOString())
          .order('purchased_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (batchError) {
          throw new Error(`Failed to fetch conversions: ${batchError.message}`);
        }

        if (batch && batch.length > 0) {
          allConversions.push(...batch);
          offset += batch.length;
          hasMore = batch.length === limit;
        } else {
          hasMore = false;
        }
      }

      const recommendations = allRecommendations;
      const conversions = allConversions;

      logger.info('Fetched conversion data with pagination', {
        shop: actualShop,
        daysBack,
        recommendationsCount: recommendations.length,
        conversionsCount: conversions.length,
      });

      const totalRecommendations = recommendations?.length || 0;
      const totalConversions = conversions?.length || 0;
      const conversionRate =
        totalRecommendations > 0
          ? (totalConversions / totalRecommendations) * 100
          : 0;
      const totalRevenue =
        conversions?.reduce(
          (sum, conv) => sum + parseFloat(conv.order_amount || '0'),
          0
        ) || 0;
      const averageTimeToConversion =
        totalConversions > 0
          ? conversions.reduce(
              (sum, conv) => sum + (conv.minutes_to_conversion || 0),
              0
            ) / totalConversions
          : 0;

      // Calculate unique products that converted
      const uniqueConvertedProducts = new Set(
        conversions?.map(c => c.product_id) || []
      ).size;

      // Calculate recent activity (last 30 days) - not used when days parameter is specified
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentRecommendations =
        recommendations?.filter(
          r => new Date(r.recommended_at) >= thirtyDaysAgo
        ).length || 0;
      const recentConversions =
        conversions?.filter(c => new Date(c.purchased_at) >= thirtyDaysAgo)
          .length || 0;
      const recentRevenue =
        conversions
          ?.filter(c => new Date(c.purchased_at) >= thirtyDaysAgo)
          .reduce(
            (sum, conv) => sum + parseFloat(conv.order_amount || '0'),
            0
          ) || 0;

      const summary = {
        overall: {
          totalRecommendations,
          totalConversions,
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageTimeToConversion:
            Math.round(averageTimeToConversion * 100) / 100,
          uniqueConvertedProducts,
        },
        last30Days: {
          recommendations: recentRecommendations,
          conversions: recentConversions,
          revenue: Math.round(recentRevenue * 100) / 100,
          conversionRate:
            recentRecommendations > 0
              ? Math.round(
                  (recentConversions / recentRecommendations) * 10000
                ) / 100
              : 0,
        },
        hasHistoricalData: totalConversions > 0,
        dataHealth: {
          recommendationsTablePopulated: totalRecommendations > 0,
          conversionsTablePopulated: totalConversions > 0,
          needsBackfill: totalRecommendations === 0,
          needsConversionProcessing:
            totalRecommendations > 0 && totalConversions === 0,
        },
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error getting conversion summary:', error);
      next(error);
    }
  }
);

/**
 * Get top converting products with detailed metrics
 * GET /api/admin-bypass/conversions/top-products?shop=example.myshopify.com&limit=10&days=30
 */
router.get(
  '/conversions/top-products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = '10', days = '30' } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const limitNum = Math.min(parseInt(limit as string) || 10, 50);
      const daysNum = parseInt(days as string) || 30;

      const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

      // Get products with their recommendation and conversion data
      const { data: products, error } = await (
        supabaseService as any
      ).serviceClient.rpc('get_top_converting_products', {
        p_shop_domain: shop,
        p_start_date: startDate.toISOString(),
        p_limit: limitNum,
      });

      if (error) {
        logger.warn('RPC call failed, using fallback method:', error);

        // Fallback: manual aggregation
        const { data: conversions } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_conversions')
          .select('product_id, order_amount, minutes_to_conversion')
          .eq('shop_domain', shop)
          .gte('purchased_at', startDate.toISOString());

        const { data: recommendations } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_recommendations')
          .select('product_id, product_title')
          .eq('shop_domain', shop)
          .gte('recommended_at', startDate.toISOString());

        // Manual aggregation
        const productStats = new Map();

        recommendations?.forEach(rec => {
          const key = rec.product_id || rec.product_title;
          if (!productStats.has(key)) {
            productStats.set(key, {
              productId: rec.product_id || '',
              productTitle: rec.product_title,
              recommendations: 0,
              conversions: 0,
              revenue: 0,
            });
          }
          productStats.get(key).recommendations++;
        });

        conversions?.forEach(conv => {
          const stats = productStats.get(conv.product_id);
          if (stats) {
            stats.conversions++;
            stats.revenue += parseFloat(conv.order_amount || '0');
          }
        });

        const topProducts = Array.from(productStats.values())
          .map(stats => ({
            ...stats,
            conversionRate:
              stats.recommendations > 0
                ? Math.round(
                    (stats.conversions / stats.recommendations) * 10000
                  ) / 100
                : 0,
            revenue: Math.round(stats.revenue * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limitNum);

        res.json({
          success: true,
          data: {
            products: topProducts,
            period: `${daysNum} days`,
          },
        });
      } else {
        res.json({
          success: true,
          data: {
            products: products || [],
            period: `${daysNum} days`,
          },
        });
      }
    } catch (error) {
      logger.error('Error getting top converting products:', error);
      next(error);
    }
  }
);

// Helper function to simulate orders from recommendations
function simulateOrdersFromRecommendations(recommendations: any[]): any[] {
  const orders: any[] = [];
  const conversionRate = 0.15; // 15% of recommendations convert to sales

  // Sample some recommendations to convert to "orders"
  const sampled = recommendations
    .sort(() => Math.random() - 0.5) // Shuffle
    .slice(0, Math.floor(recommendations.length * conversionRate));

  for (const rec of sampled) {
    // Random time after recommendation (1 min to 3 days)
    const minDelay = 1 * 60 * 1000; // 1 minute
    const maxDelay = 3 * 24 * 60 * 60 * 1000; // 3 days
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    const orderTime = new Date(new Date(rec.recommended_at).getTime() + delay);

    // Random price between $20-$100
    const price = (20 + Math.random() * 80).toFixed(2);

    orders.push({
      id: `simulated_order_${rec.id}`,
      created_at: orderTime.toISOString(),
      total_price: price,
      line_items: [
        {
          id: `line_item_${rec.id}`,
          title: rec.product_title,
          quantity: 1,
          variant: { price },
          product: {
            id: rec.product_id
              ? `gid://shopify/Product/${rec.product_id}`
              : `gid://shopify/Product/simulated_${rec.id}`,
          },
        },
      ],
    });
  }

  return orders;
}

// Helper function for string similarity
function calculateStringSimilarity(str1: string, str2: string): number {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLength = Math.max(len1, len2);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

// TEMPORAL: Execute historical conversions backfill
router.post(
  '/backfill-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, dryRun = false } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter is required',
        });
      }

      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;
      logger.info(
        `Starting conversions backfill for shop: ${actualShop}, dryRun: ${dryRun}`
      );

      // Get simple_recommendations count first
      const { data: recommendations, error: recError } =
        await supabaseService.client
          .from('simple_recommendations')
          .select('*')
          .eq('shop_domain', actualShop)
          .order('recommended_at', { ascending: true });

      if (recError) {
        throw new Error(`Failed to fetch recommendations: ${recError.message}`);
      }

      const recCount = recommendations?.length || 0;
      logger.info(`Found ${recCount} recommendations for processing`);

      if (dryRun) {
        return res.json({
          success: true,
          data: {
            message: 'DRY RUN: Would process historical conversions',
            shop: actualShop,
            recommendationsFound: recCount,
            oldestRecommendation: recommendations?.[0]?.recommended_at,
            newestRecommendation:
              recommendations?.[recCount - 1]?.recommended_at,
            note: 'This would fetch Shopify orders and match them with recommendations',
          },
        });
      }

      logger.info(`Processing backfill for simulated shop: ${actualShop}`);

      // Get date range from recommendations
      const startDate = recommendations?.[0]?.recommended_at;
      const endDate = recommendations?.[recCount - 1]?.recommended_at;

      if (!startDate || !endDate) {
        throw new Error('No recommendations found to process');
      }

      logger.info(
        `Simulating Shopify orders between ${startDate} and ${endDate}`
      );

      // For backfill, simulate orders based on recommendations (since we don't have real Shopify setup)
      // In a real scenario, this would fetch actual orders from Shopify
      const orders = simulateOrdersFromRecommendations(recommendations);

      logger.info(
        `Generated ${orders.length} simulated orders from recommendations`
      );

      // Clear existing conversions for this shop
      await supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualShop);

      // Match orders to recommendations
      const conversions: Array<{
        session_id: string;
        order_id: string;
        product_id: string;
        shop_domain: string;
        recommended_at: string;
        purchased_at: string;
        minutes_to_conversion: number;
        confidence: number;
        order_quantity: number;
        order_amount: number;
        total_order_amount: number;
      }> = [];

      let totalRevenue = 0;
      let totalMinutes = 0;

      for (const order of orders) {
        for (const lineItem of order.line_items) {
          // Find matching recommendations for this product
          const productId = lineItem.product?.id?.replace(
            'gid://shopify/Product/',
            ''
          );

          if (!productId) continue;

          const matchingRecs = recommendations.filter(rec => {
            const orderTime = new Date(order.created_at);
            const recTime = new Date(rec.recommended_at);

            // Only consider recommendations made BEFORE the order
            if (recTime >= orderTime) return false;

            // Check product match by ID
            if (rec.product_id === productId) return true;

            // Check title similarity (70% threshold)
            const similarity = calculateStringSimilarity(
              rec.product_title?.toLowerCase() || '',
              lineItem.title?.toLowerCase() || ''
            );
            return similarity >= 0.7;
          });

          // Create conversions for each matching recommendation
          for (const rec of matchingRecs) {
            const minutesToConversion = Math.round(
              (new Date(order.created_at).getTime() -
                new Date(rec.recommended_at).getTime()) /
                (1000 * 60)
            );

            // Calculate confidence based on time gap
            let confidence = 0.8;
            if (minutesToConversion <= 30)
              confidence = 0.95; // Direct
            else if (minutesToConversion <= 1440)
              confidence = 0.75; // Assisted (24h)
            else if (minutesToConversion <= 10080) confidence = 0.45; // View-through (7d)

            const orderAmount =
              parseFloat(lineItem.variant?.price || '0') * lineItem.quantity;
            totalRevenue += orderAmount;
            totalMinutes += minutesToConversion;

            // Create unique conversion key to avoid duplicates
            const conversionKey = `${rec.session_id}_${order.id}_${productId}`;

            // Only add if not already exists in current batch
            if (
              !conversions.find(
                c =>
                  `${c.session_id}_${c.order_id}_${c.product_id}` ===
                  conversionKey
              )
            ) {
              conversions.push({
                session_id: rec.session_id,
                order_id: order.id
                  .replace('gid://shopify/Order/', '')
                  .replace('simulated_order_', ''),
                product_id: productId,
                shop_domain: actualShop,
                recommended_at: rec.recommended_at,
                purchased_at: order.created_at,
                minutes_to_conversion: minutesToConversion,
                confidence,
                order_quantity: lineItem.quantity,
                order_amount: orderAmount,
                total_order_amount: parseFloat(order.total_price || '0'),
              });
            }
          }
        }
      }

      // Deduplicate conversions based on unique key
      const uniqueConversions = [];
      const seen = new Set();

      for (const conv of conversions) {
        const key = `${conv.session_id}_${conv.order_id}_${conv.product_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConversions.push(conv);
        }
      }

      logger.info(
        `Deduplicated ${conversions.length} conversions to ${uniqueConversions.length} unique entries`
      );

      // Insert conversions in batches
      let conversionsCreated = 0;
      if (uniqueConversions.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < uniqueConversions.length; i += batchSize) {
          const batch = uniqueConversions.slice(i, i + batchSize);

          const { error: insertError } = await supabaseService.client
            .from('simple_conversions')
            .insert(batch);

          if (insertError) {
            logger.error('Error inserting conversions batch:', insertError);
            throw new Error(
              `Failed to insert conversions: ${insertError.message}`
            );
          }

          conversionsCreated += batch.length;
        }
      }

      const avgTimeToConversion =
        conversions.length > 0 ? totalMinutes / conversions.length : 0;

      res.json({
        success: true,
        data: {
          message: 'Historical conversions backfill completed successfully!',
          shop: actualShop,
          recommendationsProcessed: recCount,
          ordersProcessed: orders.length,
          conversionsCreated,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageTimeToConversion: Math.round(avgTimeToConversion * 100) / 100,
          dateRange: {
            from: startDate.split('T')[0],
            to: endDate.split('T')[0],
          },
        },
      });
    } catch (error) {
      logger.error('Error in backfill conversions:', error);
      next(error);
    }
  }
);

// TEMPORAL: Check available shops and setup Shopify connection
router.get(
  '/check-shops',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check all tables that might have shop data
      const { data: shops, error: shopsError } = await supabaseService.client
        .from('shops')
        .select('*');

      const { data: stores, error: storesError } = await supabaseService.client
        .from('stores')
        .select('*');

      const { data: conversations, error: convError } =
        await supabaseService.client
          .from('conversations')
          .select('shop_domain')
          .limit(5);

      const { data: recommendations, error: recError } =
        await supabaseService.client
          .from('simple_recommendations')
          .select('shop_domain')
          .limit(5);

      res.json({
        success: true,
        data: {
          shops: shops || [],
          stores: stores || [],
          conversationShops: [
            ...new Set(conversations?.map(c => c.shop_domain) || []),
          ],
          recommendationShops: [
            ...new Set(recommendations?.map(r => r.shop_domain) || []),
          ],
          errors: {
            shops: shopsError?.message,
            stores: storesError?.message,
            conversations: convError?.message,
            recommendations: recError?.message,
          },
        },
      });
    } catch (error) {
      logger.error('Error checking shops:', error);
      next(error);
    }
  }
);

// TEMPORAL: Setup real Shopify connection and fetch orders
router.post(
  '/setup-shopify-connection',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain, accessToken } = req.body;

      if (!shopDomain || !accessToken) {
        return res.status(400).json({
          success: false,
          error: 'shopDomain and accessToken are required',
        });
      }

      logger.info(`Setting up Shopify connection for: ${shopDomain}`);

      // Update or create store with real access token
      const { data: store, error: updateError } = await supabaseService.client
        .from('stores')
        .upsert(
          {
            shop_domain: shopDomain,
            access_token: accessToken,
            scopes:
              'read_products,write_products,read_orders,read_customers,write_draft_orders',
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            widget_enabled: true,
          },
          {
            onConflict: 'shop_domain',
          }
        );

      if (updateError) {
        throw new Error(`Failed to update store: ${updateError.message}`);
      }

      // Test the connection by fetching a few orders
      try {
        const testOrders = await shopifyService.getOrdersByDateRange(
          shopDomain,
          accessToken,
          '2024-01-01', // Last year
          new Date().toISOString().split('T')[0] // Today
        );

        res.json({
          success: true,
          data: {
            message: 'Shopify connection setup successfully!',
            shopDomain,
            testOrdersFound: testOrders.length,
            sampleOrders: testOrders.slice(0, 2).map(order => ({
              id: order.id,
              created_at: order.created_at,
              total_price: order.total_price,
              line_items_count: order.line_items?.length || 0,
            })),
            nextStep: 'You can now run the real backfill with this shop',
          },
        });
      } catch (shopifyError) {
        logger.error('Shopify API test failed:', shopifyError);
        res.json({
          success: false,
          error: `Shopify API test failed: ${shopifyError.message}`,
          data: {
            shopDomain,
            tokenSaved: true,
            suggestion:
              'Check if the access token has the correct permissions (read_orders)',
          },
        });
      }
    } catch (error) {
      logger.error('Error setting up Shopify connection:', error);
      next(error);
    }
  }
);

// TEMPORAL: Create real backfill using existing store connection
router.post(
  '/real-backfill',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetShop, sourceShop, useRealShopify = true } = req.body;

      if (!targetShop) {
        return res.status(400).json({
          success: false,
          error:
            'targetShop parameter is required (e.g., naayci.myshopify.com)',
        });
      }

      // Map shop names
      const actualTargetShop = targetShop === 'naaycl' ? 'naay.cl' : targetShop;
      const actualSourceShop = sourceShop || 'naay.cl'; // Where recommendations come from

      logger.info(
        `Starting REAL backfill: ${actualSourceShop} → ${targetShop}`
      );

      // Get ALL recommendations from source shop (with pagination to bypass 1000 limit)
      let allRecommendations: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabaseService.client
          .from('simple_recommendations')
          .select('*')
          .eq('shop_domain', actualSourceShop)
          .order('recommended_at', { ascending: true })
          .range(offset, offset + limit - 1);

        if (batchError) {
          throw new Error(
            `Failed to fetch recommendations batch: ${batchError.message}`
          );
        }

        if (batch && batch.length > 0) {
          allRecommendations.push(...batch);
          offset += limit;
          hasMore = batch.length === limit; // Continue if we got a full batch
        } else {
          hasMore = false;
        }
      }

      const recommendations = allRecommendations;
      const recCount = recommendations?.length || 0;
      logger.info(
        `Found ${recCount} recommendations from ${actualSourceShop} (using pagination to get ALL records)`
      );

      if (!useRealShopify) {
        return res.json({
          success: true,
          data: {
            message: 'DRY RUN: Ready for real backfill',
            sourceShop: actualSourceShop,
            targetShop,
            recommendationsFound: recCount,
            instruction:
              'Set useRealShopify: true to proceed with real Shopify data',
          },
        });
      }

      // Get target shop configuration from stores table
      const { data: store, error: storeError } = await supabaseService.client
        .from('stores')
        .select('*')
        .eq('shop_domain', targetShop)
        .single();

      if (storeError || !store) {
        return res.status(400).json({
          success: false,
          error: `Target shop not found: ${targetShop}`,
          availableShops: [
            'naayci.myshopify.com',
            'naaycl.myshopify.com',
            'naay-test.myshopify.com',
          ],
          instruction:
            'Use one of the available shops or setup a new connection first',
        });
      }

      if (
        store.access_token === 'placeholder_token' ||
        store.access_token === 'pending_token_exchange'
      ) {
        return res.status(400).json({
          success: false,
          error: `Shop ${targetShop} does not have a valid access token`,
          instruction:
            'Use /setup-shopify-connection to configure a real access token first',
        });
      }

      // Get FULL date range from recommendations (not just first 1000)
      const { data: earliestRec, error: earliestError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('recommended_at')
        .eq('shop_domain', actualSourceShop)
        .order('recommended_at', { ascending: true })
        .limit(1);

      const { data: latestRec, error: latestError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('recommended_at')
        .eq('shop_domain', actualSourceShop)
        .order('recommended_at', { ascending: false })
        .limit(1);

      if (
        earliestError ||
        latestError ||
        !earliestRec ||
        !latestRec ||
        !earliestRec[0] ||
        !latestRec[0]
      ) {
        throw new Error('No recommendations found to process');
      }

      const startDate = earliestRec[0].recommended_at;
      const endDate = latestRec[0].recommended_at;

      logger.info(
        `Fetching REAL Shopify orders for ${targetShop} using FULL date range: ${startDate.split('T')[0]} to ${endDate.split('T')[0]} (was limited to 1000 recs before)`
      );

      // Fetch ALL REAL orders from Shopify (with pagination)
      let allShopifyOrders: any[] = [];
      let nextPageUrl = `https://${targetShop}/admin/api/2024-10/orders.json?limit=250&status=any&created_at_min=${startDate}&created_at_max=${endDate}`;
      let pageCount = 0;
      const maxPages = 20; // Safety limit

      while (nextPageUrl && pageCount < maxPages) {
        pageCount++;

        const ordersResponse = await fetch(nextPageUrl, {
          headers: {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json',
          },
        });

        if (!ordersResponse.ok) {
          logger.error(
            `Failed to fetch orders page ${pageCount}: HTTP ${ordersResponse.status}`
          );
          break;
        }

        const ordersData = (await ordersResponse.json()) as any;
        const rawOrders = ordersData.orders || [];

        if (rawOrders.length > 0) {
          allShopifyOrders.push(...rawOrders);
          logger.info(
            `Fetched page ${pageCount}: ${rawOrders.length} orders (total: ${allShopifyOrders.length})`
          );
        }

        // Check for next page in Link header
        const linkHeader = ordersResponse.headers.get('Link');
        nextPageUrl = null;
        if (linkHeader) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
          }
        }
      }

      const rawOrders = allShopifyOrders;

      // Log the actual orders dates we're getting
      if (rawOrders.length > 0) {
        const orderDates = rawOrders
          .map((o: any) => o.created_at?.split('T')[0])
          .sort();
        const uniqueDates = [...new Set(orderDates)];
        logger.info(
          `Shopify returned ${rawOrders.length} orders from dates: ${uniqueDates.join(', ')}`
        );
        logger.info(
          `First order: ${orderDates[0]}, Last order: ${orderDates[orderDates.length - 1]}`
        );
      } else {
        logger.warn(
          `No orders found in Shopify for range ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`
        );
      }

      // Convert to format expected by the rest of the code
      const orders = rawOrders.map((order: any) => ({
        id: order.id?.toString() || '',
        created_at: order.created_at,
        total_price: order.total_price,
        line_items:
          order.line_items?.map((item: any) => ({
            id: item.id?.toString() || '',
            title: item.title,
            quantity: item.quantity,
            variant: { price: item.price },
            product: {
              id: item.product_id
                ? `gid://shopify/Product/${item.product_id}`
                : null,
            },
          })) || [],
      }));

      logger.info(`Found ${orders.length} REAL orders from Shopify`);

      // Clear existing conversions for the source shop (where data will be stored)
      await supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualSourceShop);

      // Process real matching logic with deduplication - 1 product per order = max 1 conversion
      const conversions = [];
      let totalRevenue = 0;
      let totalMinutes = 0;
      const processedOrderProducts = new Set(); // Track order+product combinations to prevent duplicates

      // Process by recommendation (not by order) to ensure realistic ratios
      let processed = 0;
      let skipped = 0;
      let created = 0;

      for (const rec of recommendations) {
        processed++;

        const recTime = new Date(rec.recommended_at);

        // Find the best matching order for this recommendation
        let bestMatch: {
          order: any;
          lineItem: any;
          minutesToConversion: number;
        } | null = null;
        let bestScore = 0; // Combined score: time penalty + similarity

        for (const order of orders) {
          const orderTime = new Date(order.created_at);
          const timeDiffMinutes =
            (orderTime.getTime() - recTime.getTime()) / (1000 * 60);

          // Must be after recommendation and within 14 days max
          if (timeDiffMinutes <= 0 || timeDiffMinutes > 20160) continue; // 14 days = 20160 minutes

          for (const lineItem of order.line_items) {
            const productId = lineItem.product?.id?.replace(
              'gid://shopify/Product/',
              ''
            );
            if (!productId) continue;

            let matchScore = 0;

            // Exact product ID match gets highest score
            if (rec.product_id === productId) {
              matchScore = 1.0;
            }
            // Title similarity match (only within 3 days for fuzzy matching)
            else if (timeDiffMinutes <= 4320) {
              // 3 days max for title matching
              const similarity = calculateStringSimilarity(
                rec.product_title?.toLowerCase() || '',
                lineItem.title?.toLowerCase() || ''
              );
              if (similarity >= 0.9) {
                matchScore = similarity * 0.8; // Penalize fuzzy matches
              }
            }

            if (matchScore > 0) {
              // Calculate time penalty (closer = better score)
              const timeScore = Math.max(0, 1 - timeDiffMinutes / 20160); // Decays over 14 days
              const finalScore = matchScore * timeScore;

              if (finalScore > bestScore) {
                bestScore = finalScore;
                bestMatch = {
                  order,
                  lineItem,
                  minutesToConversion: Math.round(timeDiffMinutes),
                };
              }
            }
          }
        }

        // Create conversion only if we found a good match AND haven't already processed this order+product
        if (bestMatch && bestScore > 0.1) {
          // Minimum threshold
          const { order, lineItem, minutesToConversion } = bestMatch;

          // Create unique key for order+product combination
          const orderProductKey = `${bestMatch.order.id}_${rec.product_id}`;

          if (processedOrderProducts.has(orderProductKey)) {
            skipped++;
            continue; // Skip if we already have a conversion for this order+product
          }

          let confidence = 0.8;
          if (minutesToConversion <= 30) confidence = 0.95;
          else if (minutesToConversion <= 1440) confidence = 0.75;
          else if (minutesToConversion <= 10080) confidence = 0.45;

          const orderAmount =
            parseFloat(bestMatch.lineItem.variant?.price || '0') *
            bestMatch.lineItem.quantity;
          totalRevenue += orderAmount;
          totalMinutes += minutesToConversion;

          // Mark this order+product combination as processed
          processedOrderProducts.add(orderProductKey);
          created++;

          conversions.push({
            session_id: rec.session_id,
            order_id:
              bestMatch.order.id
                ?.toString()
                .replace('gid://shopify/Order/', '') || bestMatch.order.id,
            product_id: rec.product_id,
            shop_domain: actualSourceShop, // Store under source shop for dashboard
            recommended_at: rec.recommended_at,
            purchased_at: bestMatch.order.created_at,
            minutes_to_conversion: minutesToConversion,
            confidence,
            order_quantity: bestMatch.lineItem.quantity,
            order_amount: orderAmount,
            total_order_amount: parseFloat(bestMatch.order.total_price || '0'),
          });
        }
      }

      logger.info(
        `Conversion processing stats: processed=${processed}, created=${created}, skipped=${skipped}, final=${conversions.length}`
      );

      // Deduplicate and insert
      const uniqueConversions = [];
      const seen = new Set();

      for (const conv of conversions) {
        const key = `${conv.session_id}_${conv.order_id}_${conv.product_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConversions.push(conv);
        }
      }

      logger.info(
        `Deduplicated ${conversions.length} conversions to ${uniqueConversions.length} unique entries`
      );

      let conversionsCreated = 0;
      if (uniqueConversions.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < uniqueConversions.length; i += batchSize) {
          const batch = uniqueConversions.slice(i, i + batchSize);

          const { error: insertError } = await supabaseService.client
            .from('simple_conversions')
            .insert(batch);

          if (insertError) {
            logger.error('Error inserting conversions batch:', insertError);
            throw new Error(
              `Failed to insert conversions: ${insertError.message}`
            );
          }

          conversionsCreated += batch.length;
        }
      }

      const avgTimeToConversion =
        conversions.length > 0 ? totalMinutes / conversions.length : 0;

      res.json({
        success: true,
        data: {
          message: '🎉 REAL historical conversions backfill completed!',
          sourceShop: actualSourceShop,
          targetShopifyShop: targetShop,
          recommendationsProcessed: recommendations.length,
          realOrdersFromShopify: orders.length,
          conversionsCreated,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageTimeToConversion: Math.round(avgTimeToConversion * 100) / 100,
          dataSource: 'REAL SHOPIFY ORDERS',
          dateRange: {
            from: startDate.split('T')[0],
            to: endDate.split('T')[0],
          },
        },
      });
    } catch (error) {
      logger.error('Error in real backfill:', error);
      next(error);
    }
  }
);

// TEMPORAL: Generate access token for private app
router.post(
  '/generate-access-token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shopDomain } = req.body;

      if (!shopDomain) {
        return res.status(400).json({
          success: false,
          error: 'shopDomain is required (e.g., tu-tienda.myshopify.com)',
        });
      }

      logger.info(`Generating access token for shop: ${shopDomain}`);

      // Use the real Admin API access token provided by user
      const accessToken = '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';

      if (!accessToken) {
        throw new Error(
          'SHOPIFY_API_SECRET not found in environment variables'
        );
      }

      // Test the connection using direct HTTP call
      try {
        logger.info(
          `Testing Shopify connection for ${shopDomain} with credentials`
        );

        // For private apps, try both authentication methods
        const testUrl = `https://${shopDomain}/admin/api/2024-10/orders.json?limit=5&status=any`;

        logger.info(`Calling: ${testUrl}`);
        logger.info(`Using API Key: ${process.env.SHOPIFY_API_KEY}`);
        logger.info(`Using Access Token: ${accessToken.substring(0, 10)}...`);

        // Try method 1: X-Shopify-Access-Token header
        let response = await fetch(testUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        // If method 1 fails, try method 2: Basic Auth
        if (response.status === 401) {
          logger.info('Method 1 failed, trying Basic Auth...');
          const authString = Buffer.from(
            `${process.env.SHOPIFY_API_KEY}:${accessToken}`
          ).toString('base64');

          response = await fetch(testUrl, {
            headers: {
              Authorization: `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        const testOrders = data.orders || [];

        logger.info(`Found ${testOrders.length} test orders from Shopify`);

        // Update store in database
        await supabaseService.client.from('stores').upsert(
          {
            shop_domain: shopDomain,
            access_token: accessToken,
            scopes: process.env.SHOPIFY_SCOPES || 'read_products,read_orders',
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            widget_enabled: true,
          },
          {
            onConflict: 'shop_domain',
          }
        );

        res.json({
          success: true,
          data: {
            message: '✅ Access token generated and tested successfully!',
            shopDomain,
            testOrdersFound: testOrders.length,
            accessTokenGenerated: true,
            sampleOrders: testOrders.slice(0, 3).map(order => ({
              id: order.id?.toString() || 'unknown',
              created_at: order.created_at,
              total_price:
                order.total_price_set?.shop_money?.amount || order.total_price,
              line_items_count: order.line_items?.length || 0,
              currency: order.currency || 'unknown',
            })),
            apiCredentials: {
              keyLength: process.env.SHOPIFY_API_KEY?.length || 0,
              secretLength: accessToken?.length || 0,
            },
            nextStep:
              'You can now run the real backfill with REAL Shopify data!',
          },
        });
      } catch (shopifyError) {
        logger.error('Shopify API test failed:', shopifyError);
        res.json({
          success: false,
          error: `Shopify API test failed: ${shopifyError.message}`,
          suggestion:
            'Verify the shop domain is correct and the private app has read_orders permission',
          shopDomain,
        });
      }
    } catch (error) {
      logger.error('Error generating access token:', error);
      next(error);
    }
  }
);

// TEMPORAL: Clear conversions for a shop
router.post(
  '/clear-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter is required',
        });
      }

      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;
      logger.info(`Clearing conversions for shop: ${actualShop}`);

      const { data, error } = await supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualShop);

      if (error) {
        throw new Error(`Failed to clear conversions: ${error.message}`);
      }

      res.json({
        success: true,
        data: {
          message: 'Conversions cleared successfully',
          shop: actualShop,
        },
      });
    } catch (error) {
      logger.error('Error clearing conversions:', error);
      next(error);
    }
  }
);

// TEMPORAL: Create PRECISE conversion analysis - 1 recommendation → 1 sale maximum
router.post(
  '/precise-backfill',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetShop = 'naaycl.myshopify.com', maxDaysWindow = 7 } =
        req.body;
      const actualSourceShop = 'naay.cl'; // Where recommendations come from

      logger.info(
        `Starting PRECISE conversion analysis: 1 recommendation → max 1 sale`
      );

      // 1. Get all recommendations (increase limit to capture all data)
      const { data: recommendations, error: recError } =
        await supabaseService.client
          .from('simple_recommendations')
          .select('*')
          .eq('shop_domain', actualSourceShop)
          .order('recommended_at', { ascending: true })
          .limit(10000); // Increase limit to capture all recommendations

      if (recError) {
        throw new Error(`Failed to fetch recommendations: ${recError.message}`);
      }

      // 2. Get store configuration
      const { data: store } = await supabaseService.client
        .from('stores')
        .select('*')
        .eq('shop_domain', targetShop)
        .single();

      if (!store?.access_token) {
        throw new Error(`Valid store token required for ${targetShop}`);
      }

      // 3. Get date range
      const startDate = recommendations?.[0]?.recommended_at.split('T')[0];
      const endDate =
        recommendations?.[recommendations.length - 1]?.recommended_at.split(
          'T'
        )[0];

      // 4. Fetch real orders from Shopify
      const ordersUrl = `https://${targetShop}/admin/api/2024-10/orders.json?limit=250&status=any&created_at_min=${startDate}&created_at_max=${endDate}`;

      const ordersResponse = await fetch(ordersUrl, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json',
        },
      });

      const ordersData = (await ordersResponse.json()) as any;
      const orders = ordersData.orders || [];

      logger.info(
        `Found ${recommendations.length} recommendations and ${orders.length} orders`
      );
      logger.info(
        `Expected 1153+ recommendations but got ${recommendations.length} - checking for query limit issue`
      );

      // 5. Clear existing conversions
      await supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualSourceShop);

      // 6. PRECISE ALGORITHM: For each recommendation, check if there's a sale AFTER it
      const conversions = [];
      const usedConversions = new Set(); // Track order_id+product_id combinations
      let processedRecommendations = 0;
      let foundConversions = 0;

      for (const rec of recommendations) {
        processedRecommendations++;

        const recTime = new Date(rec.recommended_at);
        const maxConversionTime = new Date(
          recTime.getTime() + maxDaysWindow * 24 * 60 * 60 * 1000
        );

        // Find orders AFTER this recommendation within the time window
        const eligibleOrders = orders.filter(order => {
          const orderTime = new Date(order.created_at);
          return orderTime > recTime && orderTime <= maxConversionTime;
        });

        // Check if any eligible order contains the recommended product
        let conversionFound = false;

        for (const order of eligibleOrders) {
          if (conversionFound) break; // Only one conversion per recommendation

          for (const lineItem of order.line_items) {
            const productId = lineItem.product_id?.toString();
            const conversionKey = `${order.id}_${productId}`;

            // Skip if this order+product already attributed to another recommendation
            if (usedConversions.has(conversionKey)) continue;

            // Exact product ID match (most reliable)
            if (rec.product_id === productId) {
              const minutesToConversion = Math.round(
                (new Date(order.created_at).getTime() - recTime.getTime()) /
                  (1000 * 60)
              );

              let confidence = 0.9; // High confidence for exact ID match
              if (minutesToConversion <= 60) confidence = 0.95;
              else if (minutesToConversion <= 1440)
                confidence = 0.9; // 1 day
              else confidence = 0.8;

              const orderAmount =
                parseFloat(lineItem.price) * lineItem.quantity;

              conversions.push({
                session_id: rec.session_id,
                order_id: order.id.toString(),
                product_id: productId,
                shop_domain: actualSourceShop,
                recommended_at: rec.recommended_at,
                purchased_at: order.created_at,
                minutes_to_conversion: minutesToConversion,
                confidence,
                order_quantity: lineItem.quantity,
                order_amount: orderAmount,
                total_order_amount: parseFloat(
                  order.total_price_set?.shop_money?.amount || order.total_price
                ),
              });

              // Mark this order+product as used
              usedConversions.add(conversionKey);
              foundConversions++;
              conversionFound = true;
              logger.info(
                `✓ Conversion found: Rec ${rec.id} → Order ${order.id} (${minutesToConversion}min later)`
              );
              break;
            }
          }
        }

        if (processedRecommendations % 100 === 0) {
          logger.info(
            `Processed ${processedRecommendations}/${recommendations.length} recommendations...`
          );
        }
      }

      // 7. Insert conversions
      let conversionsCreated = 0;
      if (conversions.length > 0) {
        const { error: insertError } = await supabaseService.client
          .from('simple_conversions')
          .insert(conversions);

        if (insertError) {
          throw new Error(
            `Failed to insert conversions: ${insertError.message}`
          );
        }
        conversionsCreated = conversions.length;
      }

      const totalRevenue = conversions.reduce(
        (sum, c) => sum + c.order_amount,
        0
      );
      const avgTimeToConversion =
        conversions.length > 0
          ? conversions.reduce((sum, c) => sum + c.minutes_to_conversion, 0) /
            conversions.length
          : 0;

      res.json({
        success: true,
        data: {
          message: '🎯 PRECISE conversion analysis completed!',
          algorithm: '1 recommendation → maximum 1 sale',
          recommendationsAnalyzed: recommendations.length,
          ordersFromShopify: orders.length,
          conversionsFound: conversionsCreated,
          conversionRate: `${((conversionsCreated / recommendations.length) * 100).toFixed(2)}%`,
          totalRevenue: Math.round(totalRevenue),
          averageTimeToConversion: Math.round(avgTimeToConversion),
          maxDaysWindow,
          preciseness:
            'Each recommendation can only generate ONE conversion maximum',
        },
      });
    } catch (error) {
      logger.error('Error in precise backfill:', error);
      next(error);
    }
  }
);

// TEMPORAL: Analyze conversion data by day to debug unrealistic numbers
router.get(
  '/analyze-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop = 'naaycl' } = req.query;
      const actualShop = shop === 'naaycl' ? 'naay.cl' : (shop as string);

      // Get conversions grouped by day
      const { data: conversions, error: convError } =
        await supabaseService.client
          .from('simple_conversions')
          .select('*')
          .eq('shop_domain', actualShop)
          .order('purchased_at', { ascending: true });

      if (convError) {
        throw new Error(`Failed to fetch conversions: ${convError.message}`);
      }

      // Group by day
      const dayGroups: { [key: string]: any[] } = {};

      for (const conv of conversions || []) {
        const day = conv.purchased_at.split('T')[0];
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push(conv);
      }

      // Analyze each day
      const dailyAnalysis = Object.entries(dayGroups)
        .map(([day, dayConversions]) => {
          const uniqueSessions = new Set(dayConversions.map(c => c.session_id))
            .size;
          const uniqueOrders = new Set(dayConversions.map(c => c.order_id))
            .size;
          const uniqueProducts = new Set(dayConversions.map(c => c.product_id))
            .size;
          const totalRevenue = dayConversions.reduce(
            (sum, c) => sum + parseFloat(c.order_amount || 0),
            0
          );

          return {
            day,
            conversions: dayConversions.length,
            uniqueSessions,
            uniqueOrders,
            uniqueProducts,
            totalRevenue: Math.round(totalRevenue),
            avgTimeToConversion: Math.round(
              dayConversions.reduce(
                (sum, c) => sum + c.minutes_to_conversion,
                0
              ) / dayConversions.length
            ),
            suspiciousRatio: dayConversions.length / uniqueOrders, // High ratio indicates duplicate matches
          };
        })
        .sort((a, b) => a.day.localeCompare(b.day));

      res.json({
        success: true,
        data: {
          totalConversions: conversions?.length || 0,
          daysAnalyzed: dailyAnalysis.length,
          dailyBreakdown: dailyAnalysis,
          summary: {
            averageConversionsPerDay: Math.round(
              dailyAnalysis.reduce((sum, d) => sum + d.conversions, 0) /
                dailyAnalysis.length
            ),
            highestSuspiciousDay: dailyAnalysis.sort(
              (a, b) => b.suspiciousRatio - a.suspiciousRatio
            )[0],
            totalRevenue: dailyAnalysis.reduce(
              (sum, d) => sum + d.totalRevenue,
              0
            ),
          },
        },
      });
    } catch (error) {
      logger.error('Error analyzing conversions:', error);
      next(error);
    }
  }
);

// TEMPORAL: Check total recommendations count
router.get(
  '/count-recommendations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop = 'naaycl' } = req.query;
      const actualShop = shop === 'naaycl' ? 'naay.cl' : (shop as string);

      // Count total recommendations
      const { count, error } = await supabaseService.client
        .from('simple_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', actualShop);

      if (error) {
        throw new Error(`Failed to count recommendations: ${error.message}`);
      }

      // Also get a sample of the latest recommendations
      const { data: sample } = await supabaseService.client
        .from('simple_recommendations')
        .select('id, product_title, recommended_at')
        .eq('shop_domain', actualShop)
        .order('recommended_at', { ascending: false })
        .limit(5);

      res.json({
        success: true,
        data: {
          totalCount: count,
          shopDomain: actualShop,
          latestRecommendations: sample || [],
          note: 'This shows the exact count without any limit restrictions',
        },
      });
    } catch (error) {
      logger.error('Error counting recommendations:', error);
      next(error);
    }
  }
);

/**
 * Clear all recommendations and conversions data for a shop (for fresh backfill)
 * POST /api/admin-bypass/clear-analytics-data
 * Body: { shop: string }
 */
router.post(
  '/clear-analytics-data',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map frontend shop name to database shop name
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      logger.info('Clearing analytics data for shop:', actualShop);

      // Clear simple_conversions
      const { error: convError } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualShop);

      if (convError) {
        logger.error('Error clearing conversions:', convError);
        throw convError;
      }

      // Clear simple_recommendations
      const { error: recError } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .delete()
        .eq('shop_domain', actualShop);

      if (recError) {
        logger.error('Error clearing recommendations:', recError);
        throw recError;
      }

      logger.info('Successfully cleared analytics data for shop:', actualShop);

      res.json({
        success: true,
        message: 'Analytics data cleared successfully',
        shop: actualShop,
      });
    } catch (error) {
      logger.error('Error clearing analytics data:', error);
      next(error);
    }
  }
);

// Clear ONLY conversions (not recommendations!)
router.post(
  '/clear-conversions-only',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.body;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map frontend shop name to database shop name
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      logger.info(
        'Clearing ONLY conversions (keeping recommendations) for shop:',
        actualShop
      );

      // Clear ONLY simple_conversions (NOT recommendations!)
      const { error: convError } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', actualShop);

      if (convError) {
        logger.error('Error clearing conversions:', convError);
        throw convError;
      }

      logger.info(
        'Successfully cleared ONLY conversions for shop:',
        actualShop
      );

      res.json({
        success: true,
        message: 'Conversions cleared successfully (recommendations preserved)',
        shop: actualShop,
      });
    } catch (error) {
      logger.error('Error clearing conversions only:', error);
      next(error);
    }
  }
);

// Backfill recommendations from chat_message table
router.post(
  '/backfill-recommendations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, dryRun = false } = req.body;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Map frontend shop name to database shop name
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;
      logger.info(
        `Starting recommendations backfill for shop: ${actualShop}, dryRun: ${dryRun}`
      );

      // First, clear existing recommendations to start fresh
      if (!dryRun) {
        const { error: clearError } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_recommendations')
          .delete()
          .eq('shop_domain', actualShop);

        if (clearError) {
          logger.error('Error clearing recommendations:', clearError);
          throw clearError;
        }
        logger.info('Cleared existing recommendations for shop:', actualShop);
      }

      // Get all chat messages from agent role (where recommendations are stored)
      let offset = 0;
      const limit = 1000;
      let totalProcessed = 0;
      let totalRecommendations = 0;
      const batchResults = [];

      let hasMoreMessages = true;
      while (hasMoreMessages) {
        // Get batch of messages
        const { data: messages, error: messagesError } = await (
          supabaseService as any
        ).serviceClient
          .from('chat_messages')
          .select('id, session_id, content, metadata, timestamp')
          .eq('role', 'agent')
          .not('session_id', 'is', null)
          .order('timestamp', { ascending: false })
          .range(offset, offset + limit - 1);

        if (messagesError) {
          logger.error('Error fetching chat messages:', messagesError);
          throw messagesError;
        }

        if (!messages || messages.length === 0) {
          hasMoreMessages = false;
          continue;
        }

        // Process this batch
        const batchRecommendations = [];
        for (const message of messages) {
          // Extract products using the same function from chat-conversions.service.ts
          const productIds = extractProductsFromMessage(
            message.content,
            message.metadata
          );

          if (productIds.length > 0) {
            const messageTimestamp = new Date(message.timestamp);
            const expiresAt = new Date(
              messageTimestamp.getTime() + 10 * 60 * 1000
            ); // 10 minutes

            for (const productId of productIds) {
              // Get product title if possible (simplified for now)
              const productTitle = `Product ${productId}`;

              batchRecommendations.push({
                session_id: message.session_id,
                shop_domain: actualShop,
                product_id: productId,
                product_title: productTitle,
                recommended_at: messageTimestamp.toISOString(),
                message_id: message.id,
                expires_at: expiresAt.toISOString(),
              });
            }
          }
        }

        // Insert batch if not dry run
        if (!dryRun && batchRecommendations.length > 0) {
          const { error: insertError } = await (
            supabaseService as any
          ).serviceClient
            .from('simple_recommendations')
            .insert(batchRecommendations);

          if (insertError) {
            logger.error('Error inserting recommendations batch:', insertError);
            throw insertError;
          }
        }

        totalProcessed += messages.length;
        totalRecommendations += batchRecommendations.length;

        batchResults.push({
          offset,
          messagesProcessed: messages.length,
          recommendationsFound: batchRecommendations.length,
        });

        logger.info(
          `Processed batch: offset=${offset}, messages=${messages.length}, recommendations=${batchRecommendations.length}`
        );

        // Move to next batch
        offset += limit;
        if (messages.length < limit) {
          break; // Last batch
        }
      }

      logger.info('Backfill completed', {
        shop: actualShop,
        totalMessagesProcessed: totalProcessed,
        totalRecommendationsCreated: totalRecommendations,
        dryRun,
      });

      res.json({
        success: true,
        message: `Recommendations backfill ${dryRun ? 'simulated' : 'completed'} successfully`,
        data: {
          shop: actualShop,
          totalMessagesProcessed: totalProcessed,
          totalRecommendationsCreated: totalRecommendations,
          dryRun,
          batchResults,
        },
      });
    } catch (error) {
      logger.error('Error during recommendations backfill:', error);
      next(error);
    }
  }
);

// DEBUG: Ver estructura de recomendaciones
router.get(
  '/debug-recommendations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop = 'naaycl' } = req.query;
      const actualShop = shop === 'naaycl' ? 'naay.cl' : shop;

      const { data: recs, error } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .select('recommended_at')
        .eq('shop_domain', actualShop)
        .order('recommended_at', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        total: recs?.length || 0,
        dateRange:
          recs && recs.length > 0
            ? {
                earliest: recs[0]?.recommended_at,
                latest: recs[recs.length - 1]?.recommended_at,
              }
            : null,
        sampleDates: recs ? recs.slice(0, 10).map(r => r.recommended_at) : [],
      });
    } catch (error) {
      next(error);
    }
  }
);

// Fix shop domains in recommendations - normalize to myshopify.com format
router.post(
  '/fix-shop-domains',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromDomain, toDomain } = req.body;

      if (!fromDomain || !toDomain) {
        return res.status(400).json({
          success: false,
          error: 'fromDomain and toDomain are required',
        });
      }

      logger.info('Fixing shop domains in recommendations', {
        fromDomain,
        toDomain,
      });

      // Update simple_recommendations
      const { data: updatedRecs, error: recsError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .update({ shop_domain: toDomain })
        .eq('shop_domain', fromDomain)
        .select('id');

      if (recsError) {
        logger.error('Error updating recommendations:', recsError);
      }

      // Update chat_messages
      const { data: updatedMsgs, error: msgsError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .update({ shop_domain: toDomain })
        .eq('shop_domain', fromDomain)
        .select('id');

      if (msgsError) {
        logger.error('Error updating chat_messages:', msgsError);
      }

      res.json({
        success: true,
        message: `Shop domains updated from ${fromDomain} to ${toDomain}`,
        data: {
          recommendationsUpdated: updatedRecs?.length || 0,
          messagesUpdated: updatedMsgs?.length || 0,
        },
      });
    } catch (error) {
      logger.error('Error fixing shop domains:', error);
      next(error);
    }
  }
);

// Reprocess corrupted order webhooks to recover conversions
router.post(
  '/webhooks/reprocess-orders',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, dryRun = true, limit = 100 } = req.body;

      logger.info('Starting webhook reprocessing', { shop, dryRun, limit });

      const simpleConversionTracker = new SimpleConversionTracker();

      // Fetch corrupted webhooks (where payload.data is an array of bytes)
      let query = (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('*')
        .in('topic', ['orders/create', 'orders/paid'])
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (shop) {
        query = query.eq('shop_domain', shop);
      }

      const { data: webhooks, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Error fetching webhooks:', fetchError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch webhooks',
        });
      }

      if (!webhooks || webhooks.length === 0) {
        return res.json({
          success: true,
          message: 'No pending webhooks to process',
          data: { processed: 0, conversions: 0 },
        });
      }

      const results = {
        total: webhooks.length,
        decoded: 0,
        processed: 0,
        conversions: 0,
        errors: [] as string[],
      };

      for (const webhook of webhooks) {
        try {
          let orderData = null;

          // Check if payload.data is an array of bytes (corrupted)
          if (
            webhook.payload?.data &&
            Array.isArray(webhook.payload.data) &&
            typeof webhook.payload.data[0] === 'number'
          ) {
            // Decode bytes array to string, then parse as JSON
            const bytes = new Uint8Array(webhook.payload.data);
            const jsonString = new TextDecoder().decode(bytes);
            orderData = JSON.parse(jsonString);
            results.decoded++;
          } else if (webhook.payload?.id) {
            // Already valid JSON
            orderData = webhook.payload;
          }

          if (!orderData || !orderData.id) {
            results.errors.push(
              `Webhook ${webhook.id}: Could not extract order data`
            );
            continue;
          }

          // Skip if order already processed for conversions
          const { data: existingConversion } = await (
            supabaseService as any
          ).serviceClient
            .from('simple_conversions')
            .select('id')
            .eq('order_id', orderData.id.toString())
            .eq('shop_domain', webhook.shop_domain)
            .limit(1)
            .single();

          if (existingConversion) {
            // Already processed, mark webhook as processed
            if (!dryRun) {
              await (supabaseService as any).serviceClient
                .from('webhook_events')
                .update({ processed: true })
                .eq('id', webhook.id);
            }
            continue;
          }

          // Build order event for conversion tracking
          const orderEvent = {
            orderId: orderData.id.toString(),
            shopDomain: webhook.shop_domain,
            customerId: orderData.customer?.id?.toString(),
            browserIp:
              orderData.browser_ip || orderData.client_details?.browser_ip,
            userAgent: orderData.client_details?.user_agent,
            products: (orderData.line_items || [])
              .map((item: any) => ({
                productId: (
                  item.product_id || item.variant?.product_id
                )?.toString(),
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0,
              }))
              .filter((p: any) => p.productId),
            totalAmount: parseFloat(orderData.total_price) || 0,
            createdAt: new Date(orderData.created_at),
          };

          // Process order for conversions (always run to count, but only save if not dry run)
          const conversions =
            await simpleConversionTracker.processOrderForConversions(
              orderEvent,
              dryRun // Pass dryRun flag to skip saving
            );

          if (conversions.length > 0) {
            results.conversions += conversions.length;
            logger.info('Recovered conversions from webhook', {
              webhookId: webhook.id,
              orderId: orderData.id,
              conversionsCount: conversions.length,
              dryRun,
            });
          }

          if (!dryRun) {
            // Mark webhook as processed
            await (supabaseService as any).serviceClient
              .from('webhook_events')
              .update({ processed: true })
              .eq('id', webhook.id);
          }

          results.processed++;
        } catch (err: any) {
          results.errors.push(`Webhook ${webhook.id}: ${err.message}`);
          logger.error('Error processing webhook:', {
            webhookId: webhook.id,
            error: err.message,
          });
        }
      }

      // Also clean up expired recommendations
      if (!dryRun) {
        await simpleConversionTracker.cleanupExpiredRecommendations();
      }

      res.json({
        success: true,
        message: dryRun
          ? 'Dry run completed - no changes made'
          : 'Webhooks reprocessed successfully',
        data: results,
      });
    } catch (error) {
      logger.error('Error reprocessing webhooks:', error);
      next(error);
    }
  }
);

// Diagnose why conversions aren't matching
router.get(
  '/webhooks/diagnose-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = 5 } = req.query;
      const shopDomain = (shop as string) || 'naaycl.myshopify.com';

      // Get recent webhooks and decode them
      const { data: webhooks } = await (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('*')
        .eq('topic', 'orders/create')
        .eq('shop_domain', shopDomain)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      const diagnosis = [];

      for (const webhook of webhooks || []) {
        let orderData = null;

        // Decode corrupted payload
        if (
          webhook.payload?.data &&
          Array.isArray(webhook.payload.data) &&
          typeof webhook.payload.data[0] === 'number'
        ) {
          const bytes = new Uint8Array(webhook.payload.data);
          const jsonString = new TextDecoder().decode(bytes);
          orderData = JSON.parse(jsonString);
        }

        if (!orderData) continue;

        const orderTime = new Date(orderData.created_at);
        const windowStart = new Date(orderTime.getTime() - 15 * 60 * 1000);
        const browserIp =
          orderData.browser_ip || orderData.client_details?.browser_ip;
        const userAgent = orderData.client_details?.user_agent;

        // Get products in this order
        const orderProducts = (orderData.line_items || []).map((item: any) => ({
          productId: item.product_id?.toString(),
          title: item.title,
        }));

        // Find recommendations around this order time (time-based)
        const { data: nearbyRecs } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_recommendations')
          .select('product_id, product_title, recommended_at, expires_at')
          .eq('shop_domain', shopDomain)
          .gte('recommended_at', windowStart.toISOString())
          .lte('recommended_at', orderTime.toISOString())
          .limit(20);

        // Find chat sessions with matching IP (IP-based)
        let ipMatchingSessions: any[] = [];
        let ipMatchingRecs: any[] = [];
        if (browserIp) {
          const sevenDaysAgo = new Date(
            orderTime.getTime() - 7 * 24 * 60 * 1000
          );
          const { data: chatMsgs } = await (
            supabaseService as any
          ).serviceClient
            .from('chat_messages')
            .select('session_id, timestamp, metadata')
            .eq('shop_domain', shopDomain)
            .gte('timestamp', sevenDaysAgo.toISOString())
            .lte('timestamp', orderTime.toISOString());

          const matchingSessionIds = new Set<string>();
          for (const msg of chatMsgs || []) {
            const msgIp = msg.metadata?.['x-forwarded-for'];
            if (msgIp === browserIp) {
              matchingSessionIds.add(msg.session_id);
            }
          }
          ipMatchingSessions = Array.from(matchingSessionIds);

          if (ipMatchingSessions.length > 0) {
            const { data: recs } = await (supabaseService as any).serviceClient
              .from('simple_recommendations')
              .select('session_id, product_id, product_title, recommended_at')
              .eq('shop_domain', shopDomain)
              .in('session_id', ipMatchingSessions);
            ipMatchingRecs = recs || [];
          }
        }

        // Find chat sessions with matching user-agent (user-agent-based)
        let uaMatchingSessions: any[] = [];
        let uaMatchingRecs: any[] = [];
        if (userAgent) {
          const sevenDaysAgo = new Date(
            orderTime.getTime() - 7 * 24 * 60 * 1000
          );
          const { data: chatMsgs } = await (
            supabaseService as any
          ).serviceClient
            .from('chat_messages')
            .select('session_id, timestamp, metadata')
            .eq('shop_domain', shopDomain)
            .gte('timestamp', sevenDaysAgo.toISOString())
            .lte('timestamp', orderTime.toISOString());

          const matchingSessionIds = new Set<string>();
          for (const msg of chatMsgs || []) {
            const msgUserAgent = msg.metadata?.['user-agent'];
            if (msgUserAgent === userAgent) {
              matchingSessionIds.add(msg.session_id);
            }
          }
          uaMatchingSessions = Array.from(matchingSessionIds);

          if (uaMatchingSessions.length > 0) {
            const { data: recs } = await (supabaseService as any).serviceClient
              .from('simple_recommendations')
              .select('session_id, product_id, product_title, recommended_at')
              .eq('shop_domain', shopDomain)
              .in('session_id', uaMatchingSessions);
            uaMatchingRecs = recs || [];
          }
        }

        diagnosis.push({
          orderId: orderData.id,
          orderTime: orderTime.toISOString(),
          browserIp,
          userAgent: userAgent?.substring(0, 80),
          windowStart: windowStart.toISOString(),
          orderProducts,
          nearbyRecommendations: nearbyRecs || [],
          ipMatching: {
            sessionsFound: ipMatchingSessions.length,
            sessionIds: ipMatchingSessions.slice(0, 3),
            recommendations: ipMatchingRecs.slice(0, 5),
            productMatches: orderProducts.filter((op: any) =>
              ipMatchingRecs.some((r: any) => r.product_id === op.productId)
            ),
          },
          userAgentMatching: {
            sessionsFound: uaMatchingSessions.length,
            sessionIds: uaMatchingSessions.slice(0, 3),
            recommendations: uaMatchingRecs.slice(0, 5),
            productMatches: orderProducts.filter((op: any) =>
              uaMatchingRecs.some((r: any) => r.product_id === op.productId)
            ),
          },
          potentialMatches: orderProducts.filter((op: any) =>
            (nearbyRecs || []).some((r: any) => r.product_id === op.productId)
          ),
        });
      }

      res.json({
        success: true,
        data: {
          shopDomain,
          ordersAnalyzed: diagnosis.length,
          diagnosis,
        },
      });
    } catch (error) {
      logger.error('Error diagnosing conversions:', error);
      next(error);
    }
  }
);

// Analyze conversion opportunities with flexible matching
router.get(
  '/webhooks/analyze-conversions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;
      const shopDomain = (shop as string) || 'naaycl.myshopify.com';
      const daysBack = Number(days);

      // Get all recommendations
      const { data: recommendations } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_recommendations')
        .select('product_id, product_title, session_id, recommended_at')
        .eq('shop_domain', shopDomain)
        .gte(
          'recommended_at',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
        );

      // Get unique recommended product IDs
      const recommendedProductIds = new Set(
        recommendations?.map((r: any) => r.product_id) || []
      );

      // Get all order webhooks and decode them
      const { data: webhooks } = await (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('*')
        .eq('topic', 'orders/create')
        .eq('shop_domain', shopDomain)
        .gte(
          'created_at',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
        );

      // Decode and analyze orders
      const ordersWithRecommendedProducts: any[] = [];
      let totalOrders = 0;

      for (const webhook of webhooks || []) {
        let orderData = null;

        // Decode corrupted payload
        if (
          webhook.payload?.data &&
          Array.isArray(webhook.payload.data) &&
          typeof webhook.payload.data[0] === 'number'
        ) {
          const bytes = new Uint8Array(webhook.payload.data);
          const jsonString = new TextDecoder().decode(bytes);
          orderData = JSON.parse(jsonString);
        } else if (webhook.payload?.id) {
          orderData = webhook.payload;
        }

        if (!orderData) continue;
        totalOrders++;

        // Check if order contains recommended products
        const orderProducts = (orderData.line_items || []).map((item: any) => ({
          productId: item.product_id?.toString(),
          title: item.title,
        }));

        const matchingProducts = orderProducts.filter((p: any) =>
          recommendedProductIds.has(p.productId)
        );

        if (matchingProducts.length > 0) {
          ordersWithRecommendedProducts.push({
            orderId: orderData.id,
            orderTime: orderData.created_at,
            totalPrice: orderData.total_price,
            browserIp:
              orderData.browser_ip || orderData.client_details?.browser_ip,
            userAgent: orderData.client_details?.user_agent?.substring(0, 100),
            matchingProducts,
            allProducts: orderProducts,
          });
        }
      }

      // Analyze product conversion potential
      const productStats = new Map<
        string,
        { title: string; recommended: number; purchased: number }
      >();

      for (const rec of recommendations || []) {
        if (!productStats.has(rec.product_id)) {
          productStats.set(rec.product_id, {
            title: rec.product_title,
            recommended: 0,
            purchased: 0,
          });
        }
        productStats.get(rec.product_id)!.recommended++;
      }

      for (const order of ordersWithRecommendedProducts) {
        for (const product of order.matchingProducts) {
          if (productStats.has(product.productId)) {
            productStats.get(product.productId)!.purchased++;
          }
        }
      }

      const productAnalysis = Array.from(productStats.entries())
        .map(([id, stats]) => ({
          productId: id,
          ...stats,
          conversionPotential:
            stats.recommended > 0
              ? Math.round((stats.purchased / stats.recommended) * 100)
              : 0,
        }))
        .sort((a, b) => b.purchased - a.purchased);

      res.json({
        success: true,
        data: {
          shopDomain,
          daysAnalyzed: daysBack,
          summary: {
            totalRecommendations: recommendations?.length || 0,
            uniqueProductsRecommended: recommendedProductIds.size,
            totalOrders: totalOrders,
            ordersWithRecommendedProducts: ordersWithRecommendedProducts.length,
            potentialConversionRate:
              totalOrders > 0
                ? Math.round(
                    (ordersWithRecommendedProducts.length / totalOrders) * 100
                  )
                : 0,
          },
          productAnalysis: productAnalysis.slice(0, 20),
          recentOrdersWithRecommendedProducts:
            ordersWithRecommendedProducts.slice(0, 10),
        },
      });
    } catch (error) {
      logger.error('Error analyzing conversions:', error);
      next(error);
    }
  }
);

// Get webhook reprocessing status
router.get(
  '/webhooks/reprocess-status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      let query = (supabaseService as any).serviceClient
        .from('webhook_events')
        .select('topic, processed')
        .in('topic', ['orders/create', 'orders/paid']);

      if (shop) {
        query = query.eq('shop_domain', shop);
      }

      const { data: webhooks, error } = await query;

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch webhook status',
        });
      }

      const stats = {
        total: webhooks?.length || 0,
        processed: webhooks?.filter((w: any) => w.processed).length || 0,
        pending: webhooks?.filter((w: any) => !w.processed).length || 0,
        byTopic: {} as Record<string, { total: number; processed: number }>,
      };

      webhooks?.forEach((w: any) => {
        if (!stats.byTopic[w.topic]) {
          stats.byTopic[w.topic] = { total: 0, processed: 0 };
        }
        stats.byTopic[w.topic].total++;
        if (w.processed) stats.byTopic[w.topic].processed++;
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching webhook status:', error);
      next(error);
    }
  }
);

// Fix conversion dates - set created_at to match purchased_at for historical accuracy
router.post(
  '/conversions/fix-dates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, dryRun = true } = req.body;
      const shopDomain = shop || 'naaycl.myshopify.com';

      // Get conversions where created_at doesn't match purchased_at date
      const { data: conversions, error: fetchError } = await (
        supabaseService as any
      ).serviceClient
        .from('simple_conversions')
        .select('id, created_at, purchased_at')
        .eq('shop_domain', shopDomain);

      if (fetchError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch conversions',
          details: fetchError,
        });
      }

      // Find records that need fixing
      const needsFixing =
        conversions?.filter((c: any) => {
          const createdDate = new Date(c.created_at).toDateString();
          const purchasedDate = new Date(c.purchased_at).toDateString();
          return createdDate !== purchasedDate;
        }) || [];

      if (dryRun) {
        return res.json({
          success: true,
          message: 'Dry run - no changes made',
          data: {
            total: conversions?.length || 0,
            needsFixing: needsFixing.length,
            sample: needsFixing.slice(0, 5).map((c: any) => ({
              id: c.id,
              created_at: c.created_at,
              purchased_at: c.purchased_at,
            })),
          },
        });
      }

      // Fix each record
      let fixed = 0;
      let errors: any[] = [];

      for (const conv of needsFixing) {
        const { error: updateError } = await (
          supabaseService as any
        ).serviceClient
          .from('simple_conversions')
          .update({ created_at: conv.purchased_at })
          .eq('id', conv.id);

        if (updateError) {
          errors.push({ id: conv.id, error: updateError });
        } else {
          fixed++;
        }
      }

      logger.info('Conversion dates fixed', {
        shopDomain,
        total: conversions?.length,
        fixed,
        errors: errors.length,
      });

      res.json({
        success: true,
        message: 'Conversion dates fixed',
        data: {
          total: conversions?.length || 0,
          needsFixing: needsFixing.length,
          fixed,
          errors: errors.length > 0 ? errors.slice(0, 10) : [],
        },
      });
    } catch (error) {
      logger.error('Error fixing conversion dates:', error);
      next(error);
    }
  }
);

export default router;
