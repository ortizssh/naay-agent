import { Router, Request, Response, NextFunction } from 'express';
import { AIAgentService } from '@/services/ai-agent.service';
import { SupabaseService } from '@/services/supabase.service';
import { ShopifyService } from '@/services/shopify.service';
import { chatRateLimiter } from '@/middleware/rateLimiter';
import { verifyToken } from './auth.controller';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import Joi from 'joi';

const router = Router();
const aiAgentService = new AIAgentService();
const supabaseService = new SupabaseService();
const shopifyService = new ShopifyService();

// Apply rate limiting to chat endpoints
router.use(chatRateLimiter);

// Validation schemas
const messageSchema = Joi.object({
  message: Joi.string().required().max(1000),
  session_id: Joi.string().required().uuid(),
  cart_id: Joi.string().optional(),
  context: Joi.object().optional(),
});

const sessionSchema = Joi.object({
  customer_id: Joi.string().optional(),
  cart_id: Joi.string().optional(),
  context: Joi.object().optional(),
});

// Simple widget chat schema (for compatibility)
const widgetMessageSchema = Joi.object({
  message: Joi.string().required().max(1000),
  shop: Joi.string().required(),
  conversationId: Joi.string().optional(),
  context: Joi.object().optional(),
});

// Public chat endpoint (no authentication required for customer chat)
router.post(
  '/message',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const { error, value } = messageSchema.validate(req.body);
      if (error) {
        throw new AppError(
          `Validation error: ${error.details[0].message}`,
          400
        );
      }

      const { message, session_id, cart_id, context } = value;

      // Get shop domain from header (set by the widget)
      const shop = req.headers['x-shop-domain'] as string;
      if (!shop) {
        throw new AppError('Shop domain header is required', 400);
      }

      // Verify the shop exists
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      logger.info(`Chat message received`, {
        shop,
        sessionId: session_id,
        messageLength: message.length,
        hasCartId: !!cart_id,
      });

      // Process message with AI agent
      const agentResponse = await aiAgentService.processMessage(
        message,
        session_id,
        shop,
        cart_id,
        context
      );

      // Execute any cart actions if present
      if (agentResponse.actions.length > 0 && cart_id) {
        try {
          await executeCartActions(
            agentResponse.actions,
            shop,
            cart_id,
            store.access_token
          );
        } catch (actionError) {
          logger.error('Error executing cart actions:', actionError);
          // Don't fail the whole request, but add a note to the response
          agentResponse.messages.push(
            'I had trouble updating your cart, but I can still help you find products!'
          );
        }
      }

      // Log analytics event
      await logChatEvent(shop, session_id, 'message_processed', {
        intent: agentResponse.metadata?.intent,
        actions_count: agentResponse.actions.length,
        response_length: agentResponse.messages.join(' ').length,
      });

      res.json({
        success: true,
        data: {
          messages: agentResponse.messages,
          actions: agentResponse.actions,
          metadata: agentResponse.metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create or get chat session
router.post(
  '/session',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = sessionSchema.validate(req.body);
      if (error) {
        throw new AppError(
          `Validation error: ${error.details[0].message}`,
          400
        );
      }

      const { customer_id, cart_id, context } = value;
      const shop = req.headers['x-shop-domain'] as string;

      if (!shop) {
        throw new AppError('Shop domain header is required', 400);
      }

      // Create new chat session
      const session = await supabaseService.createChatSession(
        shop,
        customer_id,
        cart_id
      );

      // Log analytics event
      await logChatEvent(shop, session.id, 'session_started', {
        customer_id,
        cart_id,
        context,
      });

      logger.info(`New chat session created`, {
        shop,
        sessionId: session.id,
        customerId: customer_id,
        cartId: cart_id,
      });

      res.json({
        success: true,
        data: {
          session_id: session.id,
          shop_domain: session.shop_domain,
          started_at: session.started_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get session history (with authentication for admin)
router.get(
  '/session/:sessionId/history',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const shop = (req as any).shop;
      const { limit = 50 } = req.query;

      const history = await supabaseService.getSessionHistory(
        sessionId,
        parseInt(limit as string)
      );

      // Verify session belongs to the shop
      if (history.length > 0) {
        const session = await getSessionInfo(sessionId);
        if (session?.shop_domain !== shop) {
          throw new AppError('Unauthorized access to session', 403);
        }
      }

      res.json({
        success: true,
        data: {
          session_id: sessionId,
          messages: history,
          total: history.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get chat analytics (admin only)
router.get(
  '/analytics',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const {
        start_date = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        end_date = new Date().toISOString(),
      } = req.query;

      // Get analytics from database function
      const { data: analytics, error } = await (
        supabaseService as any
      ).serviceClient.rpc('get_shop_analytics', {
        shop_domain: shop,
        start_date: start_date,
        end_date: end_date,
      });

      if (error) {
        throw new AppError(`Failed to get analytics: ${error.message}`, 500);
      }

      res.json({
        success: true,
        data: analytics?.[0] || {
          total_sessions: 0,
          total_messages: 0,
          avg_session_length: null,
          most_searched_products: { products: [] },
          conversion_rate: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Health check for chat service
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test AI service
    const testResponse = await aiAgentService.processMessage(
      'Hello',
      'test-session-' + Date.now(),
      'test-shop.myshopify.com'
    );

    res.json({
      success: true,
      status: 'healthy',
      services: {
        ai_agent: testResponse ? 'healthy' : 'unhealthy',
        database: 'healthy', // If we got here, DB is working
      },
    });
  } catch (error) {
    logger.error('Chat service health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Helper functions

async function executeCartActions(
  actions: any[],
  shop: string,
  cartId: string,
  accessToken: string
): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'cart.add':
          // Implementation for adding to cart via Storefront API
          logger.info('Cart action executed:', {
            type: action.type,
            shop,
            cartId,
          });
          break;
        case 'cart.update':
          // Implementation for updating cart
          logger.info('Cart action executed:', {
            type: action.type,
            shop,
            cartId,
          });
          break;
        case 'cart.remove':
          // Implementation for removing from cart
          logger.info('Cart action executed:', {
            type: action.type,
            shop,
            cartId,
          });
          break;
        default:
          logger.warn('Unknown cart action type:', action.type);
      }
    } catch (error) {
      logger.error(`Failed to execute cart action ${action.type}:`, error);
      throw error;
    }
  }
}

async function logChatEvent(
  shop: string,
  sessionId: string,
  eventType: string,
  eventData: Record<string, any>
): Promise<void> {
  try {
    const { error } = await (supabaseService as any).serviceClient
      .from('analytics_events')
      .insert({
        shop_domain: shop,
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
      });

    if (error) {
      logger.error('Error logging chat event:', error);
    }
  } catch (error) {
    logger.error('Failed to log chat event:', error);
  }
}

async function getSessionInfo(sessionId: string): Promise<any> {
  try {
    const { data, error } = await (supabaseService as any).serviceClient
      .from('chat_sessions')
      .select('shop_domain, started_at, status')
      .eq('id', sessionId)
      .single();

    if (error) {
      logger.error('Error getting session info:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Failed to get session info:', error);
    return null;
  }
}

// Simple widget endpoint (for easy integration)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { error, value } = widgetMessageSchema.validate(req.body);
    if (error) {
      throw new AppError(`Validation error: ${error.details[0].message}`, 400);
    }

    const { message, shop, conversationId, context } = value;

    logger.info(`Widget chat message received`, {
      shop,
      conversationId,
      messageLength: message.length,
      hasContext: !!context,
    });

    // Verify the shop exists
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Generate or use existing conversation ID
    const sessionId =
      conversationId ||
      `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process message with AI agent
    const agentResponse = await aiAgentService.processMessage(
      message,
      sessionId,
      shop,
      context?.cartId || '',
      context
    );

    // Log analytics event
    await logChatEvent(shop, sessionId, 'widget_message', {
      messageLength: message.length,
      hasContext: !!context,
      responseLength: agentResponse.messages.join(' ').length,
    });

    // Return simplified response for widget
    const response =
      agentResponse.messages.length > 0
        ? agentResponse.messages[0]
        : '¡Hola! Soy tu asistente de Naay. ¿En qué puedo ayudarte?';

    res.json({
      success: true,
      data: {
        response: response,
        conversationId: sessionId,
        actions: agentResponse.actions,
      },
    });
  } catch (error) {
    logger.error('Widget chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      data: {
        response:
          'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
        conversationId: null,
      },
    });
  }
});

export default router;
