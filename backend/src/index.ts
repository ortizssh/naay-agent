import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import { config, validateConfig } from '@/utils/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import { requestLogger } from '@/middleware/requestLogger';
import {
  securityHeaders,
  sanitizeInput,
  auditLog,
} from '@/middleware/security';

// Route imports
import authRoutes from '@/controllers/auth.controller';
import productRoutes from '@/controllers/product.controller';
import webhookRoutes from '@/controllers/webhook.controller';
import webhookAdminRoutes from '@/controllers/webhook-admin.controller';
import chatRoutes from '@/controllers/chat.controller';
import healthRoutes from '@/controllers/health.controller';
import widgetRoutes from '@/controllers/widget.controller';
import settingsRoutes from '@/controllers/settings.controller';
import adminRoutes from '@/controllers/admin.controller';
import adminBypassRoutes from '@/controllers/admin-bypass.controller';
import simpleChatRoutes from '@/controllers/simple-chat.controller';
import publicCartRoutes from '@/controllers/public-cart.controller';
import publicProductsRoutes from '@/controllers/public-products.controller';

async function startServer() {
  try {
    // Validate configuration
    validateConfig();

    const app = express();

    // Widget-specific middleware BEFORE other security middleware
    app.use('/static', (req, res, next) => {
      if (req.path.includes('naay-widget.js')) {
        // Completely override all security headers for widget script
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('Cross-Origin-Resource-Policy');
        res.removeHeader('Cross-Origin-Opener-Policy');

        // Set permissive headers for widget script loading
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', '');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        console.log('Widget script requested - CORS headers set');
      }
      next();
    });

    // Widget API CORS middleware - for widget API endpoints
    app.use('/api/widget', (req, res, next) => {
      // Set CORS headers for all widget API endpoints
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log('Widget API request - CORS headers set for:', req.path);
      next();
    });

    // Chat API CORS middleware - for main chat endpoints
    app.use('/api/chat', (req, res, next) => {
      const origin = req.get('Origin');

      // Allow requests from Shopify domains only
      const allowedOrigins = [
        /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
        /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,
        /^https:\/\/admin\.shopify\.com$/,
      ];

      let allowOrigin = false;
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log(
        'Chat API request - CORS headers set for:',
        req.path,
        'Origin:',
        origin,
        'Allowed:',
        allowOrigin
      );
      next();
    });

    // Simple Chat API CORS middleware - for simple chat endpoints
    app.use('/api/simple-chat', (req, res, next) => {
      const origin = req.get('Origin');

      // Allow requests from Shopify domains only
      const allowedOrigins = [
        /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
        /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,
        /^https:\/\/admin\.shopify\.com$/,
      ];

      let allowOrigin = false;
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log(
        'Simple Chat API request - CORS headers set for:',
        req.path,
        'Origin:',
        origin,
        'Allowed:',
        allowOrigin
      );
      next();
    });

    // Security middleware - allow iframe embedding for Shopify (but not for widget files)
    app.use((req, res, next) => {
      if (!req.path.includes('naay-widget.js')) {
        helmet({
          contentSecurityPolicy: {
            directives: {
              frameAncestors: [
                "'self'",
                'https://*.shopify.com',
                'https://*.shop.app',
                'https://admin.shopify.com',
                'https://*.myshopify.com',
              ],
            },
          },
          frameguard: false, // Disable frameguard to allow iframe
        })(req, res, next);
      } else {
        next();
      }
    });
    // Public APIs CORS middleware - MOVED BEFORE GENERAL CORS
    app.use('/api/public', (req, res, next) => {
      const origin = req.get('Origin');

      // Allow requests from Shopify domains and custom store domains
      const allowedOrigins = [
        /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
        /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,
        /^https:\/\/admin\.shopify\.com$/,
        // Allow custom store domains (most common patterns)
        /^https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/,
      ];

      let allowOrigin = false;
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin || !origin) {
        // Allow the origin or if no origin is present
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) {
          res.setHeader('Vary', 'Origin'); // Important for caching
        }
      }

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log(
        'Public API request - CORS headers set for:',
        req.path,
        'Origin:',
        origin,
        'Allowed:',
        allowOrigin
      );
      next();
    });

    app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? [config.shopify.appUrl, /.*\.shopify\.com$/, /.*\.shop\.app$/]
            : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      })
    );

    // Allow embedding in Shopify iframe
    app.use((req, res, next) => {
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.setHeader(
        'Content-Security-Policy',
        "frame-ancestors 'self' https://*.shopify.com https://*.shop.app https://admin.shopify.com https://*.myshopify.com;"
      );
      next();
    });

    // Rate limiting (exclude widget routes from rate limiting)
    app.use((req, res, next) => {
      // Skip rate limiting for all widget-related routes
      if (
        req.path.startsWith('/widget/') ||
        req.path.startsWith('/static/naay-widget') ||
        req.path.startsWith('/api/widget/') ||
        req.path.startsWith('/api/public/')
      ) {
        return next();
      }
      // Apply rate limiting to all other routes
      rateLimiter(req, res, next);
    });

    // Request logging
    app.use(requestLogger);

    // Security middleware
    app.use(securityHeaders);
    app.use(sanitizeInput);
    app.use(auditLog);

    // Body parsing middleware
    app.use('/api/webhooks', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve static files for widget with anti-cache headers
    app.use(
      '/static',
      (req, res, next) => {
        if (req.path.includes('naay-widget.js')) {
          // Force no caching for widget file
          res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate, max-age=0'
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Last-Modified', new Date().toUTCString());
          res.setHeader('ETag', 'v2.1.0-' + Date.now());
        }
        next();
      },
      express.static(path.join(__dirname, 'public'))
    );

    // Public widget endpoint (direct route with CORS)
    app.get('/widget/naay-widget.js', (req, res) => {
      try {
        // Set complete CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Max-Age', '86400');

        // Anti-cache headers
        res.setHeader(
          'Cache-Control',
          'no-cache, no-store, must-revalidate, max-age=0'
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('ETag', 'v2.1.0-' + Date.now());

        // Set content type
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

        console.log(
          '🔥 Widget script served with CORS headers to:',
          req.get('Origin') || 'no-origin'
        );

        // Send file using express static file sending
        res.sendFile(path.join(__dirname, 'public', 'naay-widget.js'));
      } catch (error) {
        console.error('Error serving widget:', error);
        res.status(500).json({ error: 'Failed to serve widget' });
      }
    });

    // Health check (before auth)
    app.use('/health', healthRoutes);

    // Root route for Shopify app installation
    app.get('/', (req, res) => {
      const { token, shop, hmac, host, timestamp, embedded } = req.query;

      // Debug logging
      logger.info('Root route accessed', {
        query: req.query,
        url: req.url,
        hasToken: !!token,
        hasShop: !!shop,
        hasHmac: !!hmac,
        hasHost: !!host,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      });

      // Check if this is being loaded in Shopify admin iframe
      const isEmbedded =
        host || embedded || req.get('Referer')?.includes('admin.shopify.com');

      if (isEmbedded) {
        // App is being loaded within Shopify admin - show admin interface
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Panel de Control</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
            <style>
              /* Naay Brand Colors - Paleta oficial del widget */
              :root {
                /* Shopify-style colors - Clean & Minimal */
                --primary: #000000;      /* Black for primary actions */
                --secondary: #303030;    /* Dark gray for secondary text */
                --tertiary: #606060;     /* Medium gray for tertiary elements */
                
                /* UI colors */
                --success: #008060;      /* Shopify green */
                --warning: #FFC453;      /* Shopify yellow */
                --danger: #D72C0D;       /* Shopify red */
                --info: #006EFF;         /* Shopify blue */
                
                /* Background and surfaces */
                --white: #FFFFFF;
                --background: #FAFBFB;   /* Very light gray background */
                --surface: #FFFFFF;      /* White surface */
                --border: #E1E3E5;       /* Light border */
                --divider: #F1F2F3;      /* Very light divider */
                
                /* Text colors */
                --text-primary: #202223;   /* Primary text */
                --text-secondary: #6D7175; /* Secondary text */
                --text-disabled: #8C9196;  /* Disabled text */
                
                /* Legacy color mappings for compatibility */
                --black: #000000;
                --light-gray: #F1F2F3;
                --dark-gray: #6D7175;
                
                /* Shopify-style properties */
                --border-radius: 4px;
                --border-radius-large: 8px;
                --box-shadow: 0 1px 0 rgba(22, 29, 37, 0.05);
                --box-shadow-card: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px rgba(63, 63, 68, 0.15);
              }

              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: var(--background);
                color: var(--text-primary);
                line-height: 1.5;
                min-height: 100vh;
              }

              /* Layout principal */
              .naay-admin {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }

              /* Header */
              .naay-admin__header {
                background: var(--white);
                padding: 16px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid var(--border);
                position: sticky;
                top: 0;
                z-index: 100;
                box-shadow: var(--box-shadow);
              }

              .naay-admin__logo {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                font-size: 18px;
                color: var(--text-primary);
              }

              .naay-admin__logo-icon {
                font-size: 20px;
              }

              .naay-admin__store-info {
                background: var(--divider);
                padding: 6px 12px;
                border-radius: var(--border-radius);
                font-size: 12px;
                font-weight: 500;
                color: var(--text-secondary);
                border: 1px solid var(--border);
              }

              /* Main content */
              .naay-admin__main {
                flex: 1;
                padding: 20px;
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
              }

              /* Success banner */
              .naay-banner {
                background: var(--success);
                color: white;
                padding: 12px 16px;
                border-radius: var(--border-radius);
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 20px;
              }

              .naay-banner__icon {
                font-size: 16px;
              }

              /* Stats cards */
              .naay-admin__stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
              }

              .naay-stat-card {
                background: var(--white);
                border: 1px solid var(--border);
                border-radius: var(--border-radius-large);
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 16px;
                transition: box-shadow 0.2s ease;
                box-shadow: var(--box-shadow-card);
              }

              .naay-stat-card:hover {
                box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 4px 16px rgba(63, 63, 68, 0.15);
              }

              .naay-stat-card__icon {
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                background: var(--primary);
                border-radius: var(--border-radius);
                color: var(--white);
                flex-shrink: 0;
              }

              .naay-stat-card__number {
                font-size: 24px;
                font-weight: 600;
                color: var(--text-primary);
                line-height: 1;
              }

              .naay-stat-card__label {
                font-size: 14px;
                font-weight: 400;
                color: var(--text-secondary);
                margin-top: 4px;
              }

              /* Section titles */
              .naay-admin__section-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--secondary);
                margin-bottom: 16px;
              }

              /* Section titles */
              .naay-admin__section-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
              }

              /* Quick actions */
              .naay-admin__actions {
                margin-bottom: 40px;
              }

              .naay-quick-action {
                background: var(--white);
                border: 1px solid var(--border);
                border-radius: var(--border-radius-large);
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: var(--box-shadow-card);
                transition: box-shadow 0.2s ease;
              }

              .naay-quick-action:hover {
                box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 4px 16px rgba(63, 63, 68, 0.15);
              }

              .naay-quick-action h3 {
                font-size: 15px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: 4px;
              }

              .naay-quick-action p {
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.4;
              }

              /* Botones */
              .naay-btn {
                padding: 8px 16px;
                border: 1px solid transparent;
                border-radius: var(--border-radius);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-height: 32px;
              }

              .naay-btn--primary {
                background: var(--primary);
                color: var(--white);
                border-color: var(--primary);
              }

              .naay-btn--primary:hover:not(:disabled) {
                background: var(--secondary);
                border-color: var(--secondary);
              }

              .naay-btn--secondary {
                background: var(--white);
                color: var(--text-primary);
                border-color: var(--border);
              }

              .naay-btn--secondary:hover:not(:disabled) {
                background: var(--divider);
                border-color: var(--text-secondary);
              }

              .naay-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
              }

              /* Loading state */
              .naay-loading {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid var(--border);
                border-radius: 50%;
                border-top-color: var(--primary);
                animation: spin 1s linear infinite;
              }

              @keyframes spin {
                to { transform: rotate(360deg); }
              }

              /* Responsive */
              /* Conversations */
              .naay-conversations-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 20px;
              }

              .naay-conversation-item {
                background: var(--white);
                border: 1px solid var(--border);
                border-radius: var(--border-radius-large);
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: var(--box-shadow-card);
              }

              .naay-conversation-item:hover {
                border-color: var(--text-secondary);
                box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 4px 16px rgba(63, 63, 68, 0.15);
              }

              .naay-conversation-item__content {
                flex: 1;
              }

              .naay-conversation-item__header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
              }

              .naay-conversation-item__id {
                font-size: 11px;
                background: var(--divider);
                color: var(--text-secondary);
                padding: 3px 6px;
                border-radius: var(--border-radius);
                font-family: monospace;
              }

              .naay-conversation-item__date {
                font-size: 12px;
                color: var(--text-secondary);
              }

              .naay-conversation-item__preview {
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 4px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }

              .naay-conversation-item__message-count {
                background: var(--primary);
                color: var(--white);
                font-size: 11px;
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
              }

              /* Loading state for conversations */
              .naay-conversations-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 30px;
                color: var(--text-secondary);
                font-size: 14px;
                gap: 8px;
              }

              /* Empty state */
              .naay-conversations-empty {
                text-align: center;
                padding: 30px;
                color: var(--text-secondary);
                font-size: 14px;
              }

              /* Modal */
              .naay-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
              }

              .naay-modal__overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
              }

              .naay-modal__content {
                background: var(--white);
                border-radius: var(--border-radius);
                max-width: 600px;
                width: 90%;
                max-height: 80%;
                position: relative;
                display: flex;
                flex-direction: column;
              }

              .naay-modal__header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--everyday);
                background: var(--fresh);
                display: flex;
                justify-content: space-between;
                align-items: center;
              }

              .naay-modal__close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: var(--white);
                padding: 4px;
                transition: color 0.2s ease;
              }

              .naay-modal__close:hover {
                color: var(--everyday);
              }

              .naay-modal__body {
                padding: 20px;
                overflow-y: auto;
                max-height: 400px;
              }

              /* Messages */
              .naay-message {
                margin-bottom: 16px;
                padding: 12px;
                border-radius: var(--border-radius);
                border: 1px solid var(--light-gray);
              }

              .naay-message--user {
                background: var(--everyday);
                border-left: 3px solid var(--primary);
              }

              .naay-message--assistant {
                background: var(--white);
                border-left: 3px solid var(--fresh);
              }

              .naay-message__header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
              }

              .naay-message__time {
                font-size: 12px;
                color: var(--secondary);
              }

              .naay-message__content {
                font-size: 14px;
                line-height: 1.4;
                color: var(--secondary);
              }

              /* Pagination */
              .naay-pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                padding: 16px 0;
                margin-top: 20px;
              }

              @media (max-width: 768px) {
                .naay-admin__header {
                  padding: 12px 16px;
                  flex-direction: column;
                  gap: 12px;
                  align-items: flex-start;
                }
                
                .naay-admin__main {
                  padding: 20px 16px;
                }
                
                .naay-admin__stats {
                  grid-template-columns: 1fr;
                }
                
                .naay-quick-action {
                  flex-direction: column;
                  align-items: flex-start;
                  gap: 12px;
                }

                .naay-admin__store-info {
                  align-self: stretch;
                  text-align: center;
                }
              }

              /* Sales Chart */
              .naay-chart-container {
                background: var(--white);
                border: 1px solid var(--border);
                border-radius: var(--border-radius-large);
                padding: 20px;
                margin-bottom: 32px;
                box-shadow: var(--box-shadow-card);
              }

              .naay-chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--border);
              }

              .naay-chart-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 6px;
              }

              .naay-chart-period {
                background: var(--divider);
                color: var(--text-secondary);
                padding: 4px 8px;
                border-radius: var(--border-radius);
                font-size: 12px;
                font-weight: 400;
                border: 1px solid var(--border);
              }

              .naay-chart-canvas {
                width: 100%;
                height: 300px;
                position: relative;
              }

              .naay-chart-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 300px;
                color: var(--text-secondary);
                font-size: 14px;
                flex-direction: column;
                gap: 12px;
              }

              .naay-chart-error {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 300px;
                color: var(--danger);
                font-size: 14px;
                flex-direction: column;
                gap: 12px;
                text-align: center;
              }

              /* Chart bars */
              .naay-chart-bars {
                display: flex;
                align-items: end;
                justify-content: space-between;
                height: 250px;
                padding: 0 16px;
                margin-bottom: 16px;
              }

              .naay-chart-bar {
                flex: 1;
                margin: 0 2px;
                background: var(--primary);
                border-radius: 2px 2px 0 0;
                min-height: 4px;
                transition: all 0.2s ease;
                position: relative;
                cursor: pointer;
              }

              .naay-chart-bar:hover {
                background: var(--secondary);
              }

              .naay-chart-bar-value {
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 10px;
                color: var(--text-primary);
                font-weight: 500;
                background: var(--white);
                padding: 2px 6px;
                border-radius: var(--border-radius);
                border: 1px solid var(--border);
                opacity: 0;
                transition: opacity 0.2s ease;
                white-space: nowrap;
              }

              .naay-chart-bar:hover .naay-chart-bar-value {
                opacity: 1;
              }

              .naay-chart-labels {
                display: flex;
                justify-content: space-between;
                padding: 0 16px;
                font-size: 11px;
                color: var(--text-secondary);
              }

              .naay-chart-summary {
                display: flex;
                justify-content: space-around;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid var(--border);
              }

              .naay-chart-metric {
                text-align: center;
              }

              .naay-chart-metric-value {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                line-height: 1;
              }

              .naay-chart-metric-label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
              }
            </style>
          </head>
          <body>
            <div class="naay-admin">
              <!-- Main Content -->
              <main class="naay-admin__main">
                <!-- Stats Cards -->
                <section class="naay-admin__stats">
                  <div class="naay-stat-card">
                    <div class="naay-stat-card__icon">📦</div>
                    <div class="naay-stat-card__content">
                      <div class="naay-stat-card__number" id="products-count">⏳</div>
                      <div class="naay-stat-card__label">Productos sincronizados</div>
                    </div>
                  </div>
                  
                  <div class="naay-stat-card">
                    <div class="naay-stat-card__icon">💬</div>
                    <div class="naay-stat-card__content">
                      <div class="naay-stat-card__number" id="conversations-count">⏳</div>
                      <div class="naay-stat-card__label">Conversaciones</div>
                    </div>
                  </div>
                  
                  <div class="naay-stat-card">
                    <div class="naay-stat-card__icon">🔄</div>
                    <div class="naay-stat-card__content">
                      <div class="naay-stat-card__number" id="chat-status">Active</div>
                      <div class="naay-stat-card__label">Estado del Chat</div>
                    </div>
                  </div>
                  
                  <div class="naay-stat-card">
                    <div class="naay-stat-card__icon">💰</div>
                    <div class="naay-stat-card__content">
                      <div class="naay-stat-card__number" id="sales-total">⏳</div>
                      <div class="naay-stat-card__label">Ventas del Mes</div>
                    </div>
                  </div>
                </section>


                <!-- Sales Chart Section -->
                <section class="naay-admin__actions">
                  <h2 class="naay-admin__section-title">📈 Análisis de Ventas</h2>
                  
                  <div class="naay-chart-container">
                    <div class="naay-chart-header">
                      <div class="naay-chart-title">
                        <span>💰</span>
                        Ventas de los últimos 30 días
                      </div>
                      <div class="naay-chart-period">Últimos 30 días</div>
                    </div>
                    
                    <div class="naay-chart-canvas">
                      <div id="sales-chart-loading" class="naay-chart-loading">
                        <div class="naay-loading"></div>
                        <span>Cargando datos de ventas...</span>
                      </div>
                      
                      <div id="sales-chart-error" class="naay-chart-error" style="display: none;">
                        <span>⚠️</span>
                        <div>
                          <div>No se pudieron cargar los datos de ventas</div>
                          <small>Verifica la conexión con Shopify</small>
                        </div>
                        <button class="naay-btn naay-btn--secondary" onclick="loadSalesData()">
                          Reintentar
                        </button>
                      </div>
                      
                      <div id="sales-chart-content" style="display: none;">
                        <div class="naay-chart-bars" id="sales-chart-bars">
                          <!-- Chart bars will be generated dynamically -->
                        </div>
                        <div class="naay-chart-labels" id="sales-chart-labels">
                          <!-- Chart labels will be generated dynamically -->
                        </div>
                      </div>
                    </div>
                    
                    <div class="naay-chart-summary" id="sales-chart-summary" style="display: none;">
                      <div class="naay-chart-metric">
                        <div class="naay-chart-metric-value" id="sales-total-amount">$0</div>
                        <div class="naay-chart-metric-label">Total Vendido</div>
                      </div>
                      <div class="naay-chart-metric">
                        <div class="naay-chart-metric-value" id="sales-orders-count">0</div>
                        <div class="naay-chart-metric-label">Órdenes</div>
                      </div>
                      <div class="naay-chart-metric">
                        <div class="naay-chart-metric-value" id="sales-average-order">$0</div>
                        <div class="naay-chart-metric-label">Ticket Promedio</div>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Conversations Section -->
                <section class="naay-admin__actions">
                  <h2 class="naay-admin__section-title">💬 Conversaciones</h2>
                  
                  <div id="conversations-section">
                    <div id="conversations-loading" class="naay-conversations-loading" style="display: none;">
                      <span>Cargando conversaciones...</span>
                    </div>
                    
                    <div id="conversations-list" class="naay-conversations-list">
                      <!-- Conversations will be loaded dynamically -->
                    </div>
                    
                    <div id="conversations-empty" class="naay-conversations-empty" style="display: none;">
                      <span>📭</span>
                      <p>No hay conversaciones disponibles</p>
                      <small>Las conversaciones aparecerán aquí cuando los usuarios interactúen con el chat</small>
                    </div>
                  </div>

                  <!-- Pagination -->
                  <div id="conversations-pagination" class="naay-pagination" style="display: none;">
                    <button id="prev-page-btn" class="naay-btn naay-btn--secondary" onclick="loadPreviousPage()">
                      ← Anterior
                    </button>
                    <span id="page-info">Página 1 de 1</span>
                    <button id="next-page-btn" class="naay-btn naay-btn--secondary" onclick="loadNextPage()">
                      Siguiente →
                    </button>
                  </div>
                </section>

                <!-- Conversation Detail Modal -->
                <div id="conversation-modal" class="naay-modal" style="display: none;">
                  <div class="naay-modal__overlay" onclick="closeConversationModal()"></div>
                  <div class="naay-modal__content">
                    <div class="naay-modal__header">
                      <h3 id="modal-conversation-title">Conversación</h3>
                      <button class="naay-modal__close" onclick="closeConversationModal()">✕</button>
                    </div>
                    <div class="naay-modal__body" id="modal-conversation-messages">
                      <!-- Los mensajes se cargarán aquí -->
                    </div>
                  </div>
                </div>
              </main>
            </div>

            <script>
              let isLoading = false;

              // Inicialización con App Bridge (opcional para este panel)
              // const app = window.ShopifyApp && window.ShopifyApp.createApp({
              //   apiKey: '${process.env.SHOPIFY_API_KEY || 'api_key_placeholder'}',
              //   host: '${host}',
              // });

              // Cargar datos iniciales
              document.addEventListener('DOMContentLoaded', async function() {
                console.log('DOM loaded, starting data loading...');
                
                try {
                  console.log('Loading stats...');
                  await loadStats();
                  console.log('Stats loaded successfully');
                } catch (error) {
                  console.error('Error loading stats:', error);
                }
                
                try {
                  console.log('Loading conversations...');
                  await loadConversations();
                  console.log('Conversations loaded successfully');
                } catch (error) {
                  console.error('Error loading conversations:', error);
                }
                
                try {
                  console.log('Loading sales data...');
                  await loadSalesData();
                  console.log('Sales data loaded successfully');
                } catch (error) {
                  console.error('Error loading sales data:', error);
                }
                
                console.log('All data loading attempts completed');
              });

              async function loadStats() {
                try {
                  const response = await fetch('/api/admin-bypass/stats');
                  if (response.ok) {
                    const data = await response.json();
                    
                    document.getElementById('products-count').textContent = data.data?.products || '0';
                    document.getElementById('conversations-count').textContent = data.data?.conversations || '0';
                    document.getElementById('sales-total').textContent = data.data?.salesTotal || '$0';
                  } else {
                    throw new Error('Failed to load stats');
                  }
                } catch (error) {
                  console.error('Error loading stats:', error);
                  document.getElementById('products-count').textContent = '0';
                  document.getElementById('conversations-count').textContent = '0';
                  document.getElementById('sales-total').textContent = '$0';
                }
              }


              // Conversations functionality
              let currentPage = 1;
              const conversationsPerPage = 10;

              async function loadConversations(page = 1) {
                console.log('Loading conversations for page:', page);
                const loadingEl = document.getElementById('conversations-loading');
                const listEl = document.getElementById('conversations-list');
                const emptyEl = document.getElementById('conversations-empty');
                const paginationEl = document.getElementById('conversations-pagination');

                if (!loadingEl || !listEl || !emptyEl || !paginationEl) {
                  console.error('Missing conversation elements:', { loadingEl, listEl, emptyEl, paginationEl });
                  return;
                }

                try {
                  loadingEl.style.display = 'block';
                  listEl.style.display = 'none';
                  emptyEl.style.display = 'none';
                  paginationEl.style.display = 'none';

                  const url = \`/api/admin-bypass/conversations?page=\${page}&limit=\${conversationsPerPage}\`;
                  console.log('Fetching conversations from:', url);
                  const response = await fetch(url);
                  
                  if (!response.ok) {
                    console.error('Response not ok:', response.status, response.statusText);
                    throw new Error('Failed to load conversations');
                  }

                  const data = await response.json();
                  console.log('Conversations data received:', data);
                  const conversations = data.data || [];

                  loadingEl.style.display = 'none';

                  if (conversations.length === 0) {
                    console.log('No conversations found, showing empty state');
                    emptyEl.style.display = 'block';
                    return;
                  }

                  console.log('Rendering', conversations.length, 'conversations');
                  // Render conversations
                  listEl.innerHTML = conversations.map(conv => \`
                    <div class="naay-conversation-item" onclick="openConversation('\${conv.session_id}')">
                      <div class="naay-conversation-item__header">
                        <div class="naay-conversation-item__id">Sesión: \${conv.session_id.substring(0, 8)}...</div>
                        <div class="naay-conversation-item__date">\${formatDate(conv.last_activity)}</div>
                      </div>
                      <div class="naay-conversation-item__preview">
                        \${conv.last_message || 'Sin mensajes recientes'}
                      </div>
                      <div class="naay-conversation-item__message-count">
                        \${conv.message_count} mensaje\${conv.message_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  \`).join('');

                  console.log('Conversations HTML created, showing list');
                  listEl.style.display = 'block';

                  // Update pagination
                  currentPage = page;
                  updatePagination(data.pagination);

                } catch (error) {
                  console.error('Error loading conversations:', error);
                  loadingEl.style.display = 'none';
                  emptyEl.style.display = 'block';
                  emptyEl.innerHTML = '<span>⚠️</span><p>Error al cargar conversaciones</p>';
                }
              }

              function updatePagination(pagination) {
                const paginationEl = document.getElementById('conversations-pagination');
                const pageInfoEl = document.getElementById('page-info');
                const prevBtn = document.getElementById('prev-page-btn');
                const nextBtn = document.getElementById('next-page-btn');

                if (pagination && pagination.totalPages > 1) {
                  paginationEl.style.display = 'flex';
                  pageInfoEl.textContent = \`Página \${pagination.currentPage} de \${pagination.totalPages}\`;
                  prevBtn.disabled = pagination.currentPage <= 1;
                  nextBtn.disabled = pagination.currentPage >= pagination.totalPages;
                } else {
                  paginationEl.style.display = 'none';
                }
              }

              function loadPreviousPage() {
                if (currentPage > 1) {
                  loadConversations(currentPage - 1);
                }
              }

              function loadNextPage() {
                loadConversations(currentPage + 1);
              }

              async function openConversation(sessionId) {
                const modal = document.getElementById('conversation-modal');
                const title = document.getElementById('modal-conversation-title');
                const messagesContainer = document.getElementById('modal-conversation-messages');

                try {
                  title.textContent = \`Sesión: \${sessionId.substring(0, 8)}...\`;
                  messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Cargando mensajes...</div>';
                  
                  modal.style.display = 'flex';

                  const response = await fetch(\`/api/admin-bypass/conversations/\${sessionId}\`);
                  
                  if (!response.ok) {
                    throw new Error('Failed to load conversation details');
                  }

                  const data = await response.json();
                  const messages = data.data || [];

                  if (messages.length === 0) {
                    messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px;">No hay mensajes en esta conversación</div>';
                    return;
                  }

                  messagesContainer.innerHTML = messages.map(msg => \`
                    <div class="naay-message naay-message--\${msg.role === 'client' ? 'user' : 'assistant'}">
                      <div class="naay-message__header">
                        <strong>\${msg.role === 'client' ? '👤 Cliente' : '🤖 Asistente'}</strong>
                        <span class="naay-message__time">\${formatTime(msg.timestamp)}</span>
                      </div>
                      <div class="naay-message__content">\${escapeHtml(msg.content)}</div>
                    </div>
                  \`).join('');

                } catch (error) {
                  console.error('Error loading conversation:', error);
                  messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Error al cargar la conversación</div>';
                }
              }

              function closeConversationModal() {
                document.getElementById('conversation-modal').style.display = 'none';
              }

              // Utility functions
              function formatDate(dateString) {
                const date = new Date(dateString);
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                  return 'Hoy ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                } else if (diffDays === 1) {
                  return 'Ayer';
                } else if (diffDays < 7) {
                  return \`Hace \${diffDays} días\`;
                } else {
                  return date.toLocaleDateString('es-ES');
                }
              }

              function formatTime(dateString) {
                return new Date(dateString).toLocaleString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              }

              function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
              }

              // Sales Data Functions
              async function loadSalesData() {
                console.log('Starting loadSalesData...');
                
                const loadingEl = document.getElementById('sales-chart-loading');
                const errorEl = document.getElementById('sales-chart-error');
                const contentEl = document.getElementById('sales-chart-content');
                const summaryEl = document.getElementById('sales-chart-summary');

                if (!loadingEl || !errorEl || !contentEl || !summaryEl) {
                  console.error('Missing sales chart elements:', { loadingEl, errorEl, contentEl, summaryEl });
                  return;
                }

                console.log('All sales chart elements found, showing loading state...');

                // Show loading state
                loadingEl.style.display = 'flex';
                errorEl.style.display = 'none';
                contentEl.style.display = 'none';
                summaryEl.style.display = 'none';

                try {
                  console.log('Fetching sales data from /api/admin-bypass/sales/chart...');
                  const response = await fetch('/api/admin-bypass/sales/chart');
                  
                  console.log('Sales response status:', response.status);
                  
                  if (!response.ok) {
                    throw new Error(\`Failed to fetch sales data: \${response.status} \${response.statusText}\`);
                  }

                  const data = await response.json();
                  console.log('Sales data received:', data);
                  
                  if (data.success && data.data) {
                    console.log('Rendering sales chart...');
                    renderSalesChart(data.data);
                    loadingEl.style.display = 'none';
                    contentEl.style.display = 'block';
                    summaryEl.style.display = 'flex';
                    console.log('Sales chart rendered successfully');
                  } else {
                    throw new Error(data.message || 'Invalid sales data');
                  }
                } catch (error) {
                  console.error('Error loading sales data:', error);
                  loadingEl.style.display = 'none';
                  errorEl.style.display = 'flex';
                }
              }

              function renderSalesChart(salesData) {
                console.log('Starting renderSalesChart with data:', salesData);
                
                const barsContainer = document.getElementById('sales-chart-bars');
                const labelsContainer = document.getElementById('sales-chart-labels');

                if (!barsContainer || !labelsContainer) {
                  console.error('Missing chart containers:', { barsContainer, labelsContainer });
                  return;
                }

                // Clear existing content
                barsContainer.innerHTML = '';
                labelsContainer.innerHTML = '';

                const { daily_sales, total_amount, total_orders, average_order } = salesData;
                
                console.log('Extracted data:', { daily_sales, total_amount, total_orders, average_order });
                
                if (!daily_sales || daily_sales.length === 0) {
                  console.log('No daily sales data, showing empty message');
                  barsContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">No hay datos de ventas disponibles</div>';
                  return;
                }

                console.log('Processing', daily_sales.length, 'days of sales data');

                // Find max value for scaling
                const maxSale = Math.max(...daily_sales.map(day => parseFloat(day.total_sales)));
                
                // Create bars
                daily_sales.forEach(day => {
                  const barHeight = maxSale > 0 ? (parseFloat(day.total_sales) / maxSale) * 240 : 0;
                  const formattedAmount = new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                  }).format(parseFloat(day.total_sales));

                  const bar = document.createElement('div');
                  bar.className = 'naay-chart-bar';
                  bar.style.height = barHeight + 'px';
                  bar.innerHTML = \`<div class="naay-chart-bar-value">\${formattedAmount}</div>\`;
                  
                  barsContainer.appendChild(bar);
                });

                // Create labels (showing every 5 days to avoid overcrowding)
                daily_sales.forEach((day, index) => {
                  const label = document.createElement('div');
                  const date = new Date(day.date);
                  
                  if (index % 5 === 0 || index === daily_sales.length - 1) {
                    label.textContent = date.getDate() + '/' + (date.getMonth() + 1);
                  } else {
                    label.textContent = '';
                  }
                  
                  labelsContainer.appendChild(label);
                });

                // Update summary metrics
                const formatCurrency = (amount) => new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN'
                }).format(amount);

                document.getElementById('sales-total-amount').textContent = formatCurrency(total_amount);
                document.getElementById('sales-orders-count').textContent = total_orders;
                document.getElementById('sales-average-order').textContent = formatCurrency(average_order);
              }
            </script>
          </body>
          </html>
        `);
        // Process the app installation in background
        setTimeout(async () => {
          try {
            logger.info('Processing Shopify app installation', {
              shop,
              host,
              hmac: !!hmac,
            });

            // Check if store exists in our database
            const supabaseService =
              new (require('@/services/supabase.service').SupabaseService)();
            const queueService =
              new (require('@/services/queue.service').QueueService)();

            let store = await supabaseService.getStore(shop as string);

            if (!store) {
              // For App Bridge apps, we need to use a placeholder token initially
              // The real token exchange happens later via API calls from the frontend
              store = await supabaseService.createStore({
                shop_domain: shop as string,
                access_token: 'pending_token_exchange', // Placeholder
                scopes: config.shopify.scopes,
                installed_at: new Date(),
                updated_at: new Date(),
              });

              logger.info(
                `Created store entry for App Bridge installation: ${shop}`
              );
            } else {
              await supabaseService.updateStoreToken(
                shop as string,
                store.access_token
              );
              logger.info(`Updated existing store for App Bridge: ${shop}`);
            }

            // Don't trigger sync yet - wait for proper token exchange
            logger.info(`App Bridge installation processed for: ${shop}`);
          } catch (error) {
            logger.error('Failed to process app installation:', error);
          }
        }, 1000);

        // Show the welcome page immediately
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
              .back-link { display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 8px; text-decoration: none; color: white; margin-top: 20px; }
              .back-link:hover { background: rgba(255,255,255,0.3); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Bienvenido a Naay Agent!</h1>
              <p>Tu AI Shopping Assistant está funcionando correctamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Funcionalidades Activas:</h3>
                <div class="step">✅ API de chat inteligente activa</div>
                <div class="step">💬 Búsqueda semántica de productos</div>
                <div class="step">🛒 Gestión automática del carrito</div>
                <div class="step">🎨 Widget listo para integrar en tu tema</div>
              </div>
              
              <div class="next-steps">
                <h3>📝 Próximos Pasos:</h3>
                <div class="step" id="step1">⏳ Procesando instalación...</div>
                <div class="step">2. Configura las variables de entorno (Supabase, OpenAI)</div>
                <div class="step">3. Agrega el widget de chat a tu tema</div>
                <div class="step">4. Sincroniza tus productos</div>
                <div class="step">5. Prueba el chat en tu tienda</div>
              </div>
              
              <script>
                // Auto-verify the app installation
                setTimeout(async () => {
                  try {
                    const response = await fetch('/auth/verify', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        shop: '${shop}',
                        hmac: '${hmac}',
                        host: '${host}',
                        timestamp: '${timestamp}'
                      })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                      document.getElementById('step1').innerHTML = '✅ 1. App instalada correctamente';
                      document.getElementById('step1').style.color = '#a8ff78';
                    } else {
                      document.getElementById('step1').innerHTML = '❌ 1. Error en instalación - revisar logs';
                      document.getElementById('step1').style.color = '#ff6b6b';
                    }
                  } catch (error) {
                    console.error('Installation verification failed:', error);
                    document.getElementById('step1').innerHTML = '❌ 1. Error en instalación - revisar conexión';
                    document.getElementById('step1').style.color = '#ff6b6b';
                  }
                }, 2000);
              </script>
              
              <a href="https://${shop}/admin/apps" class="back-link">
                ← Volver a Apps de Shopify
              </a>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Conectado: ${new Date().toLocaleString('es-ES')}</p>
                <p>Host: ${host || 'N/A'}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else if (token && shop) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Instalación Completada!</h1>
              <p>Naay Agent ha sido instalado exitosamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Próximos Pasos:</h3>
                <div class="step">✅ Sincronización automática de productos iniciada</div>
                <div class="step">💬 El chat AI está listo para usar</div>
                <div class="step">🎨 Agrega el widget a tu tema de Shopify</div>
                <div class="step">⚙️ Configura las variables de entorno si es necesario</div>
              </div>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Instalado: ${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Regular API response for direct access
        res.json({
          success: true,
          message: '🎉 Naay Agent - Shopify AI Assistant',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          shopify_app_url: config.shopify.appUrl,
          endpoints: {
            auth: '/auth',
            health: '/health',
            chat: '/api/chat',
            webhooks: '/api/webhooks',
            products: '/api/products',
          },
        });
      }
    });

    // Success page after Shopify app installation
    app.get('/success', (req, res) => {
      const { token, shop } = req.query;

      logger.info('Success page accessed', {
        query: req.query,
        hasToken: !!token,
        hasShop: !!shop,
      });

      if (token && shop) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Naay Agent - Installation Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; padding: 40px; color: white; text-align: center;
              }
              .container { 
                max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1);
                padding: 40px; border-radius: 20px; backdrop-filter: blur(10px);
              }
              .success-icon { font-size: 72px; margin-bottom: 20px; }
              h1 { margin: 0 0 10px; font-size: 32px; }
              .shop-name { font-weight: bold; color: #a8ff78; }
              .next-steps { background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-radius: 10px; text-align: left; }
              .step { margin: 10px 0; padding: 8px 0; }
              .footer { margin-top: 30px; font-size: 14px; opacity: 0.8; }
              .back-link { display: inline-block; background: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 8px; text-decoration: none; color: white; margin-top: 20px; }
              .back-link:hover { background: rgba(255,255,255,0.3); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>¡Instalación Completada!</h1>
              <p>Naay Agent ha sido instalado exitosamente en <span class="shop-name">${shop}</span></p>
              
              <div class="next-steps">
                <h3>🚀 Próximos Pasos:</h3>
                <div class="step">✅ Sincronización automática de productos iniciada</div>
                <div class="step">💬 El chat AI está listo para usar</div>
                <div class="step">🎨 Agrega el widget a tu tema de Shopify</div>
                <div class="step">⚙️ Configura las variables de entorno si es necesario</div>
              </div>
              
              <a href="https://${shop}/admin/apps" class="back-link">
                ← Volver a Apps de Shopify
              </a>
              
              <div class="footer">
                <p>Naay Agent v1.0.0 - AI Shopping Assistant</p>
                <p>Instalado: ${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.redirect('/');
      }
    });

    // Traditional OAuth install route
    app.get('/install', (req, res) => {
      const { shop } = req.query;

      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required',
        });
      }

      // Redirect to OAuth flow
      const scopes = 'read_products,write_products,read_orders,read_customers';
      const redirectUri = `${config.shopify.appUrl}/auth/callback`;
      const installUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${config.shopify.apiKey}` +
        `&scope=${scopes}` +
        `&redirect_uri=${redirectUri}` +
        `&state=${Date.now()}`;

      res.redirect(installUrl);
    });

    // API Routes
    app.use('/auth', authRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/webhooks-admin', webhookAdminRoutes);
    app.use('/api/chat', chatRoutes);

    // CORS configuration specifically for simple-chat endpoint
    app.use(
      '/api/simple-chat',
      cors({
        origin: true, // Allow all origins for widget integration
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: false,
      })
    );
    app.use('/api/simple-chat', simpleChatRoutes);

    // Public APIs (no authentication required)
    app.use('/api/public/cart', publicCartRoutes);
    app.use('/api/public/products', publicProductsRoutes);

    app.use('/api/widget', widgetRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/admin-bypass', adminBypassRoutes);

    // Serve admin panel
    app.get('/admin', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/admin.html'));
    });

    // Serve admin static files
    app.use(
      '/admin-static',
      express.static(path.join(__dirname, '../../frontend-admin/public'))
    );

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
      });
    });

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      logger.info(`🚀 Naay Agent Backend running on port ${port}`);
      logger.info(`📱 Environment: ${config.server.nodeEnv}`);
      logger.info(`🔐 Shopify App URL: ${config.shopify.appUrl}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();
