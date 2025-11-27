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
    app.get('/', (req: express.Request, res: express.Response) => {
      const adminPath = path.join(__dirname, '../public/admin/index.html');
      res.sendFile(adminPath);
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
      const redirectUri = `${config.shopify.appUrl} /auth/callback`;
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
