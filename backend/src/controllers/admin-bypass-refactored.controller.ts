import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { AdminAnalyticsService } from '@/services/admin-analytics.service';
import { AdminSettingsService } from '@/services/admin-settings.service';
import { AdminWebhooksService } from '@/services/admin-webhooks.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { adminBypassRateLimit } from '@/middleware/rateLimiter';
import { PerformanceMonitor } from '@/utils/performance-monitor';

const router = Router();
const supabaseService = new SupabaseService();
const analyticsService = new AdminAnalyticsService();
const settingsService = new AdminSettingsService();
const webhooksService = new AdminWebhooksService();

// Helper function for standardized error responses
const handleControllerError = (
  error: any,
  res: Response,
  operation: string
) => {
  logger.error(`Error in ${operation}:`, {
    error: error.message || error,
    stack: error.stack,
    operation,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.statusCode,
    });
  }

  return res.status(500).json({
    success: false,
    error: `Failed to ${operation}`,
    code: 500,
  });
};

// Helper function for parameter validation
const validateShopParameter = (
  shop: any,
  res: Response,
  operation: string
): string | null => {
  if (!shop || typeof shop !== 'string' || shop.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Shop parameter is required and must be a non-empty string',
      operation,
    });
    return null;
  }
  return shop.trim();
};

// Apply rate limiting to all admin-bypass routes
router.use(adminBypassRateLimit);

// Products sync endpoint
router.post(
  '/products/sync',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'product sync';

    try {
      const { shop } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return; // Response already sent by validation

      logger.info('Starting product sync for shop via bypass:', {
        shop: validatedShop,
      });

      const store = await supabaseService.getStore(validatedShop);
      if (!store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
          shop: validatedShop,
        });
      }

      const queueService = new QueueService();
      await queueService.addFullSyncJob(validatedShop, store.access_token);

      logger.info('Product sync job queued successfully', {
        shop: validatedShop,
        storeId: store.id,
      });

      res.json({
        success: true,
        message: 'Sincronización de productos iniciada correctamente',
        shop: validatedShop,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Settings endpoints
router.get(
  '/settings',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get shop settings';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting shop settings', { shop: validatedShop });

      const settings = await settingsService.getShopSettings(validatedShop);

      logger.info('Shop settings retrieved successfully', {
        shop: validatedShop,
        hasSettings: !!settings,
      });

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.post(
  '/settings/update',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'update shop settings';

    try {
      const { shop, ...settings } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Updating shop settings', {
        shop: validatedShop,
        settingsKeys: Object.keys(settings),
      });

      const updatedSettings = await settingsService.updateShopSettings(
        validatedShop,
        settings
      );

      logger.info('Shop settings updated successfully', {
        shop: validatedShop,
        updatedKeys: Object.keys(updatedSettings),
      });

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Configuración actualizada correctamente',
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.post(
  '/settings/reset',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'reset shop settings';

    try {
      const { shop } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Resetting shop settings', { shop: validatedShop });

      const resetSettings =
        await settingsService.resetShopSettings(validatedShop);

      logger.info('Shop settings reset successfully', {
        shop: validatedShop,
      });

      res.json({
        success: true,
        data: resetSettings,
        message: 'Configuración restablecida a valores por defecto',
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Analytics endpoints

// General metrics endpoint
router.get(
  '/metrics/general',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get general metrics';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting general metrics', { shop: validatedShop });

      const generalMetrics = await analyticsService.getGeneralMetrics(validatedShop);

      logger.info('General metrics retrieved successfully', {
        shop: validatedShop,
        totalConversations: generalMetrics.totalConversations,
        totalMessages: generalMetrics.totalMessages,
        uniqueSessionIds: generalMetrics.uniqueSessionIds,
      });

      res.json({
        success: true,
        data: generalMetrics,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Product recommendation metrics endpoint
router.get(
  '/metrics/products',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get product recommendation metrics';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting product recommendation metrics', { shop: validatedShop });

      const productMetrics = await analyticsService.getProductRecommendationMetrics(validatedShop);

      logger.info('Product recommendation metrics retrieved successfully', {
        shop: validatedShop,
        totalRecommendationsMade: productMetrics.totalRecommendationsMade,
        uniqueProductsRecommended: productMetrics.uniqueProductsRecommended,
        topProductsCount: productMetrics.topRecommendedProducts.length,
      });

      res.json({
        success: true,
        data: productMetrics,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Engagement metrics endpoint
router.get(
  '/metrics/engagement',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get engagement metrics';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting engagement metrics', { shop: validatedShop });

      const engagementMetrics = await analyticsService.getEngagementMetrics(validatedShop);

      logger.info('Engagement metrics retrieved successfully', {
        shop: validatedShop,
        conversationsByLength: engagementMetrics.conversationsByLength.length,
        userEngagementLevels: engagementMetrics.userEngagementLevels.length,
        mostActiveTimeSlots: engagementMetrics.mostActiveTimeSlots.length,
      });

      res.json({
        success: true,
        data: engagementMetrics,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Updated stats endpoint using comprehensive dashboard
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get comprehensive shop stats';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting comprehensive shop stats', { shop: validatedShop });

      const comprehensiveStats = await analyticsService.getComprehensiveDashboard(validatedShop);

      logger.info('Comprehensive shop stats retrieved successfully', {
        shop: validatedShop,
        totalConversations: comprehensiveStats.general.totalConversations,
        totalMessages: comprehensiveStats.general.totalMessages,
        totalRecommendations: comprehensiveStats.recommendations.totalRecommendationsMade,
        conversionRate: comprehensiveStats.conversion.conversionRate,
      });

      res.json({
        success: true,
        data: comprehensiveStats,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Analytics summary endpoint for quick overview
router.get(
  '/metrics/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get analytics summary';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting analytics summary', { shop: validatedShop });

      const summary = await analyticsService.getAnalyticsSummary(validatedShop);

      logger.info('Analytics summary retrieved successfully', {
        shop: validatedShop,
        totalConversations: summary.totalConversations,
        conversionRate: summary.conversionRate,
        recommendationsMade: summary.recommendationsMade,
      });

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Cache invalidation endpoint for analytics
router.post(
  '/metrics/invalidate-cache',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'invalidate analytics cache';

    try {
      const { shop } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Invalidating analytics cache', { shop: validatedShop });

      await analyticsService.invalidateAnalyticsCache(validatedShop);

      logger.info('Analytics cache invalidated successfully', {
        shop: validatedShop,
      });

      res.json({
        success: true,
        message: 'Analytics cache cleared successfully',
        shop: validatedShop,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get conversations';

    try {
      const { shop, limit = 10, page = 1 } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      // Validate and sanitize numeric parameters
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(limit as string, 10) || 10)
      );
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);

      logger.info('Getting conversations', {
        shop: validatedShop,
        limit: limitNum,
        page: pageNum,
      });

      const conversations = await analyticsService.getConversations(
        validatedShop,
        limitNum,
        pageNum
      );

      logger.info('Conversations retrieved successfully', {
        shop: validatedShop,
        conversationCount: conversations.conversations.length,
        totalPages: conversations.pagination.totalPages,
      });

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.get(
  '/conversations/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get conversation details';

    try {
      const { sessionId } = req.params;

      if (!sessionId || sessionId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
          operation,
        });
      }

      logger.info('Getting conversation details', { sessionId });

      const messages = await analyticsService.getConversationDetails(
        sessionId.trim()
      );

      logger.info('Conversation details retrieved successfully', {
        sessionId,
        messageCount: messages.length,
      });

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.get(
  '/analytics/conversion',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get conversion analytics';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting conversion analytics', { shop: validatedShop });

      const conversionData =
        await analyticsService.getConversionAnalytics(validatedShop);

      logger.info('Conversion analytics retrieved successfully', {
        shop: validatedShop,
        totalConversations: conversionData.totalConversations,
        conversionRate: conversionData.conversionRate,
      });

      res.json({
        success: true,
        data: conversionData,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.get(
  '/analytics/chart',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get chart analytics';

    try {
      const { shop, days = 30 } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      // Validate and sanitize days parameter
      const daysNum = Math.max(
        1,
        Math.min(365, parseInt(days as string, 10) || 30)
      );

      logger.info('Getting chart analytics', {
        shop: validatedShop,
        days: daysNum,
      });

      const chartData = await analyticsService.getChartAnalytics(
        validatedShop,
        daysNum
      );

      logger.info('Chart analytics retrieved successfully', {
        shop: validatedShop,
        days: daysNum,
        totalConversations: chartData.totals.conversations,
        dataPoints: chartData.daily_data.length,
      });

      res.json({
        success: true,
        data: chartData,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.get(
  '/analytics/top-recommended-products',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get top recommended products';

    try {
      const { shop, limit } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      // Validate and sanitize limit parameter
      const limitNum = Math.max(
        1,
        Math.min(50, parseInt(limit as string, 10) || 10)
      );

      logger.info('Getting top recommended products', {
        shop: validatedShop,
        limit: limitNum,
      });

      const products = await analyticsService.getTopRecommendedProducts(
        validatedShop,
        limitNum
      );

      logger.info('Top recommended products retrieved successfully', {
        shop: validatedShop,
        productCount: products.data?.length || 0,
      });

      res.json(products);
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Webhook endpoints
router.get(
  '/webhooks/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get webhook stats';

    try {
      const { shop } = req.query;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Getting webhook stats', { shop: validatedShop });

      const webhookStats = await webhooksService.getWebhookStats(validatedShop);

      logger.info('Webhook stats retrieved successfully', {
        shop: validatedShop,
      });

      res.json({
        success: true,
        data: webhookStats,
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.post(
  '/webhooks/create',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'create webhooks';

    try {
      const { shop } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      logger.info('Creating webhooks', { shop: validatedShop });

      const result = await webhooksService.createWebhooks(validatedShop);

      logger.info('Webhooks created successfully', {
        shop: validatedShop,
        success: result.success,
      });

      res.json(result);
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.post(
  '/webhooks/test',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'test webhook';

    try {
      const { shop, topic } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Topic parameter is required and must be a non-empty string',
          operation,
        });
      }

      logger.info('Testing webhook', {
        shop: validatedShop,
        topic: topic.trim(),
      });

      const testResult = await webhooksService.testWebhook(
        validatedShop,
        topic.trim()
      );

      logger.info('Webhook test completed', {
        shop: validatedShop,
        topic: topic.trim(),
        success: testResult.success,
      });

      res.json(testResult);
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Performance monitoring endpoints
router.get(
  '/performance/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'get performance stats';

    try {
      const { operation: operationFilter, shop } = req.query;

      logger.info('Getting performance statistics', {
        operationFilter,
        shop,
      });

      const stats = PerformanceMonitor.getStatistics(
        operationFilter as string,
        shop as string
      );

      const alerts = PerformanceMonitor.getAlerts(5); // Last 5 minutes

      res.json({
        success: true,
        data: {
          statistics: stats,
          alerts,
          thresholds: {
            conversation_list: '100ms',
            conversation_count: '50ms',
            conversation_details: '200ms',
            chart_data: '300ms',
            stats: '150ms',
          },
        },
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

router.post(
  '/performance/clear',
  async (_req: Request, res: Response, next: NextFunction) => {
    const operation = 'clear performance metrics';

    try {
      logger.info('Clearing performance metrics');

      PerformanceMonitor.clearMetrics();

      res.json({
        success: true,
        message: 'Performance metrics cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Performance testing endpoint
router.post(
  '/performance/test',
  async (req: Request, res: Response, next: NextFunction) => {
    const operation = 'performance test';

    try {
      const { shop, iterations = 5 } = req.body;
      const validatedShop = validateShopParameter(shop, res, operation);
      if (!validatedShop) return;

      const iterationsNum = Math.max(1, Math.min(10, parseInt(iterations, 10)));

      logger.info('Starting performance test', {
        shop: validatedShop,
        iterations: iterationsNum,
      });

      const results = [];

      // Test conversation loading multiple times
      for (let i = 0; i < iterationsNum; i++) {
        const startTime = Date.now();

        try {
          await analyticsService.getConversations(validatedShop, 10, 1);
          const duration = Date.now() - startTime;

          results.push({
            iteration: i + 1,
            operation: 'getConversations',
            duration,
            success: true,
          });
        } catch (error) {
          const duration = Date.now() - startTime;

          results.push({
            iteration: i + 1,
            operation: 'getConversations',
            duration,
            success: false,
            error: error.message,
          });
        }

        // Small delay between tests
        if (i < iterationsNum - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const successfulTests = results.filter(r => r.success);
      const averageDuration =
        successfulTests.length > 0
          ? successfulTests.reduce((sum, r) => sum + r.duration, 0) /
            successfulTests.length
          : 0;

      const testSummary = {
        totalTests: iterationsNum,
        successfulTests: successfulTests.length,
        failedTests: results.length - successfulTests.length,
        averageDuration: Math.round(averageDuration),
        minDuration: Math.min(...successfulTests.map(r => r.duration)),
        maxDuration: Math.max(...successfulTests.map(r => r.duration)),
        target: '< 100ms',
        passed: averageDuration < 100,
      };

      logger.info('Performance test completed', testSummary);

      res.json({
        success: true,
        data: {
          summary: testSummary,
          results,
          shop: validatedShop,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Database migration endpoint
router.post(
  '/migrate/add-shop-domain',
  async (_req: Request, res: Response, next: NextFunction) => {
    const operation = 'add shop domain to chat_messages';

    try {
      logger.info('Starting migration to add shop_domain to chat_messages');

      // Check if column already exists
      const { data: columnCheck, error: checkError } =
        await supabaseService.client
          .from('chat_messages')
          .select('shop_domain')
          .limit(1);

      if (!checkError) {
        logger.info('shop_domain column already exists');
        return res.json({
          success: true,
          message: 'shop_domain column already exists in chat_messages table',
          timestamp: new Date().toISOString(),
        });
      }

      // Execute migration steps manually since we can't run raw SQL
      logger.info('Column does not exist, needs manual migration in database');

      res.json({
        success: false,
        message:
          'Migration requires manual execution in database. Please run the SQL migration file.',
        sql: `
-- Add shop_domain column to chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS shop_domain VARCHAR(255);

-- Add foreign key constraint
ALTER TABLE chat_messages 
ADD CONSTRAINT fk_chat_messages_shop_domain 
FOREIGN KEY (shop_domain) REFERENCES stores(shop_domain) ON DELETE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_domain 
ON chat_messages(shop_domain);

CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_session 
ON chat_messages(shop_domain, session_id, timestamp);
        `,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleControllerError(error, res, operation);
    }
  }
);

// Basic health check
router.get('/health', async (_req: Request, res: Response) => {
  try {
    logger.info('Health check requested');

    const stats = PerformanceMonitor.getStatistics();
    const alerts = PerformanceMonitor.getAlerts(1); // Last minute

    res.json({
      success: true,
      message: 'Admin bypass controller is healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.1', // Updated version with performance monitoring
      performance: {
        totalOperations: stats.totalOperations,
        averageDuration: Math.round(stats.averageDuration),
        recentAlerts: alerts.length,
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
