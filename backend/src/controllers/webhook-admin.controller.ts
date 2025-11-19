import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyService } from '@/services/shopify.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { verifyToken } from './auth.controller';

const router = Router();
const shopifyService = new ShopifyService();
const supabaseService = new SupabaseService();

// List webhooks for authenticated store
router.get('/list', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    // Get store to access token
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    logger.info(`Listing webhooks for shop: ${shop}`);
    
    const webhooks = await shopifyService.listWebhooks(shop, store.access_token);
    
    res.json({
      success: true,
      data: {
        webhooks,
        count: webhooks.length,
        shop
      },
    });
  } catch (error) {
    logger.error('Error listing webhooks:', error);
    next(error);
  }
});

// Create/recreate webhooks for authenticated store
router.post('/create', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    // Get store to access token
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    logger.info(`Creating webhooks for shop: ${shop}`);
    
    await shopifyService.createWebhooks(shop, store.access_token);
    
    res.json({
      success: true,
      message: 'Webhooks created successfully',
      shop
    });
  } catch (error) {
    logger.error('Error creating webhooks:', error);
    next(error);
  }
});

// Delete a specific webhook
router.delete('/:webhookId', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const { webhookId } = req.params;
    
    // Get store to access token
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    logger.info(`Deleting webhook ${webhookId} for shop: ${shop}`);
    
    await shopifyService.deleteWebhook(shop, store.access_token, webhookId);
    
    res.json({
      success: true,
      message: 'Webhook deleted successfully',
      webhookId,
      shop
    });
  } catch (error) {
    logger.error('Error deleting webhook:', error);
    next(error);
  }
});

// Get webhook statistics and events
router.get('/stats', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Getting webhook stats for shop: ${shop}`);
    
    // Get recent webhook events from our database
    const { data: events, error } = await (supabaseService as any).serviceClient
      .from('webhook_events')
      .select('topic, verified, processed, created_at')
      .eq('shop_domain', shop)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new AppError(`Failed to fetch webhook events: ${error.message}`, 500);
    }

    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEvents = events?.filter(event => 
      new Date(event.created_at) >= today
    ) || [];

    const stats = {
      total: events?.length || 0,
      today: todayEvents.length,
      verified: events?.filter(e => e.verified).length || 0,
      processed: events?.filter(e => e.processed).length || 0,
      pending: events?.filter(e => e.verified && !e.processed).length || 0,
      topicBreakdown: {}
    };

    // Group by topic
    events?.forEach(event => {
      if (!stats.topicBreakdown[event.topic]) {
        stats.topicBreakdown[event.topic] = 0;
      }
      stats.topicBreakdown[event.topic]++;
    });

    res.json({
      success: true,
      data: {
        stats,
        recentEvents: events?.slice(0, 10) || [],
        shop
      },
    });
  } catch (error) {
    logger.error('Error getting webhook stats:', error);
    next(error);
  }
});

// Test webhook endpoint connectivity
router.post('/test', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Testing webhook connectivity for shop: ${shop}`);
    
    // Test by making a simple request to our webhook endpoints
    const testResults = [];
    const webhookEndpoints = [
      '/api/webhooks/products/create',
      '/api/webhooks/products/update', 
      '/api/webhooks/products/delete',
      '/api/webhooks/app/uninstalled'
    ];

    for (const endpoint of webhookEndpoints) {
      try {
        const response = await fetch(`${process.env.SHOPIFY_APP_URL}${endpoint}`, {
          method: 'GET'
        });
        testResults.push({
          endpoint,
          status: 'reachable',
          statusCode: response.status
        });
      } catch (error) {
        testResults.push({
          endpoint,
          status: 'unreachable',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        testResults,
        appUrl: process.env.SHOPIFY_APP_URL,
        shop
      },
    });
  } catch (error) {
    logger.error('Error testing webhooks:', error);
    next(error);
  }
});

export default router;