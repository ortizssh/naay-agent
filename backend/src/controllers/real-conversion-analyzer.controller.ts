import { Router, Request, Response, NextFunction } from 'express';
import { RealConversionAnalyzer } from '@/services/real-conversion-analyzer.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const analyzer = new RealConversionAnalyzer();

/**
 * Analyze real conversions using Shopify API data
 * POST /api/real-conversions/analyze
 * Body: { shop: string, daysBack?: number, saveResults?: boolean }
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, daysBack = 7, saveResults = true } = req.body;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBackNum = Math.min(parseInt(daysBack) || 7, 30); // Max 30 days
    
    logger.info('Starting real conversion analysis', {
      shop,
      daysBack: daysBackNum,
      saveResults,
      requestedBy: 'api'
    });

    const startTime = Date.now();
    const result = await analyzer.analyzeRealConversions(
      shop,
      daysBackNum,
      saveResults
    );
    const duration = Date.now() - startTime;

    logger.info('Real conversion analysis completed', {
      shop,
      ...result,
      duration,
      saveResults
    });

    res.json({
      success: true,
      data: {
        ...result,
        meta: {
          durationMs: duration,
          daysAnalyzed: daysBackNum,
          saveResults,
          analyzedAt: new Date().toISOString(),
          attributionWindowMinutes: 10
        }
      }
    });
  } catch (error) {
    logger.error('Error in real conversion analysis:', error);
    next(error);
  }
});

/**
 * Get real vs simulated conversion analytics
 * GET /api/real-conversions/analytics?shop=example.myshopify.com&daysBack=7
 */
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, daysBack = 30 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBackNum = Math.min(parseInt(daysBack as string) || 30, 90);

    const analytics = await analyzer.getRealConversionAnalytics(shop, daysBackNum);

    res.json({
      success: true,
      data: {
        ...analytics,
        period: {
          daysBack: daysBackNum,
          startDate: new Date(Date.now() - daysBackNum * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run analysis for all stores with recent recommendations
 * POST /api/real-conversions/analyze-all
 * Body: { daysBack?: number, saveResults?: boolean }
 */
router.post('/analyze-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { daysBack = 7, saveResults = true } = req.body;
    const daysBackNum = Math.min(parseInt(daysBack) || 7, 14); // Max 14 days for bulk analysis

    logger.info('Starting bulk real conversion analysis', {
      daysBack: daysBackNum,
      saveResults
    });

    // Get all shops with recent recommendations
    const { SupabaseService } = require('@/services/supabase.service');
    const supabaseService = new SupabaseService();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBackNum);

    const { data: shops, error } = await (supabaseService as any).serviceClient
      .from('simple_recommendations')
      .select('shop_domain')
      .gte('recommended_at', cutoffDate.toISOString())
;

    if (error) {
      throw new AppError(`Failed to get shops: ${error.message}`, 500);
    }

    const uniqueShops = [...new Set((shops || []).map(s => s.shop_domain))];
    logger.info('Found shops with recent recommendations', { 
      count: uniqueShops.length,
      shops: uniqueShops 
    });

    const results = [];
    const startTime = Date.now();

    for (const shop of uniqueShops) {
      try {
        const shopDomain = String(shop);
        const shopResult = await analyzer.analyzeRealConversions(
          shopDomain,
          daysBackNum,
          saveResults
        );
        
        results.push({
          shop,
          success: true,
          ...shopResult
        });

        logger.info('Completed analysis for shop', { 
          shop,
          conversions: shopResult.conversionsFound,
          orders: shopResult.ordersAnalyzed
        });
      } catch (shopError) {
        logger.error('Error analyzing shop:', { shop, error: shopError });
        results.push({
          shop,
          success: false,
          error: shopError instanceof Error ? shopError.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalConversions = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.conversionsFound || 0), 0);
    const totalRevenue = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.totalRevenue || 0), 0);

    logger.info('Bulk analysis completed', {
      shopsAnalyzed: uniqueShops.length,
      totalConversions,
      totalRevenue,
      duration
    });

    res.json({
      success: true,
      data: {
        summary: {
          shopsAnalyzed: uniqueShops.length,
          successfulAnalyses: results.filter(r => r.success).length,
          totalConversions,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          durationMs: duration
        },
        results
      }
    });
  } catch (error) {
    logger.error('Error in bulk conversion analysis:', error);
    next(error);
  }
});

/**
 * Get detailed comparison between AI recommendations and actual orders
 * GET /api/real-conversions/comparison?shop=example.myshopify.com&daysBack=7
 */
router.get('/comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, daysBack = 7 } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop domain is required', 400);
    }

    const daysBackNum = Math.min(parseInt(daysBack as string) || 7, 30);

    // Run analysis without saving to get fresh comparison
    const analysis = await analyzer.analyzeRealConversions(
      shop,
      daysBackNum,
      false // Don't save, just analyze
    );

    // Get analytics for comparison
    const analytics = await analyzer.getRealConversionAnalytics(shop, daysBackNum);

    // Prepare detailed comparison
    const comparison = {
      period: {
        daysBack: daysBackNum,
        startDate: new Date(Date.now() - daysBackNum * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      analysis: {
        ordersFromShopify: analysis.ordersAnalyzed,
        conversionsDetected: analysis.conversionsFound,
        totalRevenue: analysis.totalRevenue,
        conversionRate: analysis.summary.conversionRate,
        averageTime: analysis.summary.averageMinutesToConversion
      },
      historical: {
        realConversions: analytics.realConversions,
        simulatedConversions: analytics.simulatedConversions,
        accuracy: analytics.accuracy
      },
      insights: {
        effectivenessScore: analysis.summary.conversionRate > 0 ? 
          Math.min(100, analysis.summary.conversionRate * 10) : 0,
        recommendations: generateInsights(analysis, analytics)
      },
      topProducts: analysis.summary.topProducts,
      recentConversions: analysis.conversions.slice(0, 10).map(conv => ({
        sessionId: conv.sessionId.substring(0, 12) + '...',
        productTitle: conv.productTitle,
        minutesToConversion: conv.minutesToConversion,
        confidence: conv.confidence,
        orderAmount: conv.orderAmount,
        purchasedAt: conv.purchasedAt
      }))
    };

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test real conversion analysis with sample data
 * POST /api/real-conversions/test
 */
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop = 'naay-cosmetics.myshopify.com' } = req.body;

    logger.info('Running test real conversion analysis', { shop });

    // Run a 3-day analysis without saving
    const result = await analyzer.analyzeRealConversions(shop, 3, false);

    res.json({
      success: true,
      data: {
        ...result,
        note: 'This is a test analysis - results not saved to database',
        testDate: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error in test analysis:', error);
    next(error);
  }
});

// Helper function to generate insights
function generateInsights(
  analysis: any,
  analytics: any
): string[] {
  const insights = [];

  if (analysis.conversionsFound > 0) {
    insights.push(`AI recommendations generated ${analysis.conversionsFound} real conversions worth €${analysis.totalRevenue.toFixed(2)}`);
  }

  if (analysis.summary.conversionRate > 5) {
    insights.push(`High conversion rate of ${analysis.summary.conversionRate.toFixed(1)}% indicates effective AI recommendations`);
  } else if (analysis.summary.conversionRate > 0) {
    insights.push(`Conversion rate of ${analysis.summary.conversionRate.toFixed(1)}% shows room for improvement in recommendation quality`);
  }

  if (analysis.summary.averageMinutesToConversion < 5) {
    insights.push(`Fast average conversion time of ${analysis.summary.averageMinutesToConversion.toFixed(1)} minutes shows customers respond quickly to recommendations`);
  }

  if (analysis.ordersAnalyzed > 10 && analysis.conversionsFound === 0) {
    insights.push('No conversions detected despite multiple orders - consider reviewing product matching logic or extending attribution window');
  }

  if (analytics.accuracy > 80) {
    insights.push(`Model accuracy of ${analytics.accuracy.toFixed(1)}% indicates predictions closely match real conversions`);
  }

  if (analysis.summary.topProducts.length > 0) {
    const topProduct = analysis.summary.topProducts[0];
    insights.push(`"${topProduct.productTitle}" is the top converting product with ${topProduct.conversions} conversions`);
  }

  return insights.length > 0 ? insights : ['No significant patterns detected in current data'];
}

export default router;