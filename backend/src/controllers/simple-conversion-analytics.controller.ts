import { Router, Request, Response, NextFunction } from 'express';
import { SimpleConversionTracker } from '@/services/simple-conversion-tracker.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const simpleConversionTracker = new SimpleConversionTracker();
const supabaseService = new SupabaseService();

/**
 * Get simple conversion statistics for a shop
 * GET /api/simple-conversions/stats?shop=example.myshopify.com&days=7
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, days = 7 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBack = parseInt(days as string) || 7;
    const stats = await simpleConversionTracker.getConversionStats(shop, daysBack);

    logger.info('Simple conversion stats retrieved', {
      shop,
      daysBack,
      conversionRate: stats.conversionRate,
      totalConversions: stats.totalConversions
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get recent recommendations for a shop
 * GET /api/simple-conversions/recommendations?shop=example.myshopify.com&limit=10
 */
router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, limit = 10 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 100);

    const { data: recommendations, error } = await (supabaseService as any).serviceClient
      .from('simple_recommendations')
      .select('*')
      .eq('shop_domain', shop)
      .gt('expires_at', new Date().toISOString()) // Not expired
      .order('recommended_at', { ascending: false })
      .limit(limitNum);

    if (error) {
      throw new AppError(`Failed to fetch recommendations: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: recommendations || [],
      count: recommendations?.length || 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get recent conversions for a shop
 * GET /api/simple-conversions/conversions?shop=example.myshopify.com&limit=10
 */
router.get('/conversions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, limit = 10 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const limitNum = Math.min(parseInt(limit as string) || 10, 100);

    const { data: conversions, error } = await (supabaseService as any).serviceClient
      .from('simple_conversions')
      .select('*')
      .eq('shop_domain', shop)
      .order('purchased_at', { ascending: false })
      .limit(limitNum);

    if (error) {
      throw new AppError(`Failed to fetch conversions: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: conversions || [],
      count: conversions?.length || 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Manual cleanup of expired recommendations
 * POST /api/simple-conversions/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.body;

    await simpleConversionTracker.cleanupExpiredRecommendations(shop);

    res.json({
      success: true,
      message: 'Cleanup completed'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get conversion dashboard data
 * GET /api/simple-conversions/dashboard?shop=example.myshopify.com
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, days = 7 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBack = parseInt(days as string) || 7;

    // Get stats
    const stats = await simpleConversionTracker.getConversionStats(shop, daysBack);

    // Get recent recommendations (active only)
    const { data: activeRecommendations } = await (supabaseService as any).serviceClient
      .from('simple_recommendations')
      .select('*')
      .eq('shop_domain', shop)
      .gt('expires_at', new Date().toISOString())
      .order('recommended_at', { ascending: false })
      .limit(5);

    // Get recent conversions
    const { data: recentConversions } = await (supabaseService as any).serviceClient
      .from('simple_conversions')
      .select('*')
      .eq('shop_domain', shop)
      .order('purchased_at', { ascending: false })
      .limit(5);

    // Get conversion timeline (daily for the past week)
    const { data: dailyStats } = await (supabaseService as any).serviceClient
      .rpc('get_daily_conversion_stats', {
        p_shop_domain: shop,
        p_days_back: daysBack
      });

    const dashboard = {
      stats,
      activeRecommendations: activeRecommendations || [],
      recentConversions: recentConversions || [],
      dailyStats: dailyStats || [],
      lastUpdated: new Date().toISOString()
    };

    logger.info('Simple conversion dashboard retrieved', {
      shop,
      daysBack,
      activeRecommendations: activeRecommendations?.length || 0,
      recentConversions: recentConversions?.length || 0
    });

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test endpoint to manually track a recommendation
 * POST /api/simple-conversions/test-recommendation
 */
router.post('/test-recommendation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, shopDomain, productId, productTitle } = req.body;

    if (!sessionId || !shopDomain || !productId) {
      throw new AppError('sessionId, shopDomain, and productId are required', 400);
    }

    await simpleConversionTracker.trackRecommendation({
      sessionId,
      shopDomain,
      productId,
      productTitle: productTitle || 'Test Product',
      recommendedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Test recommendation tracked',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
    });
  } catch (error) {
    next(error);
  }
});

export default router;