import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { RateLimitError, ShopifyRateLimitError, ErrorCode } from '@/types';
import { cacheService } from '@/services/cache.service';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 auth requests per 15 min per IP
  message: {
    success: false,
    error: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 chat messages per minute
  message: {
    success: false,
    error: 'Too many chat messages, please slow down.',
  },
  keyGenerator: req => {
    // Rate limit by session ID if available, otherwise by IP
    return req.body?.session_id || req.ip;
  },
});

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // High limit for webhooks
  message: {
    success: false,
    error: 'Webhook rate limit exceeded.',
  },
  keyGenerator: req => {
    // Rate limit by shop domain
    return (req.headers['x-shopify-shop-domain'] as string) || req.ip;
  },
});

// Enhanced Shopify-specific rate limiters
export const createShopRateLimit = (
  requests: number,
  windowMs: number,
  endpoint?: string
) => {
  return rateLimit({
    windowMs,
    max: requests,
    keyGenerator: (req: Request) => {
      const shop =
        (req.query.shop as string) ||
        req.body?.shop ||
        (req.headers['x-shopify-shop-domain'] as string) ||
        'anonymous';
      return `shop:${shop}:${endpoint || req.route?.path || req.path}`;
    },
    handler: (req: Request, res: Response) => {
      const shop = (req.query.shop as string) || req.body?.shop;

      logger.warn(`Shop rate limit exceeded: ${endpoint}`, {
        shop,
        endpoint: endpoint || req.path,
        ip: req.ip,
        limit: requests,
        windowMs,
      });

      const resetTime = new Date(Date.now() + windowMs);
      const error = new RateLimitError(requests, resetTime, shop);

      res.status(429).json({
        success: false,
        error: error.toJSON(),
      });
    },
    message: {
      success: false,
      error: `Shop rate limit exceeded for ${endpoint}. Try again later.`,
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
    },
  });
};

// Specialized rate limiters for different endpoints
export const productSyncRateLimit = createShopRateLimit(10, 60 * 1000, 'sync'); // 10 requests per minute
export const adminRateLimit = createShopRateLimit(100, 60 * 1000, 'admin'); // 100 requests per minute (increased for dashboard)
export const adminBypassRateLimit = createShopRateLimit(
  1000,
  60 * 1000,
  'admin-bypass'
); // 1000 requests per minute (very permissive for dashboard)
export const widgetRateLimit = createShopRateLimit(200, 60 * 1000, 'widget'); // 200 requests per minute

// Advanced cache-based rate limiting for complex scenarios
export const advancedRateLimit = (
  identifier: string,
  limit: number,
  windowMs: number,
  errorMessage?: string
) => {
  return async (req: Request, res: Response, next: Function) => {
    try {
      const shop = (req.query.shop as string) || req.body?.shop;
      const key = `rate_limit:${identifier}:${shop || req.ip}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get request timestamps from cache
      const requests = (await cacheService.get<number[]>(key)) || [];

      // Remove old requests outside the window
      const validRequests = requests.filter(
        timestamp => timestamp > windowStart
      );

      // Check if limit exceeded
      if (validRequests.length >= limit) {
        const resetTime = new Date(Math.min(...validRequests) + windowMs);

        logger.warn(`Advanced rate limit exceeded: ${identifier}`, {
          shop,
          identifier,
          requests: validRequests.length,
          limit,
          ip: req.ip,
        });

        const error = shop
          ? new ShopifyRateLimitError(resetTime, shop, errorMessage)
          : new RateLimitError(limit, resetTime, shop);

        return res.status(429).json({
          success: false,
          error: error.toJSON(),
        });
      }

      // Add current request timestamp
      validRequests.push(now);
      await cacheService.set(key, validRequests, {
        ttl: Math.ceil(windowMs / 1000),
      });

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      next(); // Allow request on cache error
    }
  };
};

// Shopify API-aware rate limiting that respects Shopify's API limits
export const shopifyApiRateLimit = async (
  req: Request,
  res: Response,
  next: Function
) => {
  const shop = (req.query.shop as string) || req.body?.shop;

  if (!shop) {
    return next();
  }

  try {
    // Check if we have a recent Shopify rate limit hit
    const shopifyLimitKey = `shopify_rate_limit:${shop}`;
    const shopifyLimit = await cacheService.get<{ resetTime: string }>(
      shopifyLimitKey
    );

    if (shopifyLimit && new Date(shopifyLimit.resetTime) > new Date()) {
      const error = new ShopifyRateLimitError(
        new Date(shopifyLimit.resetTime),
        shop,
        'Shopify API rate limit in effect'
      );

      return res.status(429).json({
        success: false,
        error: error.toJSON(),
      });
    }

    next();
  } catch (error) {
    logger.error('Shopify rate limit check error:', error);
    next(); // Allow request on error
  }
};

// Function to record Shopify API rate limit hits from API responses
export const recordShopifyRateLimit = async (shop: string, resetTime: Date) => {
  try {
    const key = `shopify_rate_limit:${shop}`;
    const ttl = Math.max(
      1,
      Math.ceil((resetTime.getTime() - Date.now()) / 1000)
    );

    await cacheService.set(
      key,
      { resetTime: resetTime.toISOString() },
      { ttl }
    );

    logger.warn('Shopify API rate limit recorded', {
      shop,
      resetTime: resetTime.toISOString(),
      ttl,
    });
  } catch (error) {
    logger.error('Error recording Shopify rate limit:', error);
  }
};
