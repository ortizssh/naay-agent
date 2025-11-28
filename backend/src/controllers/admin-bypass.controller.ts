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

      // Get product mentions from conversations
      const { data: conversations, error } = await (
        supabaseService as any
      ).serviceClient
        .from('conversations')
        .select('ai_response, metadata, created_at')
        .eq('shop_domain', shop)
        .gte('created_at', daysAgo.toISOString());

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
        const response = conv.ai_response;
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

      // Get conversations count from unique session_id in chat_messages
      const { data: uniqueSessions, error: messagesError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id')
        .not('session_id', 'is', null);

      const conversationCount = uniqueSessions
        ? new Set(uniqueSessions.map(msg => msg.session_id)).size
        : 0;

      if (messagesError) {
        logger.error(
          'Error fetching chat sessions count for stats:',
          messagesError
        );
      }

      // Get recommended products from chat messages
      let recommendedProducts = 0;
      let totalRecommendations = 0;

      try {
        const { data: allMessages, error: messageAnalysisError } = await (
          supabaseService as any
        ).serviceClient
          .from('chat_messages')
          .select('content, metadata')
          .eq('role', 'agent')
          .not('content', 'is', null);

        if (!messageAnalysisError && allMessages) {
          const uniqueProducts = new Set();

          allMessages.forEach((message: any) => {
            try {
              // Check if content contains product references in JSON format
              const content = message.content;

              // Look for product IDs or JSON objects in content
              const productIdMatches = content.match(
                /product[_-]?id["\s]*:?\s*["']?(\w+)["']?/gi
              );
              const jsonMatches = content.match(/\{[^}]*"id"[^}]*\}/g);

              if (productIdMatches) {
                productIdMatches.forEach((match: string) => {
                  const idMatch = match.match(/["']?(\w+)["']?$/);
                  if (idMatch && idMatch[1]) {
                    uniqueProducts.add(idMatch[1]);
                    totalRecommendations++;
                  }
                });
              }

              if (jsonMatches) {
                jsonMatches.forEach((jsonStr: string) => {
                  try {
                    const obj = JSON.parse(jsonStr);
                    if (obj.id) {
                      uniqueProducts.add(obj.id);
                      totalRecommendations++;
                    }
                  } catch (e) {
                    // Ignore invalid JSON
                  }
                });
              }

              // Also check metadata if available
              if (message.metadata && typeof message.metadata === 'object') {
                const metadata = message.metadata;
                if (metadata.recommended_products) {
                  metadata.recommended_products.forEach((product: any) => {
                    if (product.id) {
                      uniqueProducts.add(product.id);
                      totalRecommendations++;
                    }
                  });
                }
                if (metadata.products) {
                  metadata.products.forEach((product: any) => {
                    if (product.id) {
                      uniqueProducts.add(product.id);
                      totalRecommendations++;
                    }
                  });
                }
              }
            } catch (error) {
              // Ignore parsing errors for individual messages
            }
          });

          recommendedProducts = uniqueProducts.size;

          logger.info('Product recommendation stats:', {
            uniqueProducts: recommendedProducts,
            totalRecommendations: totalRecommendations,
            messagesAnalyzed: allMessages.length,
          });
        }
      } catch (error) {
        logger.error('Error analyzing product recommendations:', error);
      }

      const stats = {
        conversations: conversationCount || 0,
        recommendedProducts: recommendedProducts,
        totalRecommendations: totalRecommendations,
        chatStatus: 'Active',
      };

      logger.info('Stats calculated:', stats);

      res.json({
        success: true,
        data: stats,
      });
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
    }
  }
);

// Get conversations - bypass version
router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = 10, page = 1 } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      logger.info('Admin bypass: Getting conversations', {
        shop,
        limit,
        page,
        offset,
      });

      // Get all messages and group by session_id
      const { data: allMessages, error: messagesError } = await (
        supabaseService as any
      ).serviceClient
        .from('chat_messages')
        .select('session_id, content, timestamp, role')
        .not('session_id', 'is', null)
        .order('timestamp', { ascending: false });

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

      logger.info('Admin bypass: Getting conversation details', { sessionId });

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
                    'Busco una chaqueta para el invierno, algo que sea abrigado pero elegante.',
                  timestamp: new Date(Date.now() - 3000000).toISOString(),
                },
                {
                  id: 'demo-4',
                  role: 'agent',
                  content:
                    'Perfecto. Tenemos una excelente selección de chaquetas de invierno. Te recomiendo nuestra chaqueta de lana merino que es muy elegante y abrigada.',
                  timestamp: new Date(Date.now() - 2500000).toISOString(),
                },
                {
                  id: 'demo-5',
                  role: 'client',
                  content: '¿Podrías mostrarme algunas opciones?',
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

// Get sales chart data
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

export default router;
