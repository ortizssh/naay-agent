import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyService } from '@/services/shopify.service';
import { SupabaseService } from '@/services/supabase.service';
import { QueueService } from '@/services/queue.service';
import { EmbeddingService } from '@/services/embedding.service';
import { verifyToken } from './auth.controller';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

const router = Router();
const shopifyService = new ShopifyService();
const supabaseService = new SupabaseService();
const queueService = new QueueService();
const embeddingService = new EmbeddingService();

// All routes require authentication
router.use(verifyToken);

// Manual sync trigger (for admin panel)
router.post(
  '/sync',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;

      // Get store details to get access token
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Trigger full sync job
      const job = await queueService.addFullSyncJob(shop, store.access_token);

      logger.info(`Manual sync triggered for shop: ${shop}`, {
        jobId: job?.id || 'direct',
      });

      res.json({
        success: true,
        message: 'Product sync started',
        data: {
          jobId: job?.id || 'direct-processing',
          shop,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get sync status
router.get(
  '/sync/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queueStats = await queueService.getQueueStats();
      const activeJobs = await queueService.getActiveJobs();

      res.json({
        success: true,
        data: {
          queues: queueStats,
          activeJobs,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Search products semantically
router.get(
  '/search',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const { q, limit = 10 } = req.query;

      if (!q || typeof q !== 'string') {
        throw new AppError('Search query is required', 400);
      }

      // Generate embedding for search query
      const queryEmbedding = await embeddingService.generateEmbedding(q);

      // Search in Supabase using pgvector
      const results = await supabaseService.searchProducts(
        shop,
        q,
        queryEmbedding,
        parseInt(limit as string)
      );

      logger.info(`Semantic search performed for shop: ${shop}`, {
        query: q,
        resultsCount: results.length,
      });

      res.json({
        success: true,
        data: {
          query: q,
          results,
          total: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get product recommendations
router.get(
  '/recommendations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const { cart_products, limit = 5 } = req.query;

      let cartProductIds: string[] = [];

      if (cart_products) {
        if (typeof cart_products === 'string') {
          cartProductIds = cart_products.split(',');
        } else if (Array.isArray(cart_products)) {
          cartProductIds = cart_products.map(p =>
            typeof p === 'string' ? p : String(p)
          );
        }
      }

      if (cartProductIds.length === 0) {
        return res.json({
          success: true,
          data: {
            recommendations: [],
            message: 'No cart products provided for recommendations',
          },
        });
      }

      // Use database function for recommendations
      const { data, error } = await (supabaseService as any).serviceClient.rpc(
        'get_product_recommendations',
        {
          shop_domain: shop,
          cart_product_ids: cartProductIds,
          recommendation_count: parseInt(limit as string),
        }
      );

      if (error) {
        throw new AppError(
          `Failed to get recommendations: ${error.message}`,
          500
        );
      }

      res.json({
        success: true,
        data: {
          recommendations: data || [],
          basedOn: cartProductIds,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get similar products
router.get(
  '/:productId/similar',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const { productId } = req.params;
      const { limit = 5 } = req.query;

      // Use database function for similar products
      const { data, error } = await (supabaseService as any).serviceClient.rpc(
        'get_similar_products',
        {
          shop_domain: shop,
          product_id: productId,
          similarity_count: parseInt(limit as string),
        }
      );

      if (error) {
        throw new AppError(
          `Failed to get similar products: ${error.message}`,
          500
        );
      }

      res.json({
        success: true,
        data: {
          productId,
          similarProducts: data || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get recommended products with conversion analytics for admin panel
router.get('/recommended-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const { days = 7, limit = 50 } = req.query;

    const daysBack = parseInt(days as string) || 7;
    const limitNum = Math.min(parseInt(limit as string) || 50, 200);

    // Get products that have been recommended by AI in the specified period
    const { data: recommendedProducts, error: recError } = await (supabaseService as any).serviceClient
      .from('simple_recommendations')
      .select(`
        product_id,
        product_title,
        shop_domain,
        COUNT(*) as recommendation_count,
        MIN(recommended_at) as first_recommended,
        MAX(recommended_at) as last_recommended
      `)
      .eq('shop_domain', shop)
      .gte('recommended_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
      .groupBy('product_id, product_title, shop_domain')
      .order('recommendation_count', { ascending: false })
      .limit(limitNum);

    if (recError) {
      throw new AppError(`Failed to fetch recommended products: ${recError.message}`, 500);
    }

    // Get conversion data for these products
    const productIds = (recommendedProducts || []).map(p => p.product_id);
    
    let conversionsData = [];
    if (productIds.length > 0) {
      const { data: conversions, error: convError } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .select(`
          product_id,
          COUNT(*) as conversion_count,
          SUM(CAST(total_amount AS DECIMAL)) as total_revenue,
          AVG(CAST(total_amount AS DECIMAL)) as avg_order_value,
          AVG(minutes_to_conversion) as avg_conversion_time
        `)
        .eq('shop_domain', shop)
        .in('product_id', productIds)
        .gte('purchased_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .groupBy('product_id');

      if (convError) {
        logger.warn('Error fetching conversion data:', convError);
      } else {
        conversionsData = conversions || [];
      }
    }

    // Combine recommendation and conversion data
    const analytics = (recommendedProducts || []).map(product => {
      const conversionData = conversionsData.find(c => c.product_id === product.product_id) || {};
      
      const conversionCount = parseInt(conversionData.conversion_count) || 0;
      const recommendationCount = parseInt(product.recommendation_count) || 0;
      const conversionRate = recommendationCount > 0 ? (conversionCount / recommendationCount * 100) : 0;

      return {
        productId: product.product_id,
        productTitle: product.product_title,
        recommendations: recommendationCount,
        conversions: conversionCount,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalRevenue: parseFloat(conversionData.total_revenue) || 0,
        avgOrderValue: parseFloat(conversionData.avg_order_value) || 0,
        avgConversionTime: parseFloat(conversionData.avg_conversion_time) || 0,
        firstRecommended: product.first_recommended,
        lastRecommended: product.last_recommended,
        performance: conversionRate >= 15 ? 'excellent' : 
                    conversionRate >= 8 ? 'good' : 
                    conversionRate >= 3 ? 'fair' : 'poor'
      };
    }).sort((a, b) => b.conversionRate - a.conversionRate);

    // Calculate summary stats
    const totalRecommendations = analytics.reduce((sum, p) => sum + p.recommendations, 0);
    const totalConversions = analytics.reduce((sum, p) => sum + p.conversions, 0);
    const totalRevenue = analytics.reduce((sum, p) => sum + p.totalRevenue, 0);
    const overallConversionRate = totalRecommendations > 0 ? (totalConversions / totalRecommendations * 100) : 0;

    logger.info(`Product recommendation analytics retrieved for shop: ${shop}`, {
      daysBack,
      productsAnalyzed: analytics.length,
      totalRecommendations,
      totalConversions,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100
    });

    res.json({
      success: true,
      data: {
        products: analytics,
        summary: {
          totalProducts: analytics.length,
          totalRecommendations,
          totalConversions,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          overallConversionRate: Math.round(overallConversionRate * 100) / 100,
          avgOrderValue: totalConversions > 0 ? Math.round((totalRevenue / totalConversions) * 100) / 100 : 0
        },
        period: {
          days: daysBack,
          startDate: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all products (paginated)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = (req as any).shop;
    const { page = 1, limit = 20, search } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = (supabaseService as any).serviceClient
      .from('products')
      .select(
        `
        id,
        title,
        description,
        handle,
        vendor,
        product_type,
        tags,
        images,
        created_at,
        updated_at
      `
      )
      .eq('shop_domain', shop)
      .range(offset, offset + parseInt(limit as string) - 1)
      .order('updated_at', { ascending: false });

    // Add search filter if provided
    if (search && typeof search === 'string') {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,vendor.ilike.%${search}%`
      );
    }

    const { data: products, error, count } = await query;

    if (error) {
      throw new AppError(`Failed to fetch products: ${error.message}`, 500);
    }

    const totalPages = Math.ceil((count || 0) / parseInt(limit as string));

    res.json({
      success: true,
      data: products || [],
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        pages: totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get product conversion analytics
router.get(
  '/:productId/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const { productId } = req.params;
      const { days = 30 } = req.query;

      const daysBack = parseInt(days as string) || 30;

      // Get basic product info
      const { data: product, error: productError } = await (supabaseService as any).serviceClient
        .from('products')
        .select('id, title, description, handle, vendor, product_type')
        .eq('shop_domain', shop)
        .eq('id', productId)
        .single();

      if (productError) {
        if (productError.code === 'PGRST116') {
          throw new AppError('Product not found', 404);
        }
        throw new AppError(`Failed to fetch product: ${productError.message}`, 500);
      }

      // Get recommendation statistics
      const { data: recStats } = await (supabaseService as any).serviceClient
        .from('simple_recommendations')
        .select('*')
        .eq('shop_domain', shop)
        .eq('product_id', productId)
        .gte('recommended_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('recommended_at', { ascending: false });

      // Get conversion statistics
      const { data: convStats } = await (supabaseService as any).serviceClient
        .from('simple_conversions')
        .select('*')
        .eq('shop_domain', shop)
        .eq('product_id', productId)
        .gte('purchased_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('purchased_at', { ascending: false });

      // Calculate metrics
      const totalRecommendations = recStats?.length || 0;
      const totalConversions = convStats?.length || 0;
      const conversionRate = totalRecommendations > 0 ? (totalConversions / totalRecommendations * 100) : 0;
      const totalRevenue = convStats?.reduce((sum, conv) => sum + (parseFloat(conv.total_amount) || 0), 0) || 0;
      const avgConversionTime = convStats?.length > 0 ? 
        convStats.reduce((sum, conv) => sum + (conv.minutes_to_conversion || 0), 0) / convStats.length : 0;

      // Get timeline data (daily breakdown)
      const timelineData = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayRecommendations = recStats?.filter(rec => 
          rec.recommended_at.startsWith(dateStr)
        ).length || 0;
        
        const dayConversions = convStats?.filter(conv => 
          conv.purchased_at.startsWith(dateStr)
        ).length || 0;

        const dayRevenue = convStats?.filter(conv => 
          conv.purchased_at.startsWith(dateStr)
        ).reduce((sum, conv) => sum + (parseFloat(conv.total_amount) || 0), 0) || 0;

        timelineData.push({
          date: dateStr,
          recommendations: dayRecommendations,
          conversions: dayConversions,
          revenue: Math.round(dayRevenue * 100) / 100,
          conversionRate: dayRecommendations > 0 ? Math.round((dayConversions / dayRecommendations * 100) * 100) / 100 : 0
        });
      }

      const analytics = {
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          vendor: product.vendor,
          productType: product.product_type
        },
        summary: {
          totalRecommendations,
          totalConversions,
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgOrderValue: totalConversions > 0 ? Math.round((totalRevenue / totalConversions) * 100) / 100 : 0,
          avgConversionTime: Math.round(avgConversionTime * 10) / 10,
          performance: conversionRate >= 15 ? 'excellent' : 
                      conversionRate >= 8 ? 'good' : 
                      conversionRate >= 3 ? 'fair' : 'poor'
        },
        timeline: timelineData,
        recentRecommendations: recStats?.slice(0, 10) || [],
        recentConversions: convStats?.slice(0, 10) || [],
        period: {
          days: daysBack,
          startDate: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      };

      logger.info(`Product analytics retrieved for ${productId}`, {
        shop,
        productId,
        recommendations: totalRecommendations,
        conversions: totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100
      });

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single product details
router.get(
  '/:productId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = (req as any).shop;
      const { productId } = req.params;

      const { data: product, error } = await (
        supabaseService as any
      ).serviceClient
        .from('products')
        .select(
          `
        *,
        product_variants (*)
      `
        )
        .eq('shop_domain', shop)
        .eq('id', productId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new AppError('Product not found', 404);
        }
        throw new AppError(`Failed to fetch product: ${error.message}`, 500);
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
