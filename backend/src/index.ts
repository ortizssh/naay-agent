import express from 'express';
import cors from 'cors';
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
import simpleConversionAnalyticsRoutes from '@/controllers/simple-conversion-analytics.controller';
import historicalConversionMigratorRoutes from '@/controllers/historical-conversion-migrator.controller';
import realConversionAnalyzerRoutes from '@/controllers/real-conversion-analyzer.controller';
import tenantAdminRoutes from '@/controllers/tenant-admin.controller';
import adminAuthRoutes from '@/controllers/admin-auth.controller';
import clientRoutes from '@/controllers/client.controller';
import shopifyEmbeddedRoutes from '@/controllers/shopify-embedded.controller';
import { getConversionSyncScheduler } from '@/services/conversion-sync-scheduler.service';

// WooCommerce platform imports
import { wooAuthController, wooWebhookController } from '@/platforms/woocommerce/controllers';

async function startServer() {
  try {
    console.log('🔄 Starting Naay Agent Backend...');
    console.log('📍 Current working directory:', process.cwd());
    console.log('📍 __dirname:', __dirname);
    console.log('🌐 NODE_ENV:', process.env.NODE_ENV);

    // Validate configuration
    console.log('🔍 Validating configuration...');
    validateConfig();
    console.log('✅ Configuration validated');

    const app = express();

    // Widget-specific middleware BEFORE other security middleware
    app.use('/static', (req, res, next) => {
      if (req.path.includes('kova-widget.js')) {
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
      if (!req.path.includes('kova-widget.js')) {
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
    // Shopify Embedded API CORS middleware
    app.use('/api/shopify/embedded', (req, res, next) => {
      // Allow all origins for embedded Shopify context
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    // Client API CORS middleware
    app.use('/api/client', (req, res, next) => {
      const origin = req.get('Origin');

      const allowedOrigins = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https:\/\/naay-agent.*\.azurewebsites\.net$/,
        /^https:\/\/kova-agent.*\.azurewebsites\.net$/,
      ];

      let allowOrigin = !origin;
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) {
          res.setHeader('Vary', 'Origin');
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

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    });

    // Admin API CORS middleware
    app.use('/api/admin', (req, res, next) => {
      // Allow requests from local development and same origin
      const origin = req.get('Origin');

      // Allow same-origin requests, local development, and Azure deployment
      const allowedOrigins = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https:\/\/naay-agent.*\.azurewebsites\.net$/,
        /^https:\/\/kova-agent.*\.azurewebsites\.net$/,
      ];

      let allowOrigin = !origin; // Allow same-origin (no Origin header)
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) {
          res.setHeader('Vary', 'Origin');
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
        'Admin API request - CORS headers set for:',
        req.path,
        'Origin:',
        origin
      );
      next();
    });

    // WooCommerce API CORS middleware
    app.use('/api/woo', (req, res, next) => {
      const origin = req.get('Origin');

      // Allow requests from WooCommerce stores and local development
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      if (origin) {
        res.setHeader('Vary', 'Origin');
      }

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, X-WC-Webhook-Source, X-WC-Webhook-Signature'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log(
        'WooCommerce API request - CORS headers set for:',
        req.path,
        'Origin:',
        origin
      );
      next();
    });

    // Public APIs CORS middleware - MOVED BEFORE GENERAL CORS
    app.use('/api/public', (req, res, next) => {
      const origin = req.get('Origin');

      // Allow requests from Shopify domains and custom store domains
      const allowedOrigins = [
        /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
        /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,
        /^https:\/\/admin\.shopify\.com$/,
        // Custom store domains pattern
        /^https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/,
      ];

      let allowOrigin = false;
      if (origin) {
        allowOrigin = allowedOrigins.some(pattern => pattern.test(origin));
      }

      if (allowOrigin || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) {
          res.setHeader('Vary', 'Origin');
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
            ? [
                config.shopify.appUrl,
                /.*\.shopify\.com$/,
                /.*\.shop\.app$/,
                /.*\.myshopify\.com$/,
              ]
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
      // Skip rate limiting for widget routes, admin panel, and health checks
      if (
        req.path.startsWith('/widget/') ||
        req.path.startsWith('/static/kova-widget') ||
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
    // WooCommerce webhooks need raw body for signature verification
    app.use('/api/woo/webhooks', (req, res, next) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        (req as any).rawBody = data;
        // Parse JSON body
        try {
          req.body = JSON.parse(data);
        } catch {
          req.body = {};
        }
        next();
      });
    });
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve static files for widget with anti-cache headers
    app.use(
      '/static',
      (req, res, next) => {
        if (req.path.includes('kova-widget.js')) {
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
      express.static(path.join(__dirname, '../public'))
    );

    // Backwards compatibility: redirect old naay-widget.js to kova-widget.js
    app.get('/widget/naay-widget.js', (req, res) => {
      console.log('🔄 Redirecting naay-widget.js to kova-widget.js');
      res.redirect(301, '/widget/kova-widget.js');
    });

    // Public widget endpoint (direct route with CORS)
    app.get('/widget/kova-widget.js', (req, res) => {
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

        // Try multiple paths until we find the file
        const possiblePaths = [
          path.join(__dirname, '../public', 'kova-widget.js'),
          path.join(__dirname, 'public', 'kova-widget.js'),
          path.join(process.cwd(), 'public', 'kova-widget.js'),
          path.join(process.cwd(), 'dist', 'public', 'kova-widget.js'),
        ];

        let foundPath = null;
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            foundPath = testPath;
            console.log('✅ Widget found at:', testPath);
            break;
          } else {
            console.log('❌ Widget not found at:', testPath);
          }
        }

        if (foundPath) {
          res.sendFile(foundPath);
        } else {
          console.error('❌ Widget file not found in any location');
          res.status(404).json({
            error: 'Widget file not found',
            tested_paths: possiblePaths,
          });
        }
      } catch (error) {
        console.error('Error serving widget:', error);
        res.status(500).json({ error: 'Failed to serve widget' });
      }
    });

    // Health check (before auth)
    app.use('/health', healthRoutes);

    // Widget test page for development
    app.get('/test-widget', (req: express.Request, res: express.Response) => {
      const testWidgetPath = path.join(__dirname, '../public/test-widget.html');
      logger.info('Serving widget test page from:', testWidgetPath);
      res.sendFile(testWidgetPath);
    });

    // Debug endpoint to check file paths in production
    app.get('/debug/files', (req: express.Request, res: express.Response) => {
      const paths = [
        path.join(__dirname, '../public/app/index.html'),
        path.join(__dirname, 'public/app/index.html'),
        path.join(process.cwd(), 'public/app/index.html'),
        path.join(process.cwd(), 'dist/public/app/index.html'),
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

    // Frontend app directory finder
    const getAppDir = () => {
      const possibleDirs = [
        path.join(__dirname, '../public/app'),
        path.join(__dirname, 'public/app'),
        path.join(process.cwd(), 'public/app'),
        path.join(process.cwd(), 'dist/public/app'),
      ];

      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          return dir;
        }
      }
      return null;
    };

    // Serve frontend static assets (js, css, etc.)
    app.use('/assets', (req, res, next) => {
      const appDir = getAppDir();
      if (appDir) {
        express.static(path.join(appDir, 'assets'))(req, res, next);
      } else {
        next();
      }
    });

    // Helper to serve the React SPA
    const serveReactApp = (res: express.Response) => {
      const appDir = getAppDir();
      if (appDir) {
        const indexPath = path.join(appDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          console.log('✅ React app served from:', indexPath);
          return res.sendFile(indexPath);
        }
      }
      // Fallback to old static pages if React app not built
      const fallbackPath = path.join(__dirname, '../public/index.html');
      if (fs.existsSync(fallbackPath)) {
        return res.sendFile(fallbackPath);
      }
      res.status(404).json({
        error: 'App not found. Run: cd frontend-admin && npm run build',
      });
    };

    // Serve React app at root
    app.get('/', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
    });

    // Serve React app for login (SPA handles routing)
    app.get('/login', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
    });

    // Serve React app for register (SPA handles routing)
    app.get('/register', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
    });

    // Serve React app for client routes (SPA handles routing)
    app.get('/client*', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
    });

    // Serve React app for onboarding routes (SPA handles routing)
    app.get('/onboarding*', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
    });

    // Serve React app for dashboard routes (SPA handles routing)
    app.get('/dashboard*', (req: express.Request, res: express.Response) => {
      serveReactApp(res);
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
    app.use('/api/admin/tenants', tenantAdminRoutes);
    app.use('/api/auth', adminAuthRoutes);
    app.use('/api/client', clientRoutes);
    app.use('/api/shopify/embedded', shopifyEmbeddedRoutes);
    app.use('/api/admin-bypass', adminBypassRoutes);

    // Conversion Analytics Routes
    app.use('/api/simple-conversions', simpleConversionAnalyticsRoutes);
    app.use('/api/migration', historicalConversionMigratorRoutes);
    app.use('/api/real-conversions', realConversionAnalyzerRoutes);

    // WooCommerce Platform Routes
    app.use('/api/woo', wooAuthController);
    app.use('/api/woo/webhooks', wooWebhookController);

    // Legacy admin route - redirect to root
    app.get('/admin*', (req, res) => {
      res.redirect('/');
    });

    // SPA fallback - serve React app for any non-API routes
    app.use('*', (req, res) => {
      // Don't serve SPA for API routes
      if (
        req.originalUrl.startsWith('/api/') ||
        req.originalUrl.startsWith('/auth/')
      ) {
        return res.status(404).json({
          success: false,
          error: 'Route not found',
        });
      }
      // Serve React app for all other routes (SPA routing)
      const appDir = getAppDir();
      if (appDir) {
        const indexPath = path.join(appDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
      }
      res.status(404).json({
        success: false,
        error: 'App not found',
      });
    });

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    const port = config.server.port;
    console.log('🚀 Starting HTTP server on port:', port);

    const server = app.listen(port, () => {
      console.log('✅ Server started successfully');
      logger.info(`🚀 Naay Agent Backend running on port ${port}`);
      logger.info(`📱 Environment: ${config.server.nodeEnv}`);
      logger.info(`🔐 Shopify App URL: ${config.shopify.appUrl}`);

      // Additional Azure debug info
      if (process.env.NODE_ENV === 'production') {
        console.log('🔍 Azure Production Debug:');
        console.log('- PORT:', process.env.PORT);
        console.log('- WEBSITES_PORT:', process.env.WEBSITES_PORT);
        console.log('- Has Shopify API Key:', !!process.env.SHOPIFY_API_KEY);
        console.log('- Has Supabase URL:', !!process.env.SUPABASE_URL);
        console.log('- Has OpenAI Key:', !!process.env.OPENAI_API_KEY);
      }

      // Start conversion sync scheduler (runs every 5 hours)
      const conversionScheduler = getConversionSyncScheduler();
      conversionScheduler.start();
      logger.info('📊 Conversion sync scheduler started (every 5 hours)');
    });

    server.on('error', error => {
      console.error('❌ Server error:', error);
      logger.error('Server error:', error);
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
