import { Router, Request, Response, NextFunction } from 'express';
import { HistoricalConversionMigrator } from '@/services/historical-conversion-migrator.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const migrator = new HistoricalConversionMigrator();

/**
 * Get migration status for a shop
 * GET /api/migration/status?shop=example.myshopify.com
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const status = await migrator.getMigrationStatus(shop);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run historical conversion migration (dry run by default)
 * POST /api/migration/convert
 * Body: { shop?: string, daysBack?: number, dryRun?: boolean }
 */
router.post('/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      shop, 
      daysBack = 30, 
      dryRun = true 
    } = req.body;

    // Validate parameters
    const daysBackNum = parseInt(daysBack) || 30;
    if (daysBackNum < 1 || daysBackNum > 365) {
      throw new AppError('daysBack must be between 1 and 365', 400);
    }

    logger.info('Starting historical conversion migration', {
      shop,
      daysBack: daysBackNum,
      dryRun,
      requestedBy: 'admin'
    });

    const startTime = Date.now();
    const result = await migrator.migrateHistoricalConversions(
      shop, 
      daysBackNum, 
      dryRun
    );
    const duration = Date.now() - startTime;

    logger.info('Historical migration completed', {
      ...result.processed,
      duration,
      dryRun
    });

    res.json({
      success: true,
      data: {
        ...result,
        meta: {
          durationMs: duration,
          dryRun,
          attributionWindowMinutes: 10
        }
      }
    });
  } catch (error) {
    logger.error('Error in historical conversion migration:', error);
    next(error);
  }
});

/**
 * Preview conversion matches without saving (always dry run)
 * POST /api/migration/preview
 * Body: { shop?: string, daysBack?: number, limit?: number }
 */
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      shop, 
      daysBack = 7, 
      limit = 20 
    } = req.body;

    const daysBackNum = Math.min(parseInt(daysBack) || 7, 30); // Limit preview to 30 days max
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Limit results

    const result = await migrator.migrateHistoricalConversions(
      shop, 
      daysBackNum, 
      true // Always dry run for preview
    );

    // Limit conversions for preview
    const previewConversions = result.conversions.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        processed: result.processed,
        summary: result.summary,
        sampleConversions: previewConversions,
        meta: {
          totalConversions: result.conversions.length,
          showingFirst: previewConversions.length,
          daysBack: daysBackNum,
          preview: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get detailed conversion analysis for a specific time period
 * GET /api/migration/analysis?shop=example.myshopify.com&daysBack=7
 */
router.get('/analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, daysBack = 7 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBackNum = Math.min(parseInt(daysBack as string) || 7, 90);

    // Run dry run migration to get analysis
    const result = await migrator.migrateHistoricalConversions(
      shop, 
      daysBackNum, 
      true
    );

    // Analyze conversion patterns
    const analysis = {
      overview: {
        totalRecommendations: result.processed.recommendations,
        totalOrders: result.processed.orders,
        totalConversions: result.processed.conversions,
        conversionRate: result.summary.conversionRate,
        totalRevenue: result.summary.totalRevenue,
        averageMinutesToConversion: result.summary.averageMinutesToConversion
      },
      patterns: {
        conversionsByMinute: analyzeConversionTiming(result.conversions),
        conversionsByProduct: analyzeProductConversions(result.conversions),
        conversionsBySession: analyzeSessionConversions(result.conversions),
        revenueDistribution: analyzeRevenueDistribution(result.conversions)
      },
      recommendations: generateRecommendations(result)
    };

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear existing historical conversions (for re-migration)
 * DELETE /api/migration/clear?shop=example.myshopify.com&confirm=yes
 */
router.delete('/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, confirm } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    if (confirm !== 'yes') {
      throw new AppError('Must confirm deletion with confirm=yes parameter', 400);
    }

    logger.warn('Clearing historical conversions', { shop, requestedBy: 'admin' });

    // Delete existing conversions for this shop
    const { error, count } = await (migrator as any).supabaseService.serviceClient
      .from('simple_conversions')
      .delete()
      .eq('shop_domain', shop);

    if (error) {
      throw new AppError(`Failed to clear conversions: ${error.message}`, 500);
    }

    logger.info('Historical conversions cleared', { shop, deletedCount: count });

    res.json({
      success: true,
      data: {
        shop,
        deletedCount: count,
        message: 'Historical conversions cleared successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions for analysis

function analyzeConversionTiming(conversions: any[]): any {
  const timingBuckets = {
    '0-2 min': 0,
    '3-5 min': 0,
    '6-8 min': 0,
    '9-10 min': 0
  };

  conversions.forEach(conv => {
    const minutes = conv.minutesToConversion;
    if (minutes <= 2) timingBuckets['0-2 min']++;
    else if (minutes <= 5) timingBuckets['3-5 min']++;
    else if (minutes <= 8) timingBuckets['6-8 min']++;
    else timingBuckets['9-10 min']++;
  });

  return timingBuckets;
}

function analyzeProductConversions(conversions: any[]): any[] {
  const productMap = new Map();
  
  conversions.forEach(conv => {
    const key = conv.productId;
    if (!productMap.has(key)) {
      productMap.set(key, {
        productId: conv.productId,
        conversions: 0,
        totalRevenue: 0,
        avgMinutesToConversion: 0
      });
    }
    const product = productMap.get(key);
    product.conversions++;
    product.totalRevenue += conv.orderAmount;
  });

  // Calculate averages and sort by conversions
  return Array.from(productMap.values())
    .map(p => ({
      ...p,
      avgMinutesToConversion: conversions
        .filter(c => c.productId === p.productId)
        .reduce((sum, c) => sum + c.minutesToConversion, 0) / p.conversions,
      avgRevenuePerConversion: p.totalRevenue / p.conversions
    }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10); // Top 10 products
}

function analyzeSessionConversions(conversions: any[]): any {
  const sessionMap = new Map();
  
  conversions.forEach(conv => {
    if (!sessionMap.has(conv.sessionId)) {
      sessionMap.set(conv.sessionId, {
        sessionId: conv.sessionId,
        conversions: 0,
        totalRevenue: 0,
        products: new Set()
      });
    }
    const session = sessionMap.get(conv.sessionId);
    session.conversions++;
    session.totalRevenue += conv.orderAmount;
    session.products.add(conv.productId);
  });

  return {
    totalSessions: sessionMap.size,
    sessionsWithMultipleConversions: Array.from(sessionMap.values())
      .filter(s => s.conversions > 1).length,
    avgConversionsPerSession: Array.from(sessionMap.values())
      .reduce((sum, s) => sum + s.conversions, 0) / sessionMap.size,
    avgRevenuePerSession: Array.from(sessionMap.values())
      .reduce((sum, s) => sum + s.totalRevenue, 0) / sessionMap.size
  };
}

function analyzeRevenueDistribution(conversions: any[]): any {
  const revenues = conversions.map(c => c.orderAmount).sort((a, b) => a - b);
  const total = revenues.reduce((sum, r) => sum + r, 0);
  
  return {
    totalRevenue: total,
    averageRevenue: total / revenues.length,
    medianRevenue: revenues[Math.floor(revenues.length / 2)],
    minRevenue: revenues[0],
    maxRevenue: revenues[revenues.length - 1],
    revenueRanges: {
      'under_10': revenues.filter(r => r < 10).length,
      '10_to_50': revenues.filter(r => r >= 10 && r < 50).length,
      '50_to_100': revenues.filter(r => r >= 50 && r < 100).length,
      'over_100': revenues.filter(r => r >= 100).length
    }
  };
}

function generateRecommendations(result: any): string[] {
  const recommendations = [];
  
  if (result.summary.conversionRate > 10) {
    recommendations.push('High conversion rate detected - migration would provide valuable historical insights');
  }
  
  if (result.summary.averageMinutesToConversion < 3) {
    recommendations.push('Very fast conversions - customers are highly responsive to recommendations');
  }
  
  if (result.processed.conversions > 50) {
    recommendations.push('Significant historical conversion data available - recommend running full migration');
  } else if (result.processed.conversions < 10) {
    recommendations.push('Limited conversion data - consider increasing attribution window or checking recommendation quality');
  }
  
  if (result.summary.totalRevenue > 1000) {
    recommendations.push('High-value conversions detected - tracking will help optimize AI recommendations');
  }

  return recommendations;
}

export default router;