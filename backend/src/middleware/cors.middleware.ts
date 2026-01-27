import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

interface CorsConfig {
  origins: (string | RegExp)[];
  methods: string[];
  allowedHeaders: string[];
  maxAge: string;
}

// Shopify-specific allowed origins
const SHOPIFY_ORIGINS = [
  /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
  /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,
  /^https:\/\/admin\.shopify\.com$/,
];

// Custom store domain patterns
const CUSTOM_STORE_ORIGINS = [/^https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/];

// Development origins
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

export class CorsMiddleware {
  /**
   * Widget-specific CORS middleware for widget script loading
   * Most permissive to allow embedding anywhere
   */
  static widgetScript() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path.includes('kova-widget.js')) {
        // Remove any existing restrictive headers
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('Cross-Origin-Resource-Policy');
        res.removeHeader('Cross-Origin-Opener-Policy');

        // Set permissive headers for widget script
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', '');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        logger.debug('Widget script CORS headers set');
      }
      next();
    };
  }

  /**
   * API-specific CORS middleware for widget API endpoints
   */
  static widgetApi() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/widget')) {
        this.setApiCorsHeaders(res, '*');

        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }

        logger.debug('Widget API CORS headers set for:', req.path);
      }
      next();
    };
  }

  /**
   * Chat API CORS middleware with Shopify domain validation
   */
  static chatApi() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (
        req.path.startsWith('/api/chat') ||
        req.path.startsWith('/api/simple-chat')
      ) {
        const origin = req.get('Origin');
        const allowedOrigin = this.validateOrigin(origin, SHOPIFY_ORIGINS);

        if (allowedOrigin) {
          res.setHeader('Access-Control-Allow-Origin', origin!);
          res.setHeader('Vary', 'Origin');
        } else if (!origin) {
          res.setHeader('Access-Control-Allow-Origin', '*');
        }

        this.setApiCorsHeaders(res);

        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }

        logger.debug('Chat API CORS headers set:', {
          path: req.path,
          origin,
          allowed: !!allowedOrigin,
        });
      }
      next();
    };
  }

  /**
   * Public API CORS middleware for public endpoints
   */
  static publicApi() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/public')) {
        const origin = req.get('Origin');
        const allowedOrigins = [...SHOPIFY_ORIGINS, ...CUSTOM_STORE_ORIGINS];
        const allowedOrigin = this.validateOrigin(origin, allowedOrigins);

        if (allowedOrigin || !origin) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
          if (origin) {
            res.setHeader('Vary', 'Origin');
          }
        }

        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS'
        );
        this.setApiCorsHeaders(res);

        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }

        logger.debug('Public API CORS headers set:', {
          path: req.path,
          origin,
          allowed: !!allowedOrigin,
        });
      }
      next();
    };
  }

  /**
   * General application CORS middleware
   */
  static general() {
    const config: CorsConfig = {
      origins:
        process.env.NODE_ENV === 'production'
          ? [
              process.env.SHOPIFY_APP_URL || '',
              ...SHOPIFY_ORIGINS,
              /.*\.shop\.app$/,
            ].filter(Boolean)
          : DEV_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: '86400',
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('Origin');

      if (origin) {
        const allowed = config.origins.some(allowedOrigin => {
          if (typeof allowedOrigin === 'string') {
            return allowedOrigin === origin;
          }
          return allowedOrigin.test(origin);
        });

        if (allowed) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
        }
      }

      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
      res.setHeader(
        'Access-Control-Allow-Headers',
        config.allowedHeaders.join(', ')
      );
      res.setHeader('Access-Control-Max-Age', config.maxAge);
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * Frame options middleware for Shopify embedding
   */
  static frameOptions() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Don't apply to widget files
      if (!req.path.includes('kova-widget.js')) {
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader(
          'Content-Security-Policy',
          "frame-ancestors 'self' https://*.shopify.com https://*.shop.app https://admin.shopify.com https://*.myshopify.com;"
        );
      }
      next();
    };
  }

  /**
   * Helper method to set common API CORS headers
   */
  private static setApiCorsHeaders(res: Response, origin?: string) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * Helper method to validate origin against allowed patterns
   */
  private static validateOrigin(
    origin: string | undefined,
    allowedOrigins: (string | RegExp)[]
  ): boolean {
    if (!origin) return false;

    return allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      }
      return pattern.test(origin);
    });
  }
}
