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

    // Public APIs CORS middleware - for cart and products endpoints
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
      // Skip rate limiting for widget script and static files
      if (req.path.startsWith('/widget/') || req.path.startsWith('/static/naay-widget')) {
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
              /* Sistema de colores del widget */
              :root {
                --naay-everyday: #cec8ae;    /* Primary - Warm cream */
                --naay-fresh: #90a284;       /* Secondary - Sage green */
                --naay-delicate: #c3ab79;    /* Tertiary - Soft gold */
                --naay-forever: #ca957e;     /* Accent - Warm terracotta */
                
                --naay-white: #f8f9f8;
                --naay-black: #2d3748;
                --naay-gray: #718096;
                --naay-light-gray: #e2e8f0;
                
                --naay-radius: 12px;
                --naay-radius-lg: 16px;
                --naay-shadow: 0 4px 12px rgba(139, 93, 75, 0.1);
                --naay-shadow-lg: 0 8px 24px rgba(139, 93, 75, 0.15);
                --naay-transition: cubic-bezier(0.4, 0, 0.2, 1);
              }

              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: var(--naay-white);
                color: var(--naay-black);
                line-height: 1.5;
              }

              /* Layout principal */
              .naay-admin {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }

              /* Header */
              .naay-admin__header {
                background: var(--naay-everyday);
                padding: 16px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: var(--naay-shadow);
              }

              .naay-admin__logo {
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 600;
                font-size: 18px;
                color: var(--naay-black);
              }

              .naay-admin__logo-icon {
                font-size: 24px;
              }

              .naay-admin__store-info {
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: var(--naay-radius);
                font-size: 14px;
                font-weight: 500;
              }

              /* Main content */
              .naay-admin__main {
                flex: 1;
                padding: 32px 24px;
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
              }

              /* Success banner */
              .naay-banner {
                background: var(--naay-fresh);
                color: white;
                padding: 16px 20px;
                border-radius: var(--naay-radius-lg);
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 24px;
                box-shadow: var(--naay-shadow);
              }

              .naay-banner__icon {
                font-size: 20px;
              }

              /* Stats cards */
              .naay-admin__stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
              }

              .naay-stat-card {
                background: var(--naay-white);
                border: 1px solid var(--naay-light-gray);
                border-radius: var(--naay-radius-lg);
                padding: 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                box-shadow: var(--naay-shadow);
                transition: all 0.2s var(--naay-transition);
              }

              .naay-stat-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--naay-shadow-lg);
              }

              .naay-stat-card__icon {
                font-size: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 56px;
                height: 56px;
                background: var(--naay-fresh);
                border-radius: var(--naay-radius);
                color: white;
              }

              .naay-stat-card__number {
                font-size: 28px;
                font-weight: 700;
                color: var(--naay-black);
                line-height: 1;
              }

              .naay-stat-card__label {
                font-size: 14px;
                color: var(--naay-gray);
                margin-top: 4px;
              }

              /* Section titles */
              .naay-admin__section-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--naay-black);
                margin-bottom: 20px;
              }

              /* Quick actions */
              .naay-admin__actions {
                margin-bottom: 40px;
              }

              .naay-quick-action {
                background: var(--naay-white);
                border: 1px solid var(--naay-light-gray);
                border-radius: var(--naay-radius-lg);
                padding: 20px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: var(--naay-shadow);
              }

              .naay-quick-action h3 {
                font-size: 16px;
                font-weight: 600;
                color: var(--naay-black);
                margin-bottom: 4px;
              }

              .naay-quick-action p {
                font-size: 14px;
                color: var(--naay-gray);
              }

              /* Botones */
              .naay-btn {
                padding: 10px 20px;
                border: none;
                border-radius: var(--naay-radius);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s var(--naay-transition);
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
              }

              .naay-btn--primary {
                background: var(--naay-delicate);
                color: white;
              }

              .naay-btn--primary:hover:not(:disabled) {
                background: var(--naay-forever);
                transform: translateY(-1px);
              }

              .naay-btn--secondary {
                background: transparent;
                color: var(--naay-forever);
                border: 1px solid var(--naay-forever);
              }

              .naay-btn--secondary:hover:not(:disabled) {
                background: var(--naay-forever);
                color: white;
              }

              .naay-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
              }

              /* Loading state */
              .naay-loading {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid var(--naay-light-gray);
                border-radius: 50%;
                border-top-color: var(--naay-fresh);
                animation: spin 1s ease-in-out infinite;
              }

              @keyframes spin {
                to { transform: rotate(360deg); }
              }

              /* Responsive */
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
            </style>
          </head>
          <body>
            <div class="naay-admin">
              <!-- Header -->
              <header class="naay-admin__header">
                <div class="naay-admin__logo">
                  <span class="naay-admin__logo-icon">🌿</span>
                  <span class="naay-admin__logo-text">Naay Agent</span>
                </div>
                <div class="naay-admin__store-info">
                  <span id="store-name">${shop || 'tu tienda'}</span>
                </div>
              </header>

              <!-- Main Content -->
              <main class="naay-admin__main">
                <!-- Success Banner -->
                <div class="naay-banner">
                  <span class="naay-banner__icon">✅</span>
                  <div>
                    <strong>Conexión exitosa</strong> - App conectada correctamente a ${shop || 'tu tienda'}
                  </div>
                </div>

                <!-- Panel en desarrollo -->
                <div class="naay-banner" style="background: var(--naay-delicate); margin-bottom: 32px;">
                  <span class="naay-banner__icon">🚧</span>
                  <div>
                    <strong>Panel en desarrollo</strong> - Funcionalidades adicionales próximamente
                  </div>
                </div>

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
                </section>

                <!-- Quick Actions -->
                <section class="naay-admin__actions">
                  <h2 class="naay-admin__section-title">🚀 Acciones principales</h2>
                  
                  <div class="naay-quick-action">
                    <div class="naay-quick-action__content">
                      <h3>Sincronizar productos</h3>
                      <p>Actualizar el catálogo de productos en la base de datos</p>
                    </div>
                    <button class="naay-btn naay-btn--primary" onclick="syncProducts()">
                      <span id="sync-btn-text">Sincronizar</span>
                    </button>
                  </div>

                  <div class="naay-quick-action">
                    <div class="naay-quick-action__content">
                      <h3>Ver estado del sistema</h3>
                      <p>Verificar el estado de todos los servicios</p>
                    </div>
                    <button class="naay-btn naay-btn--secondary" onclick="checkSystemHealth()">
                      Verificar estado
                    </button>
                  </div>
                </section>
              </main>
            </div>

            <script>
              let isLoading = false;

              // Inicialización con App Bridge
              const app = createApp({
                apiKey: '${process.env.SHOPIFY_API_KEY || 'api_key_placeholder'}',
                host: '${host}',
              });

              // Cargar datos iniciales
              document.addEventListener('DOMContentLoaded', async function() {
                await loadStats();
              });

              async function loadStats() {
                try {
                  const response = await fetch('/api/admin-bypass/stats');
                  if (response.ok) {
                    const data = await response.json();
                    
                    document.getElementById('products-count').textContent = data.data?.products || '0';
                    document.getElementById('conversations-count').textContent = data.data?.conversations || '0';
                  } else {
                    throw new Error('Failed to load stats');
                  }
                } catch (error) {
                  console.error('Error loading stats:', error);
                  document.getElementById('products-count').textContent = '0';
                  document.getElementById('conversations-count').textContent = '0';
                }
              }

              async function syncProducts() {
                if (isLoading) return;
                
                const button = event.target;
                const btnText = document.getElementById('sync-btn-text');
                
                isLoading = true;
                button.disabled = true;
                btnText.innerHTML = '<span class="naay-loading"></span> Sincronizando...';
                
                try {
                  const response = await fetch('/api/admin-bypass/products/sync', { 
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (response.ok) {
                    alert('Productos sincronizados correctamente');
                    await loadStats(); // Recargar estadísticas
                  } else {
                    throw new Error('Sync failed');
                  }
                } catch (error) {
                  console.error('Sync error:', error);
                  alert('Error al sincronizar productos');
                } finally {
                  isLoading = false;
                  button.disabled = false;
                  btnText.textContent = 'Sincronizar';
                }
              }

              async function checkSystemHealth() {
                try {
                  const response = await fetch('/health/detailed');
                  if (response.ok) {
                    const data = await response.json();
                    alert('Estado del sistema: \\n\\nBase de datos: ' + (data.database?.status || 'unknown') + '\\nOpenAI: ' + (data.openai?.status || 'unknown') + '\\nRedis: ' + (data.redis?.status || 'unknown'));
                  } else {
                    throw new Error('Health check failed');
                  }
                } catch (error) {
                  console.error('Health check error:', error);
                  alert('Error al verificar el sistema');
                }
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
    app.use('/admin-static', express.static(path.join(__dirname, '../../frontend-admin/public')));

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
