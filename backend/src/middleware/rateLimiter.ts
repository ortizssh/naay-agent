import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.'
    });
  }
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 chat messages per minute
  message: {
    success: false,
    error: 'Too many chat messages, please slow down.'
  },
  keyGenerator: (req) => {
    // Rate limit by session ID if available, otherwise by IP
    return req.body?.session_id || req.ip;
  }
});

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // High limit for webhooks
  message: {
    success: false,
    error: 'Webhook rate limit exceeded.'
  },
  keyGenerator: (req) => {
    // Rate limit by shop domain
    return req.headers['x-shopify-shop-domain'] as string || req.ip;
  }
});