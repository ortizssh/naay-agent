import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy for sensitive features
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // HSTS for HTTPS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        // Basic XSS prevention - remove script tags
        req.query[key] = (req.query[key] as string)
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potentially dangerous content
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Request size limit middleware
export const requestSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');

  // Limit to 1MB for regular requests
  const maxSize = req.path.includes('/chat') ? 1024 * 1024 : 1024 * 1024; // 1MB

  if (contentLength > maxSize) {
    logger.warn(`Request size limit exceeded: ${contentLength} bytes`, {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(413).json({
      success: false,
      error: 'Request too large'
    });
  }

  next();
};

// Audit logging middleware
export const auditLog = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log request
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    shopDomain: req.headers['x-shopify-shop-domain'] || req.query.shop,
    sessionId: req.body?.session_id,
    timestamp: new Date().toISOString()
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;

    logger.info('API Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? data.length : 0,
      timestamp: new Date().toISOString()
    });

    return originalSend.call(this, data);
  };

  next();
};

// IP whitelist for admin endpoints (optional)
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.connection.remoteAddress;

    if (!allowedIPs.includes(clientIP)) {
      logger.warn(`IP not in whitelist: ${clientIP}`, {
        path: req.path,
        method: req.method,
        ip: clientIP
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    next();
  };
};

// API key authentication for admin endpoints
export const apiKeyAuth = (validApiKeys: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (validApiKeys.length === 0) {
      return next(); // No API key required
    }

    const apiKey = req.headers['x-api-key'] as string ||
                   req.query.api_key as string;

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      logger.warn('Invalid or missing API key', {
        path: req.path,
        ip: req.ip,
        hasApiKey: !!apiKey
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    next();
  };
};