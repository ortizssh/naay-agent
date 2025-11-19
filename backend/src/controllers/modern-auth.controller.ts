import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { ModernShopifyService } from '@/services/modern-shopify.service';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { 
  validateSessionToken, 
  validateOAuthCallback, 
  shopify,
  extractShopFromToken 
} from '@/middleware/shopify-auth.middleware';

const router = Router();
const supabaseService = new SupabaseService();
const queueService = new QueueService();
const shopifyService = new ModernShopifyService();

/**
 * Modern Shopify Authentication Controller
 * Supports both Session Tokens (App Bridge 3.0) and OAuth for installations
 */

// Generate install URL (still needed for initial installation)
router.get('/install', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop parameter is required', 400);
    }

    // Validate shop domain format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
      throw new AppError('Invalid shop domain format', 400);
    }

    // Generate OAuth URL for initial installation
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: false, // Request offline access for Admin API
      rawRequest: req,
      rawResponse: res,
    });

    logger.info(`Generated install URL for shop: ${shop}`);

    res.json({
      success: true,
      data: {
        installUrl: authRoute,
        shop,
        message: 'Redirect to installUrl to begin OAuth flow'
      },
    });
  } catch (error) {
    logger.error('Install URL generation failed:', error);
    next(error);
  }
});

// OAuth callback handler (for initial installations)
router.get('/callback', validateOAuthCallback, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const authCode = (req as any).authCode;

    logger.info(`Processing OAuth callback for shop: ${shop}`);

    // Complete OAuth flow and get session
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;
    
    if (!session || !session.accessToken) {
      throw new AppError('Failed to complete OAuth flow', 500);
    }

    logger.info('OAuth flow completed successfully', { shop: session.shop });

    // Store session in database
    await supabaseService.upsertSession({
      shop: session.shop,
      access_token: session.accessToken,
      scope: session.scope || config.shopify.scopes,
      expires_at: session.expires || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
      session_id: session.id,
      is_online: session.isOnline || false,
      user_id: session.onlineAccessInfo?.associated_user?.id?.toString(),
    });

    // Auto-sync products after installation
    logger.info(`Triggering automatic product sync for: ${shop}`);
    await queueService.addFullSyncJob(shop, session.accessToken);

    // Create webhooks
    logger.info(`Setting up webhooks for shop: ${shop}`);
    try {
      await shopifyService.createWebhooks(shop, session.accessToken);
      logger.info(`Successfully created webhooks for shop: ${shop}`);
    } catch (webhookError) {
      logger.error(`Failed to create webhooks for ${shop}:`, webhookError);
    }

    // Redirect to app success page
    const redirectUrl = `${config.shopify.appUrl}/auth/success?shop=${shop}`;
    logger.info('Redirecting after successful OAuth', { redirectUrl, shop });
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    next(error);
  }
});

// Verify session token and provide session info
router.get('/session', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const userId = (req as any).userId;
    const session = (req as any).session;

    // Get store information from database
    const store = await supabaseService.getStore(shop);
    
    if (!store) {
      logger.warn(`Store not found in database: ${shop}`);
      throw new AppError('Store not registered. Please complete installation.', 404);
    }

    // Get offline session for Admin API operations
    const offlineSession = await supabaseService.getOfflineSession(shop);

    res.json({
      success: true,
      data: {
        shop,
        userId,
        isAuthenticated: true,
        session: {
          id: session.id,
          expires: session.expires,
          isOnline: session.isOnline,
        },
        store: {
          shop_domain: store.shop_domain,
          scopes: store.scopes,
          installed_at: store.installed_at,
          has_offline_access: !!offlineSession,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Refresh session (for when tokens expire)
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const shop = extractShopFromToken(authHeader);
    
    if (!shop) {
      throw new AppError('Unable to extract shop from token', 400);
    }

    // Check if we have valid offline session
    const offlineSession = await supabaseService.getOfflineSession(shop);
    
    if (!offlineSession) {
      throw new AppError('No offline session available. Please reinstall the app.', 401);
    }

    // Verify the offline session is still valid
    try {
      const isValid = await shopifyService.validateAccessToken(shop, offlineSession.access_token);
      
      if (!isValid) {
        throw new AppError('Stored access token is invalid. Please reinstall the app.', 401);
      }

      res.json({
        success: true,
        data: {
          shop,
          message: 'Session is valid',
          hasOfflineAccess: true,
        },
      });
    } catch (validationError) {
      logger.error(`Token validation failed for ${shop}:`, validationError);
      throw new AppError('Access token validation failed. Please reinstall the app.', 401);
    }
  } catch (error) {
    next(error);
  }
});

// Handle app uninstallation
router.delete('/uninstall', validateSessionToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;

    logger.info(`Processing app uninstallation for shop: ${shop}`);

    // Clean up stored sessions
    await supabaseService.deleteStoreSessions(shop);

    // In a real implementation, you might also:
    // 1. Cancel any active subscriptions
    // 2. Clean up user data (according to GDPR)
    // 3. Remove webhooks (Shopify does this automatically)
    // 4. Cancel any background jobs

    logger.info(`App successfully uninstalled for shop: ${shop}`);

    res.json({
      success: true,
      message: 'App uninstalled successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Get current authentication status
router.get('/status', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const shop = extractShopFromToken(authHeader);
  
  if (!shop) {
    return res.json({
      success: true,
      data: {
        isAuthenticated: false,
        requiresAuth: true,
      },
    });
  }

  // Check if store exists and has valid sessions
  const store = await supabaseService.getStore(shop);
  const hasOfflineSession = !!(await supabaseService.getOfflineSession(shop));

  res.json({
    success: true,
    data: {
      shop,
      isAuthenticated: !!store,
      requiresAuth: !store,
      hasOfflineAccess: hasOfflineSession,
      installationRequired: !store,
    },
  });
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'modern-auth',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      shopifyApiVersion: shopify.config.apiVersion,
    },
  });
});

export default router;