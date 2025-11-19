import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { validateSessionToken } from '@/middleware/shopify-auth.middleware';
import jwt from 'jsonwebtoken';

const router = Router();
const supabaseService = new SupabaseService();

/**
 * Modern Shopify Authentication Controller
 * Provides session management for App Bridge 3.0
 */

// Verify session token and get user/shop info
router.get(
  '/session',
  validateSessionToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const userId = (req as any).userId;
      const sessionId = (req as any).sessionId;

      // Get store information
      const store = await supabaseService.getStore(shop);

      if (!store) {
        throw new AppError('Store not found', 404);
      }

      logger.info(`Session verified for shop: ${shop}, user: ${userId}`);

      res.json({
        success: true,
        data: {
          shop,
          userId,
          sessionId,
          authenticated: true,
          store: {
            shop_domain: store.shop_domain,
            installed_at: store.installed_at,
            widget_enabled: store.widget_enabled,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh authentication status
router.post(
  '/refresh',
  validateSessionToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const sessionId = (req as any).sessionId;

      logger.info(
        `Refreshing auth status for shop: ${shop}, session: ${sessionId}`
      );

      // Update session last_used timestamp (already done in middleware)
      res.json({
        success: true,
        message: 'Authentication status refreshed',
        data: {
          shop,
          sessionId,
          refreshedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get shop configuration
router.get(
  '/config',
  validateSessionToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;

      const store = await supabaseService.getStore(shop);

      if (!store) {
        throw new AppError('Store not found', 404);
      }

      res.json({
        success: true,
        data: {
          shop: store.shop_domain,
          widget_enabled: store.widget_enabled,
          scopes: store.scopes,
          app_url: config.shopify.appUrl,
          features: {
            webhooks: true,
            ai_chat: true,
            product_sync: true,
            analytics: true,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
