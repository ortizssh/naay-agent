import { Request, Response, NextFunction } from 'express';
import { tenantService } from '@/services/tenant.service';
import { logger } from '@/utils/logger';
import {
  TenantError,
  TenantErrorCode,
  TenantFeatures,
  ErrorCode,
} from '@/types';

/**
 * Extended request with tenant info
 */
export interface TenantRequest extends Request {
  shop: string;
  tenant?: {
    id: string;
    plan: string;
    status: string;
    features: TenantFeatures;
  };
}

/**
 * Middleware to validate shop context matches authenticated shop
 *
 * This ensures that the shop parameter in the request matches
 * the authenticated shop from the session token.
 */
export const validateShopContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authenticatedShop = (req as any).shop;

    // Get shop from various sources in request
    const requestShop =
      req.body?.shop ||
      req.query?.shop ||
      req.params?.shop ||
      req.headers['x-shopify-shop-domain'];

    // If no request shop specified, use authenticated shop
    if (!requestShop) {
      next();
      return;
    }

    // Validate match
    if (requestShop !== authenticatedShop) {
      logger.warn('Shop context mismatch detected', {
        authenticatedShop,
        requestShop,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Shop context mismatch - access denied',
          code: ErrorCode.AUTHORIZATION_ERROR,
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in validateShopContext:', error);
    next(error);
  }
};

/**
 * Middleware to validate tenant access
 *
 * Checks that:
 * - Tenant exists
 * - Tenant is not suspended/cancelled
 * - Trial has not expired
 * - Usage limits are not exceeded
 */
export const validateTenantAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const shop = (req as any).shop;

    if (!shop) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Shop authentication required',
          code: ErrorCode.AUTHENTICATION_ERROR,
        },
      });
      return;
    }

    // Validate tenant can access the service
    await tenantService.validateTenantAccess(shop);

    // Get tenant info and attach to request
    const tenant = await tenantService.getTenant(shop);
    if (tenant) {
      (req as TenantRequest).tenant = {
        id: tenant.id,
        plan: tenant.plan,
        status: tenant.status,
        features: tenant.features,
      };
    }

    // Record activity
    tenantService.recordActivity(shop).catch(() => {
      // Non-critical, ignore errors
    });

    next();
  } catch (error) {
    if (error instanceof TenantError) {
      logger.warn('Tenant access denied', {
        shop: (req as any).shop,
        error: error.message,
        code: error.metadata?.tenantErrorCode,
      });

      const statusCode =
        error.metadata?.tenantErrorCode === TenantErrorCode.USAGE_LIMIT_EXCEEDED
          ? 429
          : 403;

      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.metadata?.tenantErrorCode,
          ...(error.metadata?.tenantErrorCode ===
            TenantErrorCode.USAGE_LIMIT_EXCEEDED && {
            usage: {
              used: error.metadata?.used,
              limit: error.metadata?.limit,
            },
          }),
        },
      });
      return;
    }

    logger.error('Error in validateTenantAccess:', error);
    next(error);
  }
};

/**
 * Middleware to check if tenant can use a specific feature
 */
export const requireFeature = (feature: keyof TenantFeatures) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Shop authentication required',
            code: ErrorCode.AUTHENTICATION_ERROR,
          },
        });
        return;
      }

      const canUse = await tenantService.canUseFeature(shop, feature);

      if (!canUse) {
        logger.info('Feature access denied', {
          shop,
          feature,
          path: req.path,
        });

        res.status(403).json({
          success: false,
          error: {
            message: `This feature (${feature}) is not available in your current plan. Please upgrade to access it.`,
            code: TenantErrorCode.FEATURE_NOT_AVAILABLE,
            feature,
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in requireFeature:', error);
      next(error);
    }
  };
};

/**
 * Middleware to track message usage
 *
 * Should be used AFTER the chat response is sent successfully
 */
export const trackMessageUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to track usage after successful response
  res.json = (body: any) => {
    // Only track on successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const shop = (req as any).shop;
      if (shop) {
        // Invalidate monthly count cache so next validation gets fresh count
        tenantService.invalidateMessageCountCache(shop).catch(() => {});
      }
    }

    return originalJson(body);
  };

  next();
};

/**
 * Rate limiter per tenant/shop
 *
 * Creates a rate limiter that tracks requests per shop instead of globally
 */
export const createTenantRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
}) => {
  const shopRequests: Map<string, { count: number; resetTime: number }> =
    new Map();

  return (req: Request, res: Response, next: NextFunction): void => {
    const shop = (req as any).shop;

    if (!shop) {
      // If no shop, fall through to other middleware
      next();
      return;
    }

    const now = Date.now();
    const shopData = shopRequests.get(shop);

    if (!shopData || now > shopData.resetTime) {
      // New window
      shopRequests.set(shop, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      next();
      return;
    }

    if (shopData.count >= options.maxRequests) {
      const retryAfter = Math.ceil((shopData.resetTime - now) / 1000);

      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', shopData.resetTime.toString());

      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests. Please try again later.',
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          retryAfter,
        },
      });
      return;
    }

    // Increment count
    shopData.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
    res.setHeader(
      'X-RateLimit-Remaining',
      (options.maxRequests - shopData.count).toString()
    );
    res.setHeader('X-RateLimit-Reset', shopData.resetTime.toString());

    next();
  };
};

/**
 * Combine multiple tenant middlewares for convenience
 */
export const tenantGuard = [validateShopContext, validateTenantAccess];

/**
 * Full tenant protection with usage tracking
 */
export const tenantProtection = [
  validateShopContext,
  validateTenantAccess,
  trackMessageUsage,
];
