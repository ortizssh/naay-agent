import { Router, Request, Response, NextFunction } from 'express';
import { ConversionTrackingService } from '@/services/conversion-tracking.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError, APIResponse } from '@/types';

const router = Router();
const conversionTrackingService = new ConversionTrackingService();
const supabaseService = new SupabaseService();

/**
 * GET /api/admin/analytics/conversion/dashboard
 * Get comprehensive dashboard data for conversion analytics
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      shop, 
      period = '30d' 
    } = req.query;

    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }

    // Calculate date range based on period
    const endDate = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get comprehensive metrics
    const [
      conversionMetrics,
      timeToConversionData,
      topProductsData,
      typePerformanceData,
      recentActivityData
    ] = await Promise.all([
      conversionTrackingService.getConversionMetrics(
        shop as string,
        startDate,
        endDate,
        true
      ),
      
      // Time to conversion metrics
      (supabaseService as any).serviceClient.rpc('get_time_to_conversion_metrics', {
        p_shop_domain: shop,
        p_date_from: startDate.toISOString().split('T')[0],
        p_date_to: endDate.toISOString().split('T')[0]
      }),
      
      // Top products
      (supabaseService as any).serviceClient.rpc('get_top_converting_products', {
        p_shop_domain: shop,
        p_date_from: startDate.toISOString().split('T')[0],
        p_date_to: endDate.toISOString().split('T')[0],
        p_limit: 5
      }),
      
      // Recommendation type performance
      (supabaseService as any).serviceClient.rpc('get_recommendation_type_performance', {
        p_shop_domain: shop,
        p_date_from: startDate.toISOString().split('T')[0],
        p_date_to: endDate.toISOString().split('T')[0]
      }),
      
      // Recent activity (last 24 hours)
      (supabaseService as any).serviceClient
        .from('ai_recommendation_events')
        .select(`
          id,
          created_at,
          recommended_product_id,
          recommendation_type,
          recommendation_position,
          attribution_events!left(
            id,
            cart_addition_event_id,
            order_line_item_id,
            attributed_revenue
          )
        `)
        .eq('shop_domain', shop)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    // Calculate key performance indicators
    const kpis = {
      totalRecommendations: conversionMetrics.totalRecommendations,
      totalRevenue: conversionMetrics.attributedRevenue,
      conversionRate: conversionMetrics.conversionRates.recommendationToPurchase,
      avgOrderValue: conversionMetrics.attributedOrders > 0 
        ? conversionMetrics.attributedRevenue / conversionMetrics.attributedOrders 
        : 0,
      roas: conversionMetrics.attributedRevenue / Math.max(conversionMetrics.totalRecommendations * 0.01, 1), // Assuming $0.01 cost per recommendation
      timeToConversion: timeToConversionData.data?.[0]?.avg_time_to_purchase_hours || 0
    };

    // Calculate trend data (compare with previous period)
    const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousMetrics = await conversionTrackingService.getConversionMetrics(
      shop as string,
      previousStartDate,
      startDate,
      false
    );

    const trends = {
      recommendations: calculateTrend(conversionMetrics.totalRecommendations, previousMetrics.totalRecommendations),
      revenue: calculateTrend(conversionMetrics.attributedRevenue, previousMetrics.attributedRevenue),
      conversionRate: calculateTrend(
        conversionMetrics.conversionRates.recommendationToPurchase,
        previousMetrics.conversionRates.recommendationToPurchase
      )
    };

    const dashboardData = {
      period,
      dateRange: { start: startDate, end: endDate },
      kpis,
      trends,
      conversionFunnel: [
        {
          step: 'Recommendations',
          count: conversionMetrics.totalRecommendations,
          rate: 1.0,
          color: '#3B82F6'
        },
        {
          step: 'Cart Additions',
          count: conversionMetrics.attributedCartAdditions,
          rate: conversionMetrics.conversionRates.recommendationToCart,
          color: '#10B981'
        },
        {
          step: 'Purchases',
          count: conversionMetrics.attributedOrders,
          rate: conversionMetrics.conversionRates.recommendationToPurchase,
          color: '#8B5CF6'
        }
      ],
      topProducts: topProductsData.data || [],
      recommendationTypePerformance: typePerformanceData.data || [],
      timeToConversion: timeToConversionData.data?.[0] || {},
      recentActivity: recentActivityData.data || []
    };

    const response: APIResponse = {
      success: true,
      data: dashboardData,
      metadata: {
        timestamp: new Date().toISOString(),
        shop: shop as string,
        requestId: req.headers['x-request-id'] as string,
        version: '1.0'
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching conversion analytics dashboard:', error);
    next(error);
  }
});

/**
 * GET /api/admin/analytics/conversion/performance-summary
 * Get performance summary with key metrics
 */
router.get('/performance-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }

    const endDate = new Date();
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get metrics for different periods
    const [monthlyMetrics, weeklyMetrics, allTimeMetrics] = await Promise.all([
      conversionTrackingService.getConversionMetrics(shop as string, last30Days, endDate, false),
      conversionTrackingService.getConversionMetrics(shop as string, last7Days, endDate, false),
      // All time metrics (last year)
      conversionTrackingService.getConversionMetrics(
        shop as string, 
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 
        endDate, 
        false
      )
    ]);

    const summary = {
      last7Days: {
        recommendations: weeklyMetrics.totalRecommendations,
        revenue: weeklyMetrics.attributedRevenue,
        conversions: weeklyMetrics.attributedOrders,
        conversionRate: weeklyMetrics.conversionRates.recommendationToPurchase
      },
      last30Days: {
        recommendations: monthlyMetrics.totalRecommendations,
        revenue: monthlyMetrics.attributedRevenue,
        conversions: monthlyMetrics.attributedOrders,
        conversionRate: monthlyMetrics.conversionRates.recommendationToPurchase
      },
      allTime: {
        recommendations: allTimeMetrics.totalRecommendations,
        revenue: allTimeMetrics.attributedRevenue,
        conversions: allTimeMetrics.attributedOrders,
        conversionRate: allTimeMetrics.conversionRates.recommendationToPurchase
      }
    };

    const response: APIResponse = {
      success: true,
      data: summary
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching performance summary:', error);
    next(error);
  }
});

/**
 * GET /api/admin/analytics/conversion/detailed-breakdown
 * Get detailed breakdown for admin analysis
 */
router.get('/detailed-breakdown', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      shop, 
      from, 
      to,
      granularity = 'daily' 
    } = req.query;

    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }

    const fromDate = from 
      ? new Date(from as string) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    // Get time series data from the daily funnel view
    const { data: timeSeriesData, error } = await (supabaseService as any).serviceClient
      .from('conversion_funnel_daily')
      .select('*')
      .eq('shop_domain', shop)
      .gte('recommendation_date', fromDate.toISOString().split('T')[0])
      .lte('recommendation_date', toDate.toISOString().split('T')[0])
      .order('recommendation_date', { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch time series data: ${error.message}`, 500);
    }

    // Get attribution conflicts and data quality metrics
    const { data: attributionConflicts } = await (supabaseService as any).serviceClient
      .rpc('detect_attribution_conflicts', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0]
      });

    // Get position effectiveness
    const { data: positionEffectiveness } = await (supabaseService as any).serviceClient
      .rpc('get_position_effectiveness', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0]
      });

    const breakdown = {
      dateRange: { from: fromDate, to: toDate },
      granularity,
      timeSeries: timeSeriesData || [],
      positionEffectiveness: positionEffectiveness || [],
      dataQuality: {
        attributionConflicts: attributionConflicts || [],
        conflictCount: attributionConflicts?.length || 0
      }
    };

    const response: APIResponse = {
      success: true,
      data: breakdown
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching detailed breakdown:', error);
    next(error);
  }
});

/**
 * GET /api/admin/analytics/conversion/ai-impact
 * Get AI impact analysis showing value generated by the assistant
 */
router.get('/ai-impact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, period = '30d' } = req.query;

    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }

    const endDate = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const metrics = await conversionTrackingService.getConversionMetrics(
      shop as string,
      startDate,
      endDate,
      true
    );

    // Calculate impact metrics
    const avgOrderValue = metrics.attributedOrders > 0 
      ? metrics.attributedRevenue / metrics.attributedOrders 
      : 0;

    const assumedCostPerRecommendation = 0.02; // $0.02 per recommendation
    const totalCost = metrics.totalRecommendations * assumedCostPerRecommendation;
    const roi = totalCost > 0 ? ((metrics.attributedRevenue - totalCost) / totalCost) * 100 : 0;

    const impact = {
      period,
      totalRevenueGenerated: metrics.attributedRevenue,
      totalOrdersGenerated: metrics.attributedOrders,
      avgOrderValue,
      totalRecommendationsMade: metrics.totalRecommendations,
      conversionRate: metrics.conversionRates.recommendationToPurchase,
      estimatedCost: totalCost,
      roi,
      valuePerRecommendation: metrics.totalRecommendations > 0 
        ? metrics.attributedRevenue / metrics.totalRecommendations 
        : 0,
      topPerformingTypes: Object.entries(metrics.recommendationTypePerformance)
        .sort(([,a], [,b]) => b.revenue - a.revenue)
        .slice(0, 3),
      topPerformingProducts: metrics.topPerformingProducts.slice(0, 5),
      insights: [
        {
          type: 'revenue_impact',
          message: `AI recommendations generated $${metrics.attributedRevenue.toFixed(2)} in attributed revenue`,
          value: metrics.attributedRevenue,
          trend: 'positive'
        },
        {
          type: 'efficiency',
          message: `${(metrics.conversionRates.recommendationToPurchase * 100).toFixed(1)}% of AI recommendations converted to purchases`,
          value: metrics.conversionRates.recommendationToPurchase,
          trend: metrics.conversionRates.recommendationToPurchase > 0.05 ? 'positive' : 'neutral'
        },
        {
          type: 'roi',
          message: `${roi.toFixed(0)}% ROI on AI recommendation system`,
          value: roi,
          trend: roi > 100 ? 'positive' : roi > 0 ? 'neutral' : 'negative'
        }
      ]
    };

    const response: APIResponse = {
      success: true,
      data: impact
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching AI impact analysis:', error);
    next(error);
  }
});

/**
 * POST /api/admin/analytics/conversion/export
 * Export conversion analytics data
 */
router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shop, from, to, format = 'csv' } = req.body;

    if (!shop) {
      throw new AppError('Shop domain is required', 400);
    }

    if (!from || !to) {
      throw new AppError('Date range is required', 400);
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Get comprehensive data for export
    const [
      dailyFunnel,
      topProducts,
      typePerformance,
      detailedRecommendations
    ] = await Promise.all([
      (supabaseService as any).serviceClient
        .from('conversion_funnel_daily')
        .select('*')
        .eq('shop_domain', shop)
        .gte('recommendation_date', fromDate.toISOString().split('T')[0])
        .lte('recommendation_date', toDate.toISOString().split('T')[0])
        .order('recommendation_date'),

      (supabaseService as any).serviceClient.rpc('get_top_converting_products', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0],
        p_limit: 50
      }),

      (supabaseService as any).serviceClient.rpc('get_recommendation_type_performance', {
        p_shop_domain: shop,
        p_date_from: fromDate.toISOString().split('T')[0],
        p_date_to: toDate.toISOString().split('T')[0]
      }),

      (supabaseService as any).serviceClient
        .from('ai_recommendation_events')
        .select(`
          id,
          created_at,
          recommended_product_id,
          recommendation_type,
          recommendation_context,
          attribution_events!left(
            attributed_revenue,
            time_to_cart_minutes,
            time_to_purchase_minutes
          )
        `)
        .eq('shop_domain', shop)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at')
    ]);

    const exportData = {
      exportTimestamp: new Date().toISOString(),
      shop,
      dateRange: { from: fromDate, to: toDate },
      summary: {
        totalDays: dailyFunnel.data?.length || 0,
        totalRecommendations: dailyFunnel.data?.reduce((sum: number, day: any) => sum + (day.total_recommendations || 0), 0) || 0,
        totalRevenue: dailyFunnel.data?.reduce((sum: number, day: any) => sum + parseFloat(day.attributed_revenue || 0), 0) || 0
      },
      dailyFunnel: dailyFunnel.data || [],
      topProducts: topProducts.data || [],
      typePerformance: typePerformance.data || [],
      detailedRecommendations: detailedRecommendations.data || []
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="conversion-analytics-${shop}-${fromDate.toISOString().split('T')[0]}-${toDate.toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: exportData
      });
    }
  } catch (error) {
    logger.error('Error exporting conversion analytics:', error);
    next(error);
  }
});

// Helper functions
function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'neutral' };
  }
  
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  };
}

function convertToCSV(data: any): string {
  // Simple CSV conversion for daily funnel data
  const headers = ['Date', 'Recommendations', 'Cart Conversions', 'Purchase Conversions', 'Revenue', 'Conversion Rate'];
  const rows = [headers.join(',')];
  
  if (data.dailyFunnel) {
    data.dailyFunnel.forEach((day: any) => {
      rows.push([
        day.recommendation_date,
        day.total_recommendations || 0,
        day.cart_conversions || 0,
        day.purchase_conversions || 0,
        parseFloat(day.attributed_revenue || 0).toFixed(2),
        parseFloat(day.purchase_conversion_rate || 0).toFixed(4)
      ].join(','));
    });
  }
  
  return rows.join('\n');
}

export default router;