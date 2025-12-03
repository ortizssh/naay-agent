import { Router, Request, Response, NextFunction } from 'express';
import { ConversionTrackingService } from '@/services/conversion-tracking.service';
import { logger } from '@/utils/logger';
import { AppError, APIResponse } from '@/types';

const router = Router();
const conversionTrackingService = new ConversionTrackingService();

/**
 * GET /api/analytics/conversion/metrics
 * Get comprehensive conversion metrics for a shop
 */
router.get(
  '/metrics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, from, to, include_breakdowns = 'true' } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      // Default to last 30 days if no date range provided
      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new AppError('Invalid date format. Use YYYY-MM-DD', 400);
      }

      const includeBreakdowns = include_breakdowns === 'true';

      const metrics = await conversionTrackingService.getConversionMetrics(
        shop as string,
        fromDate,
        toDate,
        includeBreakdowns
      );

      const response: APIResponse = {
        success: true,
        data: metrics,
        metadata: {
          timestamp: new Date().toISOString(),
          shop: shop as string,
          requestId: req.headers['x-request-id'] as string,
          version: '1.0',
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching conversion metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/funnel
 * Get conversion funnel metrics with step-by-step breakdown
 */
router.get(
  '/funnel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, from, to, breakdown = 'daily' } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      if (!['daily', 'weekly', 'monthly'].includes(breakdown as string)) {
        throw new AppError(
          'Invalid breakdown period. Use daily, weekly, or monthly',
          400
        );
      }

      // Get funnel data from the daily view
      const { data: funnelData, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient
        .from('conversion_funnel_daily')
        .select('*')
        .eq('shop_domain', shop)
        .gte('recommendation_date', fromDate.toISOString().split('T')[0])
        .lte('recommendation_date', toDate.toISOString().split('T')[0])
        .order('recommendation_date', { ascending: true });

      if (error) {
        throw new AppError(
          `Failed to fetch funnel data: ${error.message}`,
          500
        );
      }

      // Group by breakdown period if needed
      let groupedData = funnelData || [];
      if (breakdown !== 'daily') {
        // Implement weekly/monthly grouping here if needed
        // For now, return daily data
      }

      // Calculate overall funnel metrics
      const totalRecommendations = groupedData.reduce(
        (sum, day) => sum + (day.total_recommendations || 0),
        0
      );
      const totalCartConversions = groupedData.reduce(
        (sum, day) => sum + (day.cart_conversions || 0),
        0
      );
      const totalPurchaseConversions = groupedData.reduce(
        (sum, day) => sum + (day.purchase_conversions || 0),
        0
      );
      const totalRevenue = groupedData.reduce(
        (sum, day) => sum + parseFloat(day.attributed_revenue || 0),
        0
      );

      const funnelSteps = [
        {
          step: 'recommendations',
          label: 'AI Recommendations Made',
          count: totalRecommendations,
          rate: 1.0,
        },
        {
          step: 'cart_additions',
          label: 'Added to Cart',
          count: totalCartConversions,
          rate:
            totalRecommendations > 0
              ? totalCartConversions / totalRecommendations
              : 0,
        },
        {
          step: 'purchases',
          label: 'Completed Purchases',
          count: totalPurchaseConversions,
          rate:
            totalRecommendations > 0
              ? totalPurchaseConversions / totalRecommendations
              : 0,
        },
      ];

      const response: APIResponse = {
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          breakdown: breakdown,
          funnelSteps,
          totalRevenue,
          avgRevenuePerRecommendation:
            totalRecommendations > 0 ? totalRevenue / totalRecommendations : 0,
          avgRevenuePerPurchase:
            totalPurchaseConversions > 0
              ? totalRevenue / totalPurchaseConversions
              : 0,
          timeSeriesData: groupedData,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching funnel metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/top-products
 * Get top converting products from AI recommendations
 */
router.get(
  '/top-products',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        shop,
        from,
        to,
        limit = '10',
        sort_by = 'conversions',
      } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      const limitNum = parseInt(limit as string, 10);
      if (limitNum < 1 || limitNum > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }

      const { data: topProducts, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient.rpc('get_top_converting_products', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0],
        p_limit: limitNum,
      });

      if (error) {
        throw new AppError(
          `Failed to fetch top products: ${error.message}`,
          500
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          sortBy: sort_by,
          products: topProducts || [],
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching top converting products:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/recommendation-types
 * Get performance breakdown by recommendation type
 */
router.get(
  '/recommendation-types',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, from, to } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      const { data: typePerformance, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient.rpc(
        'get_recommendation_type_performance',
        {
          p_shop_domain: shop,
          p_date_from: fromDate.toISOString().split('T')[0],
          p_date_to: toDate.toISOString().split('T')[0],
        }
      );

      if (error) {
        throw new AppError(
          `Failed to fetch recommendation type performance: ${error.message}`,
          500
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          recommendationTypes: typePerformance || [],
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching recommendation type performance:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/time-to-conversion
 * Get time-to-conversion metrics (how long from recommendation to purchase)
 */
router.get(
  '/time-to-conversion',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, from, to } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      const { data: timeMetrics, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient.rpc('get_time_to_conversion_metrics', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0],
      });

      if (error) {
        throw new AppError(
          `Failed to fetch time to conversion metrics: ${error.message}`,
          500
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          timeToConversion: timeMetrics?.[0] || {
            avg_time_to_cart_hours: 0,
            avg_time_to_purchase_hours: 0,
            median_time_to_cart_hours: 0,
            median_time_to_purchase_hours: 0,
          },
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching time to conversion metrics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/cohort-analysis
 * Get cohort analysis showing conversion rates over time
 */
router.get(
  '/cohort-analysis',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, from, to, cohort_period = 'daily' } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      if (!['daily', 'weekly', 'monthly'].includes(cohort_period as string)) {
        throw new AppError(
          'Invalid cohort period. Use daily, weekly, or monthly',
          400
        );
      }

      const { data: cohortData, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient.rpc('get_conversion_cohort_analysis', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0],
        p_cohort_period: cohort_period,
      });

      if (error) {
        throw new AppError(
          `Failed to fetch cohort analysis: ${error.message}`,
          500
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          dateRange: { from: fromDate, to: toDate },
          cohortPeriod: cohort_period,
          cohorts: cohortData || [],
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching cohort analysis:', error);
      next(error);
    }
  }
);

/**
 * GET /api/analytics/conversion/session-funnel/:sessionId
 * Get conversion funnel for a specific chat session
 */
router.get(
  '/session-funnel/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const { shop } = req.query;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      const { data: sessionMetrics, error } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient.rpc('get_session_funnel_metrics', {
        p_session_id: sessionId,
        p_shop_domain: shop,
      });

      if (error) {
        throw new AppError(
          `Failed to fetch session metrics: ${error.message}`,
          500
        );
      }

      // Get detailed session data
      const { data: sessionRecommendations, error: recError } = await (
        conversionTrackingService as any
      ).supabaseService.serviceClient
        .from('ai_recommendation_events')
        .select(
          `
        *,
        attribution_events!left(
          cart_addition_event_id,
          order_line_item_id,
          attributed_revenue,
          time_to_cart_minutes,
          time_to_purchase_minutes
        )
      `
        )
        .eq('session_id', sessionId)
        .eq('shop_domain', shop)
        .order('created_at', { ascending: true });

      if (recError) {
        throw new AppError(
          `Failed to fetch session recommendations: ${recError.message}`,
          500
        );
      }

      const response: APIResponse = {
        success: true,
        data: {
          sessionMetrics: sessionMetrics?.[0] || {},
          recommendations: sessionRecommendations || [],
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching session funnel metrics:', error);
      next(error);
    }
  }
);

/**
 * POST /api/analytics/conversion/calculate-attribution
 * Manually trigger attribution calculation for a shop
 */
router.post(
  '/calculate-attribution',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        shop,
        attribution_window_hours = 720,
        lookback_days = 30,
      } = req.body;

      if (!shop) {
        throw new AppError('Shop domain is required', 400);
      }

      await conversionTrackingService.calculateAttribution(
        shop,
        parseInt(attribution_window_hours, 10),
        parseInt(lookback_days, 10)
      );

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Attribution calculation completed',
          shop,
          attributionWindowHours: attribution_window_hours,
          lookbackDays: lookback_days,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error calculating attribution:', error);
      next(error);
    }
  }
);

/**
 * POST /api/analytics/conversion/generate-snapshot
 * Generate analytics snapshot for a specific period
 */
router.post(
  '/generate-snapshot',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, date_from, date_to, snapshot_type = 'daily' } = req.body;

      if (!shop || !date_from || !date_to) {
        throw new AppError(
          'Shop domain, date_from, and date_to are required',
          400
        );
      }

      if (!['daily', 'weekly', 'monthly'].includes(snapshot_type)) {
        throw new AppError(
          'Invalid snapshot type. Use daily, weekly, or monthly',
          400
        );
      }

      await conversionTrackingService.generateAnalyticsSnapshot(
        shop,
        new Date(date_from),
        new Date(date_to),
        snapshot_type
      );

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Analytics snapshot generated',
          shop,
          dateFrom: date_from,
          dateTo: date_to,
          snapshotType: snapshot_type,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error generating analytics snapshot:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/analytics/conversion/cleanup/:shop
 * Clean up old conversion tracking data for a shop
 */
router.delete(
  '/cleanup/:shop',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop } = req.params;
      const { retention_days = 365 } = req.query;

      const retentionDays = parseInt(retention_days as string, 10);
      if (retentionDays < 1 || retentionDays > 3650) {
        throw new AppError(
          'Retention days must be between 1 and 3650 (10 years)',
          400
        );
      }

      await conversionTrackingService.cleanupOldData(shop, retentionDays);

      const response: APIResponse = {
        success: true,
        data: {
          message: 'Old conversion tracking data cleaned up',
          shop,
          retentionDays,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
      next(error);
    }
  }
);

export default router;
