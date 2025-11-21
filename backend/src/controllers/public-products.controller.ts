import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { EmbeddingService } from '@/services/embedding.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import Joi from 'joi';

const router = Router();
const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();

// Validation schemas
const searchSchema = Joi.object({
  shop: Joi.string().required(),
  q: Joi.string().required().min(1).max(200),
  limit: Joi.number().integer().min(1).max(50).default(10),
  skinType: Joi.string().optional(),
  category: Joi.string().optional(),
});

const recommendationSchema = Joi.object({
  shop: Joi.string().required(),
  skinType: Joi.string().optional(),
  concerns: Joi.array().items(Joi.string()).optional(),
  limit: Joi.number().integer().min(1).max(20).default(5),
  excludeProductIds: Joi.array().items(Joi.string()).optional(),
});

// Search products with semantic search
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = searchSchema.validate(req.body);
    if (error) {
      throw new AppError(`Validation error: ${error.details[0].message}`, 400);
    }

    const { shop, q, limit, skinType, category } = value;

    // Verify shop exists
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    logger.info('Product search request', {
      shop,
      query: q,
      limit,
      skinType,
      category,
    });

    // Perform semantic search using embeddings
    const products = await supabaseService.searchProductsSemantic(
      shop,
      q,
      limit,
      {
        skinType,
        category,
      }
    );

    // Transform products for public consumption
    const transformedProducts = products.map(product => ({
      id: product.id,
      shopifyProductId: product.shopify_product_id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compare_at_price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        shopifyVariantId: variant.shopify_variant_id,
        title: variant.title,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        available: variant.available,
        inventoryQuantity: variant.inventory_quantity,
        sku: variant.sku,
        weight: variant.weight,
        weightUnit: variant.weight_unit,
        options: variant.options,
      })) || [],
      similarity: product.similarity,
    }));

    logger.info('Product search completed', {
      shop,
      query: q,
      resultsCount: transformedProducts.length,
    });

    res.json({
      success: true,
      data: {
        products: transformedProducts,
        query: q,
        resultsCount: transformedProducts.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get product recommendations based on skin type and concerns
router.post('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = recommendationSchema.validate(req.body);
    if (error) {
      throw new AppError(`Validation error: ${error.details[0].message}`, 400);
    }

    const { shop, skinType, concerns, limit, excludeProductIds } = value;

    // Verify shop exists
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    logger.info('Product recommendations request', {
      shop,
      skinType,
      concerns,
      limit,
      excludeCount: excludeProductIds?.length || 0,
    });

    // Build recommendation query based on skin type and concerns
    let query = '';
    if (skinType) {
      query += `productos para piel ${skinType} `;
    }
    if (concerns && concerns.length > 0) {
      query += concerns.join(' ') + ' ';
    }
    
    // Default query if nothing specified
    if (!query.trim()) {
      query = 'productos recomendados cuidado piel natural';
    }

    // Perform semantic search for recommendations
    const products = await supabaseService.searchProductsSemantic(
      shop,
      query.trim(),
      limit + (excludeProductIds?.length || 0), // Get extra to account for exclusions
      {
        skinType,
      }
    );

    // Filter out excluded products
    const filteredProducts = excludeProductIds 
      ? products.filter(product => !excludeProductIds.includes(product.id))
      : products;

    // Take only the requested limit
    const recommendedProducts = filteredProducts.slice(0, limit);

    // Transform products for public consumption
    const transformedProducts = recommendedProducts.map(product => ({
      id: product.id,
      shopifyProductId: product.shopify_product_id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compare_at_price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        shopifyVariantId: variant.shopify_variant_id,
        title: variant.title,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        available: variant.available,
        inventoryQuantity: variant.inventory_quantity,
        sku: variant.sku,
        weight: variant.weight,
        weightUnit: variant.weight_unit,
        options: variant.options,
      })) || [],
      recommendationScore: product.similarity,
      recommendationReason: `Recomendado para piel ${skinType || 'tu tipo de piel'}${concerns ? ' con ' + concerns.join(', ') : ''}`,
    }));

    logger.info('Product recommendations completed', {
      shop,
      skinType,
      concerns,
      resultsCount: transformedProducts.length,
    });

    res.json({
      success: true,
      data: {
        products: transformedProducts,
        skinType,
        concerns,
        resultsCount: transformedProducts.length,
        query: query.trim(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single product by ID or handle
router.get('/product/:identifier', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier } = req.params;
    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw new AppError('Shop parameter is required', 400);
    }

    // Verify shop exists
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Try to find product by ID first, then by handle
    let product;
    if (identifier.match(/^[0-9]+$/)) {
      // Looks like a numeric ID
      product = await supabaseService.getProduct(shop, identifier);
    } else {
      // Treat as handle
      product = await supabaseService.getProductByHandle(shop, identifier);
    }

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Transform product for public consumption
    const transformedProduct = {
      id: product.id,
      shopifyProductId: product.shopify_product_id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compare_at_price,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      images: product.images,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        shopifyVariantId: variant.shopify_variant_id,
        title: variant.title,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        available: variant.available,
        inventoryQuantity: variant.inventory_quantity,
        sku: variant.sku,
        weight: variant.weight,
        weightUnit: variant.weight_unit,
        options: variant.options,
      })) || [],
    };

    logger.info('Product retrieved', {
      shop,
      productId: product.id,
      identifier,
    });

    res.json({
      success: true,
      data: {
        product: transformedProduct,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;