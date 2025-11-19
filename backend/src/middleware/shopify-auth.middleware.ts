import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/utils/config';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

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
    const payload = jwt.verify(sessionToken, config.shopify.apiSecret) as SessionTokenPayload;
    
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
      throw new AppError('Store not found - app may need to be reinstalled', 404);
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
      sessionId: payload.sid
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
      storeId: decoded.sub
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
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || req.query.session as string;
    
    logger.debug('Validating auth', {
      hasAuthHeader: !!req.headers.authorization,
      hasSessionParam: !!req.query.session,
      tokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : 'none'
    });
    
    if (sessionToken && sessionToken.split('.').length === 3) {
      // Try to validate as session token
      try {
        // Manual JWT decode for inspection (just the payload part)
        const parts = sessionToken.split('.');
        const payload = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], 'base64').toString()) : null;
        
        // Check if this looks like a Shopify session token
        if (payload && (payload.dest || payload.aud === config.shopify.apiKey)) {
          logger.debug('Detected session token, validating...');
          return await validateSessionToken(req, res, next);
        }
        
        // Check if this looks like our legacy JWT
        if (payload && payload.shop && payload.sub) {
          logger.debug('Detected legacy token, validating...');
          return validateLegacyToken(req, res, next);
        }
      } catch (err) {
        logger.warn('Token decode failed, trying legacy validation:', err.message);
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
async function saveSessionInfo(payload: SessionTokenPayload, sessionToken: string): Promise<void> {
  try {
    const shopDomain = payload.dest.replace('https://', '').replace(/\/$/, '');
    
    const { error } = await (supabaseService as any).serviceClient
      .from('shopify_sessions')
      .upsert({
        session_id: payload.sid,
        shop_domain: shopDomain,
        user_id: payload.sub,
        expires_at: new Date(payload.exp * 1000),
        last_used: new Date(),
        session_token_hash: sessionToken.split('.').slice(0, 2).join('.') // Store header.payload only for tracking
      }, {
        onConflict: 'session_id'
      });

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
    const shop = req.query.shop as string || 
                 req.headers['x-shopify-shop-domain'] as string ||
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