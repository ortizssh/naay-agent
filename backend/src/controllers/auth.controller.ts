import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyService } from '@/services/shopify.service';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';

const router = Router();
const shopifyService = new ShopifyService();
const supabaseService = new SupabaseService();
const queueService = new QueueService();

// Generate install URL
router.get(
  '/install',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop parameter is required', 400);
      }

      // Validate shop domain format
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
        throw new AppError('Invalid shop domain format', 400);
      }

      const redirectUri = `${config.shopify.appUrl}/auth/callback`;
      const installUrl = shopifyService.generateInstallUrl(shop, redirectUri);

      logger.info(`Generated install URL for shop: ${shop}`);

      res.json({
        success: true,
        data: {
          installUrl,
          shop,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// OAuth callback
router.get(
  '/callback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, shop, state } = req.query;

      if (
        !code ||
        !shop ||
        typeof code !== 'string' ||
        typeof shop !== 'string'
      ) {
        throw new AppError('Missing required parameters', 400);
      }

      logger.info(`Processing OAuth callback for shop: ${shop}`);

      // Exchange code for access token
      const accessToken = await shopifyService.exchangeCodeForToken(shop, code);

      // Check if store exists, create or update
      let store = await supabaseService.getStore(shop);

      if (store) {
        // Update existing store
        await supabaseService.updateStoreToken(shop, accessToken);
        logger.info(`Updated access token for existing store: ${shop}`);
      } else {
        // Create new store
        store = await supabaseService.createStore({
          shop_domain: shop,
          access_token: accessToken,
          scopes: config.shopify.scopes,
          installed_at: new Date(),
          updated_at: new Date(),
        });
        logger.info(`Created new store: ${shop}`);
      }

      // Generate JWT for the app session
      const token = jwt.sign(
        {
          shop,
          sub: store.id,
          iat: Math.floor(Date.now() / 1000),
        },
        config.server.jwtSecret,
        { expiresIn: '24h' }
      );

      // 🚀 AUTO-SYNC: Trigger automatic product sync after installation
      logger.info(
        `Triggering automatic product sync for new installation: ${shop}`
      );
      await queueService.addFullSyncJob(shop, accessToken);

      // Redirect to app with token
      const redirectUrl = `${config.shopify.appUrl}/success?token=${token}&shop=${shop}`;
      logger.info('Redirecting after successful OAuth', { redirectUrl, shop });
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('OAuth callback error:', error);
      next(error);
    }
  }
);

// Verify token middleware
export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authorization token required', 401);
    }

    const decoded = jwt.verify(token, config.server.jwtSecret) as any;
    (req as any).shop = decoded.shop;
    (req as any).storeId = decoded.sub;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

// Get current store info
router.get(
  '/me',
  verifyToken,
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
          scopes: store.scopes,
          installed_at: store.installed_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Uninstall handler
router.post(
  '/uninstall',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;

      // In a real implementation, you might want to:
      // 1. Clean up store data
      // 2. Cancel any subscriptions
      // 3. Revoke webhooks

      logger.info(`App uninstalled for shop: ${shop}`);

      res.json({
        success: true,
        message: 'App uninstalled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
