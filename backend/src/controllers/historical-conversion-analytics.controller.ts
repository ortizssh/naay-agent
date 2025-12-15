import { Router, Request, Response, NextFunction } from 'express';
import { HistoricalConversionAnalyticsService } from '@/services/historical-conversion-analytics.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const historicalAnalyticsService = new HistoricalConversionAnalyticsService();

/**
 * Run complete historical analysis for a shop
 * POST /api/historical-conversions/analyze
 * Body: { shop: string, fromDate?: string, toDate?: string, force?: boolean }
 */
router.post(
  '/analyze',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, fromDate, toDate, force = false } = req.body;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      logger.info('Starting historical conversion analysis', {
        shop,
        fromDate,
        toDate,
        force,
      });

      // Parse date parameters
      const fromDateParsed = fromDate ? new Date(fromDate) : undefined;
      const toDateParsed = toDate ? new Date(toDate) : undefined;

      // Validate dates
      if (fromDateParsed && isNaN(fromDateParsed.getTime())) {
        throw new AppError('Invalid fromDate format', 400);
      }
      if (toDateParsed && isNaN(toDateParsed.getTime())) {
        throw new AppError('Invalid toDate format', 400);
      }

      const startTime = Date.now();

      // Step 1: Extract historical recommendations from chat messages
      logger.info('Step 1: Extracting historical recommendations...');
      const recommendations =
        await historicalAnalyticsService.extractHistoricalRecommendations(shop);

      // Step 2: Fetch historical orders from Shopify
      logger.info('Step 2: Fetching historical Shopify orders...');
      const orders =
        await historicalAnalyticsService.fetchShopifyHistoricalOrders(
          shop,
          fromDateParsed,
          toDateParsed
        );

      // Step 3: Match recommendations to conversions
      logger.info('Step 3: Matching recommendations to conversions...');
      const conversions =
        await historicalAnalyticsService.matchHistoricalConversions(
          recommendations,
          orders
        );

      // Step 4: Generate analytics
      logger.info('Step 4: Generating conversion analytics...');
      const analytics =
        await historicalAnalyticsService.generateConversionAnalytics(
          conversions
        );

      // Step 5: Save historical conversions to database
      if (force || conversions.length > 0) {
        logger.info('Step 5: Saving historical conversions to database...');
        await historicalAnalyticsService.saveHistoricalConversions(
          shop,
          conversions
        );
      }

      const processingTime = Date.now() - startTime;

      logger.info('Historical conversion analysis completed', {
        shop,
        processingTimeMs: processingTime,
        recommendations: recommendations.length,
        orders: orders.length,
        conversions: conversions.length,
        conversionRate: analytics.conversionRate,
        totalRevenue: analytics.totalRevenue,
      });

      res.json({
        success: true,
        message: 'Historical conversion analysis completed',
        data: {
          processingTime: processingTime,
          statistics: {
            totalRecommendations: recommendations.length,
            totalOrders: orders.length,
            totalConversions: conversions.length,
            conversionRate: analytics.conversionRate,
            totalRevenue: analytics.totalRevenue,
          },
          analytics,
          conversions: conversions.slice(0, 50), // Return first 50 for preview
        },
      });
    } catch (error) {
      logger.error('Error in historical conversion analysis:', error);
      next(error);
    }
  }
);

/**
 * Get historical conversion analytics summary
 * GET /api/historical-conversions/summary?shop=example.myshopify.com
 */
router.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop domain is required', 400);
      }

      logger.info('Getting historical conversion summary', { shop });

      // Get existing conversions from database
      const { data: conversions, error } =
        await historicalAnalyticsService.supabaseService.client
          .from('simple_conversions')
          .select('*')
          .eq('shop_domain', shop)
          .order('purchased_at', { ascending: false });

      if (error) {
        throw new AppError(
          `Failed to fetch conversions: ${error.message}`,
          500
        );
      }

      const conversionData = conversions || [];

      // Transform to our format for analytics
      const historicalConversions = conversionData.map((conv: any) => ({
        id: `hist_${conv.id}`,
        sessionId: conv.session_id,
        recommendationId: `rec_${conv.session_id}`,
        orderId: conv.order_id,
        orderName: conv.order_id,
        productId: conv.product_id,
        productTitle: 'Historical Product', // Would need to fetch from products table
        recommendedAt: conv.recommended_at,
        purchasedAt: conv.purchased_at,
        minutesToConversion: conv.minutes_to_conversion,
        orderAmount: parseFloat(conv.order_amount || '0'),
        orderQuantity: conv.order_quantity,
        conversionConfidence: conv.confidence,
        attributionWindow:
          conv.minutes_to_conversion <= 30
            ? 'direct'
            : conv.minutes_to_conversion <= 1440
              ? 'assisted'
              : 'view_through',
      }));

      // Generate analytics
      const analytics =
        await historicalAnalyticsService.generateConversionAnalytics(
          historicalConversions
        );

      res.json({
        success: true,
        data: {
          hasHistoricalData: conversionData.length > 0,
          lastAnalysisDate:
            conversionData.length > 0 ? conversionData[0].created_at : null,
          analytics,
        },
      });
    } catch (error) {
      logger.error('Error getting historical conversion summary:', error);
      next(error);
    }
  }
);

/**
 * Get historical conversion timeline
 * GET /api/historical-conversions/timeline?shop=example.myshopify.com&period=30d
 */
router.get(
  '/timeline',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, period = '30d', granularity = 'daily' } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop domain is required', 400);
      }

      // Parse period (30d, 90d, 1y, etc.)
      const periodValue = parseInt(period.toString().replace(/[^\d]/g, ''));
      const periodUnit = period.toString().replace(/\d/g, '');

      let daysBack = 30; // default
      if (periodUnit === 'd') daysBack = periodValue;
      else if (periodUnit === 'w') daysBack = periodValue * 7;
      else if (periodUnit === 'm') daysBack = periodValue * 30;
      else if (periodUnit === 'y') daysBack = periodValue * 365;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get conversions within period
      const { data: conversions, error } =
        await historicalAnalyticsService.supabaseService.client
          .from('simple_conversions')
          .select('*')
          .eq('shop_domain', shop)
          .gte('purchased_at', startDate.toISOString())
          .order('purchased_at', { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch conversions: ${error.message}`,
          500
        );
      }

      const conversionData = conversions || [];

      // Group by time period
      const timeline = new Map<
        string,
        {
          conversions: number;
          revenue: number;
          orders: Set<string>;
        }
      >();

      conversionData.forEach((conv: any) => {
        const date = new Date(conv.purchased_at);
        let key = '';

        if (granularity === 'daily') {
          key = date.toISOString().split('T')[0];
        } else if (granularity === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else if (granularity === 'monthly') {
          key = date.toISOString().slice(0, 7); // YYYY-MM
        }

        if (!timeline.has(key)) {
          timeline.set(key, {
            conversions: 0,
            revenue: 0,
            orders: new Set(),
          });
        }

        const data = timeline.get(key)!;
        data.conversions++;
        data.revenue += parseFloat(conv.order_amount || '0');
        data.orders.add(conv.order_id);
      });

      const timelineData = Array.from(timeline.entries())
        .map(([date, data]) => ({
          date,
          conversions: data.conversions,
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        success: true,
        data: {
          period: `${periodValue}${periodUnit}`,
          granularity,
          timeline: timelineData,
          summary: {
            totalConversions: conversionData.length,
            totalRevenue: timelineData.reduce(
              (sum, item) => sum + item.revenue,
              0
            ),
            totalOrders: new Set(conversionData.map((c: any) => c.order_id))
              .size,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting historical conversion timeline:', error);
      next(error);
    }
  }
);

/**
 * Get top converting products from historical data
 * GET /api/historical-conversions/top-products?shop=example.myshopify.com&limit=10
 */
router.get(
  '/top-products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, limit = 10, period = '30d' } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop domain is required', 400);
      }

      const limitNum = Math.min(parseInt(limit.toString()) || 10, 100);

      // Parse period
      const periodValue = parseInt(period.toString().replace(/[^\d]/g, ''));
      const periodUnit = period.toString().replace(/\d/g, '');

      let daysBack = 30;
      if (periodUnit === 'd') daysBack = periodValue;
      else if (periodUnit === 'w') daysBack = periodValue * 7;
      else if (periodUnit === 'm') daysBack = periodValue * 30;
      else if (periodUnit === 'y') daysBack = periodValue * 365;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get conversions and products data
      const { data: conversions, error: convError } =
        await historicalAnalyticsService.supabaseService.client
          .from('simple_conversions')
          .select(
            `
          *,
          products:product_id (
            title,
            handle,
            images,
            vendor
          )
        `
          )
          .eq('shop_domain', shop)
          .gte('purchased_at', startDate.toISOString());

      if (convError) {
        throw new AppError(
          `Failed to fetch conversions: ${convError.message}`,
          500
        );
      }

      // Group by product
      const productStats = new Map<
        string,
        {
          productId: string;
          title: string;
          handle?: string;
          image?: string;
          vendor?: string;
          conversions: number;
          revenue: number;
          orders: Set<string>;
          averageTimeToConversion: number;
          totalMinutes: number;
        }
      >();

      (conversions || []).forEach((conv: any) => {
        const productId = conv.product_id;

        if (!productStats.has(productId)) {
          const product = Array.isArray(conv.products)
            ? conv.products[0]
            : conv.products;
          productStats.set(productId, {
            productId,
            title: product?.title || `Product ${productId}`,
            handle: product?.handle,
            image: product?.images?.[0]?.src,
            vendor: product?.vendor,
            conversions: 0,
            revenue: 0,
            orders: new Set(),
            averageTimeToConversion: 0,
            totalMinutes: 0,
          });
        }

        const stats = productStats.get(productId)!;
        stats.conversions++;
        stats.revenue += parseFloat(conv.order_amount || '0');
        stats.orders.add(conv.order_id);
        stats.totalMinutes += conv.minutes_to_conversion || 0;
        stats.averageTimeToConversion = stats.totalMinutes / stats.conversions;
      });

      const topProducts = Array.from(productStats.values())
        .map(stats => ({
          productId: stats.productId,
          title: stats.title,
          handle: stats.handle,
          image: stats.image,
          vendor: stats.vendor,
          conversions: stats.conversions,
          revenue: Math.round(stats.revenue * 100) / 100,
          orders: stats.orders.size,
          averageTimeToConversion: Math.round(stats.averageTimeToConversion),
          revenuePerConversion:
            stats.conversions > 0
              ? Math.round((stats.revenue / stats.conversions) * 100) / 100
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limitNum);

      res.json({
        success: true,
        data: {
          period: `${periodValue}${periodUnit}`,
          topProducts,
          summary: {
            totalProducts: productStats.size,
            totalConversions: Array.from(productStats.values()).reduce(
              (sum, p) => sum + p.conversions,
              0
            ),
            totalRevenue: Array.from(productStats.values()).reduce(
              (sum, p) => sum + p.revenue,
              0
            ),
          },
        },
      });
    } catch (error) {
      logger.error('Error getting top converting products:', error);
      next(error);
    }
  }
);

/**
 * Clear historical conversion data for a shop
 * DELETE /api/historical-conversions/clear?shop=example.myshopify.com
 */
router.delete(
  '/clear',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, confirm } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop domain is required', 400);
      }

      if (confirm !== 'yes') {
        throw new AppError(
          'Must confirm deletion with confirm=yes parameter',
          400
        );
      }

      logger.info('Clearing historical conversion data', { shop });

      const { error } = await historicalAnalyticsService.supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', shop);

      if (error) {
        throw new AppError(
          `Failed to clear conversions: ${error.message}`,
          500
        );
      }

      res.json({
        success: true,
        message: 'Historical conversion data cleared successfully',
      });
    } catch (error) {
      logger.error('Error clearing historical conversion data:', error);
      next(error);
    }
  }
);

/**
 * Re-analyze specific date range
 * POST /api/historical-conversions/re-analyze
 * Body: { shop: string, fromDate: string, toDate: string }
 */
router.post(
  '/re-analyze',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, fromDate, toDate } = req.body;

      if (!shop || !fromDate || !toDate) {
        throw new AppError('Shop, fromDate, and toDate are required', 400);
      }

      const fromDateParsed = new Date(fromDate);
      const toDateParsed = new Date(toDate);

      if (isNaN(fromDateParsed.getTime()) || isNaN(toDateParsed.getTime())) {
        throw new AppError('Invalid date format', 400);
      }

      logger.info('Re-analyzing historical conversions for date range', {
        shop,
        fromDate,
        toDate,
      });

      // First, clear existing data in this date range
      await historicalAnalyticsService.supabaseService.client
        .from('simple_conversions')
        .delete()
        .eq('shop_domain', shop)
        .gte('purchased_at', fromDateParsed.toISOString())
        .lte('purchased_at', toDateParsed.toISOString());

      // Run analysis for specific date range
      const recommendations =
        await historicalAnalyticsService.extractHistoricalRecommendations(shop);
      const orders =
        await historicalAnalyticsService.fetchShopifyHistoricalOrders(
          shop,
          fromDateParsed,
          toDateParsed
        );

      const conversions =
        await historicalAnalyticsService.matchHistoricalConversions(
          recommendations,
          orders
        );

      await historicalAnalyticsService.saveHistoricalConversions(
        shop,
        conversions
      );

      res.json({
        success: true,
        message: 'Re-analysis completed successfully',
        data: {
          dateRange: { fromDate, toDate },
          conversions: conversions.length,
          revenue: conversions.reduce((sum, conv) => sum + conv.orderAmount, 0),
        },
      });
    } catch (error) {
      logger.error('Error re-analyzing historical conversions:', error);
      next(error);
    }
  }
);

export default router;
