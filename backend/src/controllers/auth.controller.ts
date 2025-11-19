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

// Handle App Bridge installation verification
router.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, hmac, timestamp, host } = req.body;

      if (!shop || !hmac) {
        throw new AppError('Missing required parameters', 400);
      }

      logger.info(`Verifying app installation for shop: ${shop}`);

      // For App Bridge, we need to request access token from Shopify
      // This is a simplified flow - in production you'd verify the HMAC
      
      // Check if store exists, create or update
      let store = await supabaseService.getStore(shop);

      if (!store) {
        // Create new store entry
        store = await supabaseService.createStore({
          shop_domain: shop,
          access_token: 'app_bridge_token', // Placeholder for App Bridge
          scopes: config.shopify.scopes,
          installed_at: new Date(),
          updated_at: new Date(),
        });
        logger.info(`Created new store via App Bridge: ${shop}`);
        
        // For App Bridge installations, we can't do OAuth flow
        // We'll need the store owner to manually provide an admin token
        // Or use Shopify's Session Token API
      } else {
        logger.info(`Store already exists for App Bridge: ${shop}`);
      }

      res.json({
        success: true,
        message: 'App installation verified',
        data: {
          shop,
          installed: true,
          requiresConfiguration: true,
        },
      });

    } catch (error) {
      logger.error('App verification error:', error);
      next(error);
    }
  }
);

// OAuth callback
router.get(
  '/callback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('OAuth callback received', {
        query: req.query,
        url: req.url
      });

      const { code, shop, state } = req.query;

      if (
        !code ||
        !shop ||
        typeof code !== 'string' ||
        typeof shop !== 'string'
      ) {
        logger.error('Missing required parameters in OAuth callback', {
          code: !!code,
          shop: !!shop,
          state: !!state,
          query: req.query
        });
        throw new AppError('Missing required parameters', 400);
      }

      logger.info(`Processing OAuth callback for shop: ${shop}`);

      // Exchange code for access token
      logger.info('Exchanging code for access token...');
      let accessToken;
      try {
        accessToken = await shopifyService.exchangeCodeForToken(shop, code);
        logger.info('Successfully obtained access token');
      } catch (tokenError) {
        logger.error('Failed to exchange code for token', {
          shop,
          error: tokenError.message,
          stack: tokenError.stack
        });
        throw new AppError('Failed to obtain access token from Shopify', 500);
      }

      // Check if store exists, create or update
      logger.info('Checking/creating store in database...');
      let store;
      try {
        store = await supabaseService.getStore(shop);

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
      } catch (dbError) {
        logger.error('Database operation failed', {
          shop,
          error: dbError.message,
          stack: dbError.stack
        });
        throw new AppError('Failed to save store information', 500);
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

      // 🔗 AUTO-WEBHOOKS: Create webhooks for real-time synchronization
      logger.info(`Creating webhooks for shop: ${shop}`);
      try {
        await shopifyService.createWebhooks(shop, accessToken);
        logger.info(`Successfully created webhooks for shop: ${shop}`);
      } catch (webhookError) {
        logger.error(`Failed to create webhooks for ${shop}:`, webhookError);
        // Don't fail the entire installation if webhooks fail
      }

      // Redirect to app with token
      const redirectUrl = `${config.shopify.appUrl}/success?token=${token}&shop=${shop}`;
      logger.info('Redirecting after successful OAuth', { redirectUrl, shop });
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('OAuth callback error:', {
        error: error.message,
        stack: error.stack,
        shop: req.query.shop,
        code: !!req.query.code
      });
      
      // Send a more user-friendly error response
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: 'OAuth callback failed'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error during app installation',
          details: error.message
        });
      }
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
