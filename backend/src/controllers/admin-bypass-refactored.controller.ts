import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { AdminAnalyticsService } from '@/services/admin-analytics.service';
import { AdminSettingsService } from '@/services/admin-settings.service';
import { AdminWebhooksService } from '@/services/admin-webhooks.service';
import { logger } from '@/utils/logger';
import { adminBypassRateLimit } from '@/middleware/rateLimiter';

const router = Router();
const supabaseService = new SupabaseService();
const analyticsService = new AdminAnalyticsService();
const settingsService = new AdminSettingsService();
const webhooksService = new AdminWebhooksService();

// Apply rate limiting to all admin-bypass routes
router.use(adminBypassRateLimit);

// Products sync endpoint
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

      const store = await supabaseService.getStore(shop);
      if (!store) {
        return res.status(404).json({
          success: false,
          error: 'Store not found',
        });
      }

      const queueService = new QueueService();
      await queueService.addFullSyncJob(shop, store.access_token);

      res.json({
        success: true,
        message: 'Sincronización de productos iniciada correctamente',
        shop,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Settings endpoints
router.get(
  '/settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const settings = await settingsService.getShopSettings(shop);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/settings/update',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, ...settings } = req.body;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const updatedSettings = await settingsService.updateShopSettings(
        shop,
        settings
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Configuración actualizada correctamente',
      });
    } catch (error) {
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

      const resetSettings = await settingsService.resetShopSettings(shop);

      res.json({
        success: true,
        data: resetSettings,
        message: 'Configuración restablecida a valores por defecto',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Analytics endpoints
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const stats = await analyticsService.getShopStats(shop);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/conversations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = 10, page = 1 } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const limitNum = parseInt(limit as string, 10) || 10;
      const pageNum = parseInt(page as string, 10) || 1;

      const conversations = await analyticsService.getConversations(
        shop,
        limitNum,
        pageNum
      );

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/conversations/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;

      const messages = await analyticsService.getConversationDetails(sessionId);

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/analytics/conversion',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const conversionData =
        await analyticsService.getConversionAnalytics(shop);

      res.json({
        success: true,
        data: conversionData,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/analytics/chart',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, days = 30 } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const daysNum = parseInt(days as string, 10) || 30;
      const chartData = await analyticsService.getChartAnalytics(shop, daysNum);

      res.json({
        success: true,
        data: chartData,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/analytics/top-recommended-products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 10;
      const products = await analyticsService.getTopRecommendedProducts(
        shop,
        limitNum
      );

      res.json(products);
    } catch (error) {
      next(error);
    }
  }
);

// Webhook endpoints
router.get(
  '/webhooks/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      const webhookStats = await webhooksService.getWebhookStats(shop);

      res.json({
        success: true,
        data: webhookStats,
      });
    } catch (error) {
      next(error);
    }
  }
);

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

      const result = await webhooksService.createWebhooks(shop);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/webhooks/test',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, topic } = req.body;

      if (!shop || !topic) {
        return res.status(400).json({
          success: false,
          error: 'Shop and topic parameters required',
        });
      }

      const testResult = await webhooksService.testWebhook(shop, topic);

      res.json(testResult);
    } catch (error) {
      next(error);
    }
  }
);

// Basic health check
router.get('/health', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Admin bypass controller is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
