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
