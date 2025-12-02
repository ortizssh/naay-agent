import express from 'express';
// import cors from 'cors'; // Removed - using custom CorsMiddleware
import path from 'path';
import fs from 'fs';
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
import { CorsMiddleware } from '@/middleware/cors.middleware';

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
import adminBypassRoutes from '@/controllers/admin-bypass-refactored.controller';
import simpleChatRoutes from '@/controllers/simple-chat.controller';
import publicCartRoutes from '@/controllers/public-cart.controller';
import publicProductsRoutes from '@/controllers/public-products.controller';

async function startServer() {
  try {
    // Validate configuration
    validateConfig();

    const app = express();

    // Widget-specific middleware BEFORE other security middleware
    app.use('/static', CorsMiddleware.widgetScript());

    // Widget API CORS middleware
    app.use('/api/widget', CorsMiddleware.widgetApi());

    // Chat API CORS middleware
    app.use('/api/chat', CorsMiddleware.chatApi());
    app.use('/api/simple-chat', CorsMiddleware.chatApi());

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
    // Public APIs CORS middleware
    app.use('/api/public', CorsMiddleware.publicApi());

    // General CORS middleware
    app.use(CorsMiddleware.general());

    // Frame options for Shopify embedding
    app.use(CorsMiddleware.frameOptions());

    // Rate limiting (exclude widget routes from rate limiting)
    app.use((req, res, next) => {
      // Skip rate limiting for widget routes, admin panel, and health checks
      if (
        req.path.startsWith('/widget/') ||
        req.path.startsWith('/static/naay-widget') ||
        req.path.startsWith('/api/widget/') ||
        req.path.startsWith('/api/public/') ||
        req.path === '/' ||
        req.path.startsWith('/static/admin/') ||
        req.path.startsWith('/health')
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

    // Debug endpoint to check file paths in production
    app.get('/debug/files', (req: express.Request, res: express.Response) => {
      const paths = [
        path.join(__dirname, '../public/admin/index.html'),
        path.join(__dirname, 'public/admin/index.html'),
        path.join(__dirname, '../../backend/public/admin/index.html'),
        path.join(process.cwd(), 'public/admin/index.html'),
        path.join(process.cwd(), 'backend/public/admin/index.html'),
      ];

      const result = {
        __dirname: __dirname,
        'process.cwd()': process.cwd(),
        paths: paths.map(p => ({
          path: p,
          exists: fs.existsSync(p),
        })),
      };

      res.json(result);
    });

    // Root route for Shopify app installation
    app.get('/', (req: express.Request, res: express.Response) => {
      // Admin panel is available via static route, redirect there
      logger.info('Redirecting root to admin panel via static route');
      res.redirect('/static/admin/index.html');
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
      res.sendFile(path.join(__dirname, '../public/admin/index.html'));
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
