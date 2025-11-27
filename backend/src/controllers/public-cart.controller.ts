import { Router, Request, Response, NextFunction } from 'express';
import { CartService } from '@/services/cart.service';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import Joi from 'joi';

const router = Router();
const cartService = new CartService();
const supabaseService = new SupabaseService();

// Validation schemas
const createCartSchema = Joi.object({
  shop: Joi.string().required(),
});

const addToCartSchema = Joi.object({
  shop: Joi.string().required(),
  cartId: Joi.string().optional(),
  variantId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).default(1),
});

const updateCartSchema = Joi.object({
  shop: Joi.string().required(),
  cartId: Joi.string().required(),
  lines: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(), // line ID
        quantity: Joi.number().integer().min(0).required(),
        variantId: Joi.string().optional(),
      })
    )
    .required(),
});

// Create a new cart
router.post(
  '/create',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = createCartSchema.validate(req.body);
      if (error) {
        throw new AppError(
          `Validation error: ${error.details[0].message}`,
          400
        );
      }

      const { shop } = value;

      // Verify shop exists
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const cart = await cartService.createCart(shop);

      logger.info('Public cart created', {
        shop,
        cartId: cart.id,
        totalQuantity: cart.totalQuantity,
      });

      res.json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add items to cart
router.post('/add', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = addToCartSchema.validate(req.body);
    if (error) {
      throw new AppError(`Validation error: ${error.details[0].message}`, 400);
    }

    const { shop, cartId, variantId, quantity } = value;

    // Verify shop exists
    const store = await supabaseService.getStore(shop);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    let currentCartId = cartId;

    // Create cart if not provided
    if (!currentCartId) {
      const newCart = await cartService.createCart(shop);
      currentCartId = newCart.id;
    }

    // Convert variantId to GID format if it's just a number
    const formattedVariantId = variantId.startsWith('gid://')
      ? variantId
      : `gid://shopify/ProductVariant/${variantId}`;

    // Add item to cart
    const updatedCart = await cartService.addToCart(shop, currentCartId, [
      {
        merchandiseId: formattedVariantId,
        quantity,
      },
    ]);

    logger.info('Item added to public cart', {
      shop,
      cartId: currentCartId,
      variantId,
      quantity,
      totalQuantity: updatedCart.totalQuantity,
    });

    res.json({
      success: true,
      data: {
        cart: updatedCart,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get cart details
router.get(
  '/:cartId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cartId } = req.params;
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        throw new AppError('Shop parameter is required', 400);
      }

      // Verify shop exists
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const cart = await cartService.getCart(shop, cartId);

      logger.info('Public cart retrieved', {
        shop,
        cartId,
        totalQuantity: cart?.totalQuantity || 0,
      });

      res.json({
        success: true,
        data: {
          cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update cart lines
router.post(
  '/update',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = updateCartSchema.validate(req.body);
      if (error) {
        throw new AppError(
          `Validation error: ${error.details[0].message}`,
          400
        );
      }

      const { shop, cartId, lines } = value;

      // Verify shop exists
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Update cart
      const updatedCart = await cartService.updateCartLines(
        shop,
        cartId,
        lines
      );

      logger.info('Public cart updated', {
        shop,
        cartId,
        linesUpdated: lines.length,
        totalQuantity: updatedCart.totalQuantity,
      });

      res.json({
        success: true,
        data: {
          cart: updatedCart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove items from cart
router.post(
  '/remove',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shop, cartId, lineIds } = req.body;

      if (!shop || !cartId || !lineIds || !Array.isArray(lineIds)) {
        throw new AppError('Shop, cartId, and lineIds are required', 400);
      }

      // Verify shop exists
      const store = await supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Remove items from cart
      const updatedCart = await cartService.removeFromCart(
        shop,
        cartId,
        lineIds
      );

      logger.info('Items removed from public cart', {
        shop,
        cartId,
        lineIds,
        totalQuantity: updatedCart.totalQuantity,
      });

      res.json({
        success: true,
        data: {
          cart: updatedCart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
