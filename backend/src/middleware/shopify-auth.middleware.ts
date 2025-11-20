import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/utils/config';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError, ShopifyAuthError, ShopifySessionData, ErrorCode } from '@/types';
import { cacheService } from '@/services/cache.service';
import { ShopifyMonitoring } from '@/services/monitoring.service';

interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

interface AuthenticatedRequest extends Request {
  shop: string;
  userId: string;
  sessionToken: string;
  sessionId: string;
}

const supabaseService = new SupabaseService();

// Session token validation middleware (for embedded app requests)
export const validateSessionToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to get session token from Authorization header or query parameter
    let sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      sessionToken = req.query.session as string;
    }

    if (!sessionToken) {
      throw new AppError('Session token required for embedded app access', 401);
    }

    // Decode and verify the session token
    const payload = jwt.verify(
      sessionToken,
      config.shopify.apiSecret
    ) as SessionTokenPayload;

    // Validate token structure and claims
    if (!payload.dest || !payload.sub || !payload.aud || !payload.iss) {
      throw new AppError('Invalid session token structure', 401);
    }

    // Extract shop domain from dest (removes https:// and trailing slash)
    const shopDomain = payload.dest.replace('https://', '').replace(/\/$/, '');

    // Validate audience (should match our API key)
    if (payload.aud !== config.shopify.apiKey) {
      throw new AppError('Invalid session token audience', 401);
    }

    // Validate issuer (should be from Shopify)
    if (!payload.iss.includes('shopify.com')) {
      throw new AppError('Invalid session token issuer', 401);
    }

    // Check if token is not expired (jwt.verify already does this, but let's be explicit)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new AppError('Session token expired', 401);
    }

    // Check if store exists in our database
    const store = await supabaseService.getStore(shopDomain);
    if (!store) {
      throw new AppError(
        'Store not found - app may need to be reinstalled',
        404
      );
    }

    // Store session information in database for tracking
    await saveSessionInfo(payload, sessionToken);

    // Add shop and user info to request
    (req as AuthenticatedRequest).shop = shopDomain;
    (req as AuthenticatedRequest).userId = payload.sub;
    (req as AuthenticatedRequest).sessionToken = sessionToken;
    (req as AuthenticatedRequest).sessionId = payload.sid;

    logger.debug('Session token validated successfully', {
      shop: shopDomain,
      userId: payload.sub,
      sessionId: payload.sid,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid session token, trying legacy auth:', error.message);
      // Don't fail immediately, let the flexible auth try legacy
      return validateLegacyToken(req, res, next);
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired session token, trying legacy auth');
      return validateLegacyToken(req, res, next);
    } else {
      logger.error('Session token validation error:', error);
      next(error);
    }
  }
};

// Legacy JWT token validation (for backward compatibility)
export const validateLegacyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authorization token required', 401);
    }

    const decoded = jwt.verify(token, config.server.jwtSecret) as any;
    (req as any).shop = decoded.shop;
    (req as any).storeId = decoded.sub;

    logger.debug('Legacy token validated successfully', {
      shop: decoded.shop,
      storeId: decoded.sub,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

// Flexible authentication middleware that tries session token first, then legacy
export const validateAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for session token first (modern authentication)
    const sessionToken =
      req.headers.authorization?.replace('Bearer ', '') ||
      (req.query.session as string);

    logger.debug('Validating auth', {
      hasAuthHeader: !!req.headers.authorization,
      hasSessionParam: !!req.query.session,
      tokenPreview: sessionToken
        ? sessionToken.substring(0, 20) + '...'
        : 'none',
    });

    if (sessionToken && sessionToken.split('.').length === 3) {
      // Try to validate as session token
      try {
        // Manual JWT decode for inspection (just the payload part)
        const parts = sessionToken.split('.');
        const payload =
          parts.length === 3
            ? JSON.parse(Buffer.from(parts[1], 'base64').toString())
            : null;

        // Check if this looks like a Shopify session token
        if (
          payload &&
          (payload.dest || payload.aud === config.shopify.apiKey)
        ) {
          logger.debug('Detected session token, validating...');
          return await validateSessionToken(req, res, next);
        }

        // Check if this looks like our legacy JWT
        if (payload && payload.shop && payload.sub) {
          logger.debug('Detected legacy token, validating...');
          return validateLegacyToken(req, res, next);
        }
      } catch (err) {
        logger.warn(
          'Token decode failed, trying legacy validation:',
          err.message
        );
        // If token decode fails, try legacy anyway
      }
    }

    // Fall back to legacy token validation
    logger.debug('Falling back to legacy token validation');
    return validateLegacyToken(req, res, next);
  } catch (error) {
    logger.error('Auth validation error:', error);
    next(error);
  }
};

// Helper function to save session information for tracking
async function saveSessionInfo(
  payload: SessionTokenPayload,
  sessionToken: string
): Promise<void> {
  try {
    const shopDomain = payload.dest.replace('https://', '').replace(/\/$/, '');

    const { error } = await (supabaseService as any).serviceClient
      .from('shopify_sessions')
      .upsert(
        {
          session_id: payload.sid,
          shop_domain: shopDomain,
          user_id: payload.sub,
          expires_at: new Date(payload.exp * 1000),
          last_used: new Date(),
          session_token_hash: sessionToken.split('.').slice(0, 2).join('.'), // Store header.payload only for tracking
        },
        {
          onConflict: 'session_id',
        }
      );

    if (error) {
      logger.warn('Failed to save session info:', error);
    }
  } catch (error) {
    logger.warn('Error saving session info:', error);
  }
}

// Middleware to extract shop from various sources (for non-authenticated endpoints)
export const extractShop = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Try to get shop from query parameter, header, or subdomain
    const shop =
      (req.query.shop as string) ||
      (req.headers['x-shopify-shop-domain'] as string) ||
      req.get('X-Shopify-Shop-Domain');

    if (shop) {
      (req as any).shop = shop;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { AuthenticatedRequest };

// Enhanced session management with caching and monitoring
export class EnhancedShopifyAuth {
  private static readonly SESSION_TTL = 3600; // 1 hour

  // Cached session validation with monitoring
  static async validateCachedSession(shop: string, sessionToken?: string): Promise<ShopifySessionData | null> {
    const startTime = Date.now();
    
    if (!shop) return null;

    try {
      // Check cache first
      const cachedSession = await cacheService.getShopifySession(shop);
      if (cachedSession && this.isSessionValid(cachedSession)) {
        const authTime = Date.now() - startTime;
        ShopifyMonitoring.recordShopifyRequest(shop, 'session_cache_hit', authTime, true);
        return cachedSession;
      }

      // If we have a session token, validate it
      if (sessionToken) {
        const sessionData = await this.validateAndCacheSession(shop, sessionToken);
        if (sessionData) {
          const authTime = Date.now() - startTime;
          ShopifyMonitoring.recordShopifyRequest(shop, 'session_validation', authTime, true);
          return sessionData;
        }
      }

      // Fallback to database
      const store = await supabaseService.getStore(shop);
      if (store) {
        const sessionData: ShopifySessionData = {
          shop,
          accessToken: store.access_token,
          scopes: store.scopes,
          isOnline: false,
          installedAt: store.installed_at,
          updatedAt: store.updated_at
        };

        // Cache the session
        await cacheService.cacheShopifySession(shop, sessionData, this.SESSION_TTL);
        
        const authTime = Date.now() - startTime;
        ShopifyMonitoring.recordShopifyRequest(shop, 'session_db_fallback', authTime, true);
        return sessionData;
      }

      const authTime = Date.now() - startTime;
      ShopifyMonitoring.recordShopifyRequest(shop, 'session_not_found', authTime, false);
      return null;
    } catch (error) {
      const authTime = Date.now() - startTime;
      logger.error('Session validation failed', { shop, error: error.message });
      ShopifyMonitoring.recordShopifyRequest(shop, 'session_validation', authTime, false);
      return null;
    }
  }

  private static async validateAndCacheSession(shop: string, sessionToken: string): Promise<ShopifySessionData | null> {
    try {
      const payload = jwt.verify(sessionToken, config.shopify.apiSecret) as SessionTokenPayload;

      if (payload.dest !== `https://${shop}`) {
        throw new ShopifyAuthError('Session token shop mismatch', shop);
      }

      const sessionData: ShopifySessionData = {
        shop,
        accessToken: '', // Session tokens don't provide access token
        scopes: '',
        isOnline: true,
        userId: payload.sub,
        expiresAt: new Date(payload.exp * 1000),
        installedAt: new Date(),
        updatedAt: new Date()
      };

      // Cache the validated session
      const ttl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      await cacheService.cacheShopifySession(shop, sessionData, Math.min(ttl, this.SESSION_TTL));

      return sessionData;
    } catch (error) {
      logger.warn('Session token validation failed', { shop, error: error.message });
      return null;
    }
  }

  private static isSessionValid(session: ShopifySessionData): boolean {
    if (session.expiresAt && session.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  // Enhanced authentication middleware with monitoring
  static createAuthMiddleware(options: {
    requireAuth?: boolean;
    allowPublic?: boolean;
    requiredScopes?: string[];
  } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const { requireAuth = true, allowPublic = false, requiredScopes = [] } = options;

      try {
        const shop = (req.query.shop as string) || (req.body?.shop) || (req.headers['x-shopify-shop-domain'] as string);
        
        if (!shop && requireAuth) {
          throw new ShopifyAuthError('Shop parameter required');
        }

        if (!shop && allowPublic) {
          return next();
        }

        // Extract session token
        let sessionToken = req.headers.authorization?.replace('Bearer ', '');
        if (!sessionToken) {
          sessionToken = req.query.session as string;
        }

        // Validate session
        const sessionData = await this.validateCachedSession(shop, sessionToken);
        
        if (!sessionData && requireAuth) {
          throw new ShopifyAuthError('Valid session required', shop);
        }

        // Check required scopes
        if (sessionData && requiredScopes.length > 0) {
          const hasRequiredScopes = this.checkScopes(sessionData.scopes, requiredScopes);
          if (!hasRequiredScopes) {
            throw new ShopifyAuthError(`Missing required scopes: ${requiredScopes.join(', ')}`, shop);
          }
        }

        // Attach session data to request
        if (sessionData) {
          (req as any).shopifySession = sessionData;
          (req as any).shop = shop;
        }

        // Record successful auth
        const authTime = Date.now() - startTime;
        ShopifyMonitoring.recordShopifyRequest(shop || 'anonymous', 'auth_middleware', authTime, true);

        next();
      } catch (error) {
        const authTime = Date.now() - startTime;
        const shop = (req.query.shop as string) || 'anonymous';

        logger.warn('Authentication failed', {
          shop,
          error: error.message,
          path: req.path,
          method: req.method
        });

        ShopifyMonitoring.recordShopifyRequest(shop, 'auth_middleware', authTime, false);

        if (error instanceof ShopifyAuthError) {
          return res.status(401).json({
            success: false,
            error: {
              message: error.message,
              code: error.code,
              shopDomain: error.shopDomain
            }
          });
        }

        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication failed',
            code: ErrorCode.AUTHENTICATION_ERROR
          }
        });
      }
    };
  }

  private static checkScopes(userScopes: string, requiredScopes: string[]): boolean {
    if (!userScopes || requiredScopes.length === 0) return true;

    const scopes = userScopes.split(',').map(s => s.trim());
    return requiredScopes.every(required => scopes.includes(required));
  }

  // Shop authentication health check
  static async checkShopAuth(shop: string): Promise<{
    authenticated: boolean;
    sessionValid: boolean;
    lastActivity: Date | null;
    scopes?: string[];
  }> {
    try {
      const sessionData = await this.validateCachedSession(shop);
      
      if (!sessionData) {
        return {
          authenticated: false,
          sessionValid: false,
          lastActivity: null
        };
      }

      return {
        authenticated: true,
        sessionValid: this.isSessionValid(sessionData),
        lastActivity: sessionData.updatedAt,
        scopes: sessionData.scopes?.split(',').map(s => s.trim())
      };
    } catch (error) {
      logger.error('Shop auth health check failed', { shop, error: error.message });
      return {
        authenticated: false,
        sessionValid: false,
        lastActivity: null
      };
    }
  }
}
