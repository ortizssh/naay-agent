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
      // Set CORS headers for all chat API endpoints
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

      console.log('Chat API request - CORS headers set for:', req.path);
      next();
    });

    // Simple Chat API CORS middleware - for simple chat endpoints
    app.use('/api/simple-chat', (req, res, next) => {
      // Set CORS headers for all simple chat API endpoints
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

      console.log('Simple Chat API request - CORS headers set for:', req.path);
      next();
    });

    // Public APIs CORS middleware - for cart and products endpoints
    app.use('/api/public', (req, res, next) => {
      // Set CORS headers for all public API endpoints
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle OPTIONS preflight
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      console.log('Public API request - CORS headers set for:', req.path);
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

    // Rate limiting
    app.use(rateLimiter);

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
            <title>Naay Agent - Admin Panel</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
            <style>
              * {
                box-sizing: border-box;
              }
              
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                margin: 0; 
                padding: 0; 
                background: #f6f6f7; 
                color: #202223;
                font-size: 14px;
                line-height: 1.4;
              }
              
              .polaris-page {
                padding: 24px;
                max-width: 1200px;
                margin: 0 auto;
              }
              
              .polaris-page__header {
                display: flex;
                align-items: center;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #e1e3e5;
              }
              
              .polaris-page__title {
                font-size: 24px;
                font-weight: 600;
                color: #202223;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              
              .polaris-layout {
                display: grid;
                grid-template-columns: 1fr;
                gap: 24px;
              }
              
              @media (min-width: 768px) {
                .polaris-layout {
                  grid-template-columns: 2fr 1fr;
                }
              }
              
              .polaris-card {
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e1e3e5;
                overflow: hidden;
              }
              
              .polaris-card__header {
                padding: 20px 20px 16px;
                border-bottom: 1px solid #e1e3e5;
              }
              
              .polaris-card__title {
                font-size: 16px;
                font-weight: 600;
                color: #202223;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              
              .polaris-card__content {
                padding: 20px;
              }
              
              .polaris-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
              }
              
              .polaris-stat-card {
                background: #ffffff;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e1e3e5;
              }
              
              .polaris-stat-number {
                font-size: 28px;
                font-weight: 700;
                color: #008060;
                margin-bottom: 4px;
              }
              
              .polaris-stat-label {
                font-size: 13px;
                color: #6d7175;
                font-weight: 500;
              }
              
              .polaris-button {
                background: #008060;
                color: #ffffff;
                border: 1px solid #008060;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 4px;
                text-decoration: none;
              }
              
              .polaris-button:hover {
                background: #005e46;
                border-color: #005e46;
              }
              
              .polaris-button--secondary {
                background: #ffffff;
                color: #202223;
                border-color: #c9cccf;
              }
              
              .polaris-button--secondary:hover {
                background: #f6f6f7;
                border-color: #8c9196;
              }
              
              .polaris-button--destructive {
                background: #d72c0d;
                border-color: #d72c0d;
              }
              
              .polaris-button--destructive:hover {
                background: #bf2a0a;
                border-color: #bf2a0a;
              }
              
              .polaris-banner {
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                border: 1px solid;
              }
              
              .polaris-banner--success {
                background: #f0f9ff;
                border-color: #b3e5ff;
                color: #0570de;
              }
              
              .polaris-banner--warning {
                background: #fff9f0;
                border-color: #ffcc99;
                color: #b45309;
              }
              
              .polaris-banner--critical {
                background: #fef7f7;
                border-color: #ffc2c2;
                color: #d72c0d;
              }
              
              .polaris-banner__icon {
                font-size: 16px;
                flex-shrink: 0;
              }
              
              .polaris-toggle {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 12px;
                margin: 16px 0;
              }
              
              .polaris-toggle__input {
                position: relative;
                appearance: none;
                width: 44px;
                height: 24px;
                border-radius: 12px;
                background: #c9cccf;
                border: 1px solid #8c9196;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              
              .polaris-toggle__input:checked {
                background: #008060;
                border-color: #008060;
              }
              
              .polaris-toggle__input::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #ffffff;
                transition: transform 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
              }
              
              .polaris-toggle__input:checked::after {
                transform: translateX(20px);
              }
              
              .polaris-toggle__label {
                font-size: 14px;
                font-weight: 500;
                color: #202223;
              }
              
              .polaris-status-list {
                list-style: none;
                padding: 0;
                margin: 0;
              }
              
              .polaris-status-list li {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f1f2f3;
              }
              
              .polaris-status-list li:last-child {
                border-bottom: none;
              }
              
              .polaris-status-indicator {
                font-size: 16px;
                min-width: 20px;
              }
              
              /* Tabs */
              .polaris-tabs {
                border-bottom: 1px solid #e1e3e5;
                margin-bottom: 24px;
              }
              
              .polaris-tabs__list {
                display: flex;
                list-style: none;
                margin: 0;
                padding: 0;
                gap: 24px;
              }
              
              .polaris-tabs__tab {
                background: none;
                border: none;
                padding: 12px 0;
                color: #6d7175;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
                position: relative;
              }
              
              .polaris-tabs__tab:hover {
                color: #202223;
              }
              
              .polaris-tabs__tab.active {
                color: #008060;
                border-bottom-color: #008060;
              }
              
              .polaris-tab-content {
                display: none;
              }
              
              .polaris-tab-content.active {
                display: block;
              }
              
              /* Conversation list styles */
              .conversation-list {
                max-height: 400px;
                overflow-y: auto;
              }
              
              .conversation-item {
                border-bottom: 1px solid #f1f1f1;
                padding: 12px 0;
                cursor: pointer;
              }
              
              .conversation-item:hover {
                background: #f9fafb;
                margin: 0 -16px;
                padding: 12px 16px;
                border-radius: 6px;
              }
              
              .conversation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
              }
              
              .conversation-id {
                font-size: 12px;
                color: #6d7175;
                font-weight: 500;
              }
              
              .conversation-time {
                font-size: 12px;
                color: #8c9196;
              }
              
              .conversation-preview {
                font-size: 14px;
                color: #202223;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
              
              /* Product analytics styles */
              .product-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f1f1f1;
              }
              
              .product-name {
                font-weight: 500;
                color: #202223;
              }
              
              .product-mentions {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #6d7175;
                font-size: 14px;
              }
              
              /* Log styles */
              .log-item {
                display: flex;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f1f1f1;
                font-family: 'SF Mono', Monaco, monospace;
                font-size: 12px;
              }
              
              .log-timestamp {
                color: #6d7175;
                min-width: 120px;
              }
              
              .log-level {
                min-width: 60px;
                font-weight: 600;
              }
              
              .log-level.info { color: #008060; }
              .log-level.warning { color: #b45309; }
              .log-level.error { color: #d72c0d; }
              
              .log-message {
                color: #202223;
                flex: 1;
              }
              
              .polaris-stack {
                display: flex;
                flex-direction: column;
                gap: 16px;
              }
              
              .polaris-stack--horizontal {
                flex-direction: row;
                flex-wrap: wrap;
                align-items: center;
              }
              
              .polaris-text {
                font-size: 14px;
                line-height: 1.4;
                color: #6d7175;
              }
              
              .polaris-text--body {
                color: #202223;
              }
              
              .polaris-text--subdued {
                color: #8c9196;
              }
              
              .polaris-description-list {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 8px 16px;
                align-items: center;
              }
              
              .polaris-description-list dt {
                font-weight: 600;
                color: #202223;
                font-size: 14px;
              }
              
              .polaris-description-list dd {
                margin: 0;
                color: #6d7175;
                font-size: 14px;
              }
              
              .polaris-webhook-stats {
                background: #f6f6f7;
                border-radius: 6px;
                padding: 16px;
                margin: 16px 0;
                border: 1px solid #e1e3e5;
              }
              
              .polaris-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                font-size: 14px;
              }
              
              @media (max-width: 767px) {
                .polaris-page {
                  padding: 16px;
                }
                
                .polaris-stats-grid {
                  grid-template-columns: 1fr;
                }
                
                .polaris-stack--horizontal {
                  flex-direction: column;
                  align-items: stretch;
                }
                
                .polaris-description-list {
                  grid-template-columns: 1fr;
                  gap: 4px 0;
                }
                
                .polaris-description-list dt {
                  font-weight: 700;
                }
              }
            </style>
          </head>
          <body>
            <div class="polaris-page">
              <div class="polaris-page__header">
                <h1 class="polaris-page__title">
                  <span class="polaris-icon">🤖</span>
                  Naay Agent
                </h1>
              </div>
              
              <div class="polaris-banner polaris-banner--success">
                <span class="polaris-banner__icon">✅</span>
                <div>
                  <strong>Conexión exitosa</strong> - App conectada correctamente a ${shop || 'tu tienda'}
                </div>
              </div>
              
              <div class="polaris-stats-grid">
                <div class="polaris-stat-card">
                  <div id="products-count" class="polaris-stat-number">⏳</div>
                  <div class="polaris-stat-label">Productos Sincronizados</div>
                </div>
                <div class="polaris-stat-card">
                  <div id="conversations-count" class="polaris-stat-number">⏳</div>
                  <div class="polaris-stat-label">Conversaciones</div>
                </div>
                <div class="polaris-stat-card">
                  <div id="chat-status" class="polaris-stat-number">Active</div>
                  <div class="polaris-stat-label">Estado del Chat</div>
                </div>
                <div class="polaris-stat-card">
                  <div id="webhooks-count" class="polaris-stat-number">⏳</div>
                  <div class="polaris-stat-label">Eventos de Webhooks</div>
                </div>
              </div>
              
              <!-- Navigation Tabs -->
              <div class="polaris-tabs">
                <ul class="polaris-tabs__list">
                  <li>
                    <button class="polaris-tabs__tab active" onclick="showTab('dashboard')">
                      🏠 Panel Principal
                    </button>
                  </li>
                  <li>
                    <button class="polaris-tabs__tab" onclick="showTab('conversations')">
                      💬 Conversaciones
                    </button>
                  </li>
                  <li>
                    <button class="polaris-tabs__tab" onclick="showTab('analytics')">
                      📊 Productos Recomendados
                    </button>
                  </li>
                  <li>
                    <button class="polaris-tabs__tab" onclick="showTab('logs')">
                      📋 Logs del Sistema
                    </button>
                  </li>
                </ul>
              </div>
              
              <!-- Tab Contents -->
              <div id="dashboard-tab" class="polaris-tab-content active">
                <div class="polaris-layout">
                  <div class="polaris-stack">
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🚀</span>
                        Acciones Rápidas
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-stack polaris-stack--horizontal">
                        <button class="polaris-button" onclick="syncProducts()">
                          Sincronizar Productos
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="testChat()">
                          Probar Chat
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="viewLogs()">
                          Ver Logs
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🔗</span>
                        Gestión de Webhooks
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-description-list">
                        <dt>Estado de webhooks:</dt>
                        <dd><span id="webhook-status">⏳ Verificando...</span></dd>
                      </div>
                      
                      <div id="webhook-stats" class="polaris-webhook-stats" style="display: none;">
                        <div class="polaris-description-list">
                          <dt>Total de eventos:</dt>
                          <dd><span id="webhook-total">0</span></dd>
                          <dt>Eventos hoy:</dt>
                          <dd><span id="webhook-today">0</span></dd>
                          <dt>Pendientes:</dt>
                          <dd><span id="webhook-pending">0</span></dd>
                        </div>
                      </div>
                      
                      <div class="polaris-stack polaris-stack--horizontal" style="margin-top: 16px;">
                        <button class="polaris-button polaris-button--secondary" onclick="recreateWebhooks()">
                          Recrear Webhooks
                        </button>
                        <button class="polaris-button polaris-button--secondary" onclick="testWebhooks()">
                          Probar Conectividad
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="polaris-stack">
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">⚙️</span>
                        Configuración del Chat
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <form id="settings-form">
                        <div style="display: grid; gap: 16px;">
                          <!-- Welcome Message -->
                          <div class="polaris-form-group">
                            <label for="welcome-message" class="polaris-label">Mensaje de bienvenida</label>
                            <textarea 
                              id="welcome-message" 
                              name="welcome_message"
                              class="polaris-input polaris-textarea" 
                              rows="3" 
                              placeholder="Mensaje que verán los usuarios al abrir el chat..."
                              maxlength="500"
                            ></textarea>
                            <span class="polaris-help-text">Máximo 500 caracteres</span>
                          </div>

                          <!-- Chat Position -->
                          <div class="polaris-form-group">
                            <label for="chat-position" class="polaris-label">Posición del chat</label>
                            <select id="chat-position" name="chat_position" class="polaris-input polaris-select">
                              <option value="bottom-right">Abajo derecha</option>
                              <option value="bottom-left">Abajo izquierda</option>
                              <option value="top-right">Arriba derecha</option>
                              <option value="top-left">Arriba izquierda</option>
                            </select>
                          </div>

                          <!-- Chat Color -->
                          <div class="polaris-form-group">
                            <label for="chat-color" class="polaris-label">Color del chat</label>
                            <input 
                              type="color" 
                              id="chat-color" 
                              name="chat_color" 
                              class="polaris-color-input"
                              value="#008060"
                            />
                          </div>

                          <!-- Checkboxes -->
                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="auto-open-chat" name="auto_open_chat" class="polaris-checkbox">
                                <span class="polaris-checkbox-text">Abrir chat automáticamente</span>
                              </label>
                            </div>
                          </div>

                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="show-agent-avatar" name="show_agent_avatar" class="polaris-checkbox" checked>
                                <span class="polaris-checkbox-text">Mostrar avatar del agente</span>
                              </label>
                            </div>
                          </div>

                          <div class="polaris-form-group">
                            <div class="polaris-checkbox-group">
                              <label class="polaris-checkbox-label">
                                <input type="checkbox" id="enable-product-recommendations" name="enable_product_recommendations" class="polaris-checkbox" checked>
                                <span class="polaris-checkbox-text">Recomendaciones de productos</span>
                              </label>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="polaris-stack polaris-stack--horizontal" style="margin-top: 16px;">
                            <button type="button" class="polaris-button polaris-button--primary" onclick="saveSettings()">
                              Guardar Configuración
                            </button>
                            <button type="button" class="polaris-button polaris-button--secondary" onclick="loadSettings()">
                              Recargar
                            </button>
                            <button type="button" class="polaris-button polaris-button--destructive" onclick="resetSettings()">
                              Restablecer
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">🔧</span>
                        Estado de Servicios
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <ul class="polaris-status-list">
                        <li>
                          <span id="shopify-api-status" class="polaris-status-indicator">⏳</span>
                          <span>SHOPIFY_API_KEY</span>
                        </li>
                        <li>
                          <span id="shopify-secret-status" class="polaris-status-indicator">⏳</span>
                          <span>SHOPIFY_API_SECRET</span>
                        </li>
                        <li>
                          <span id="supabase-status" class="polaris-status-indicator">⏳</span>
                          <span>SUPABASE_URL</span>
                        </li>
                        <li>
                          <span id="openai-status" class="polaris-status-indicator">⏳</span>
                          <span>OPENAI_API_KEY</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div class="polaris-card">
                    <div class="polaris-card__header">
                      <h2 class="polaris-card__title">
                        <span class="polaris-icon">📊</span>
                        Estado del Sistema
                      </h2>
                    </div>
                    <div class="polaris-card__content">
                      <div class="polaris-description-list">
                        <dt>Servidor:</dt>
                        <dd><span id="server-status">⏳ Verificando...</span></dd>
                        <dt>Base de datos:</dt>
                        <dd><span id="db-status">⏳ Verificando...</span></dd>
                        <dt>OpenAI:</dt>
                        <dd><span id="ai-status">⏳ Verificando...</span></dd>
                        <dt>Conectividad:</dt>
                        <dd><span id="webhook-connectivity">⏳ Verificando...</span></dd>
                        <dt>Última actualización:</dt>
                        <dd>${new Date().toLocaleString('es-ES')}</dd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Conversations Tab -->
            <div id="conversations-tab" class="polaris-tab-content">
              <div class="polaris-layout">
                <div class="polaris-card">
                  <div class="polaris-card__header">
                    <h2 class="polaris-card__title">
                      <span class="polaris-icon">💬</span>
                      Conversaciones Recientes
                    </h2>
                  </div>
                  <div class="polaris-card__content">
                    <div id="conversations-loading" class="loading-state">
                      ⏳ Cargando conversaciones...
                    </div>
                    <div id="conversations-list" class="conversation-list" style="display: none;">
                      <!-- Conversaciones se cargarán aquí dinámicamente -->
                    </div>
                    <div id="conversations-empty" style="display: none; text-align: center; color: #8c9196; padding: 40px;">
                      💬 No hay conversaciones aún.<br>
                      <small>Las conversaciones aparecerán aquí una vez que los usuarios interactúen con el chat.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Analytics Tab -->
            <div id="analytics-tab" class="polaris-tab-content">
              <div class="polaris-layout">
                <div class="polaris-card">
                  <div class="polaris-card__header">
                    <h2 class="polaris-card__title">
                      <span class="polaris-icon">📊</span>
                      Productos Más Recomendados
                    </h2>
                  </div>
                  <div class="polaris-card__content">
                    <div id="analytics-loading" class="loading-state">
                      ⏳ Analizando recomendaciones...
                    </div>
                    <div id="analytics-content" style="display: none;">
                      <div class="analytics-summary" style="margin-bottom: 20px; padding: 16px; background: #f6f6f7; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <span><strong>Período:</strong> <span id="analytics-period">Últimos 30 días</span></span>
                          <span><strong>Total conversaciones:</strong> <span id="total-conversations">0</span></span>
                        </div>
                      </div>
                      <div id="products-list">
                        <!-- Productos se cargarán aquí -->
                      </div>
                    </div>
                    <div id="analytics-empty" style="display: none; text-align: center; color: #8c9196; padding: 40px;">
                      📊 No hay datos de productos aún.<br>
                      <small>Los productos recomendados aparecerán aquí una vez que el agente empiece a recomendarlos.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Logs Tab -->
            <div id="logs-tab" class="polaris-tab-content">
              <div class="polaris-layout">
                <div class="polaris-card">
                  <div class="polaris-card__header">
                    <h2 class="polaris-card__title">
                      <span class="polaris-icon">📋</span>
                      Logs del Sistema
                    </h2>
                    <div style="display: flex; gap: 8px;">
                      <select id="log-level-filter" onchange="filterLogs()" style="padding: 4px 8px; border: 1px solid #c9cccf; border-radius: 4px; font-size: 14px;">
                        <option value="all">Todos los niveles</option>
                        <option value="info">Info</option>
                        <option value="warning">Advertencias</option>
                        <option value="error">Errores</option>
                      </select>
                      <button class="polaris-button polaris-button--secondary" onclick="refreshLogs()">
                        🔄 Actualizar
                      </button>
                    </div>
                  </div>
                  <div class="polaris-card__content">
                    <div id="logs-loading" class="loading-state">
                      ⏳ Cargando logs...
                    </div>
                    <div id="logs-list" style="display: none; max-height: 500px; overflow-y: auto; font-family: 'SF Mono', Monaco, monospace; font-size: 12px;">
                      <!-- Logs se cargarán aquí -->
                    </div>
                    <div id="logs-empty" style="display: none; text-align: center; color: #8c9196; padding: 40px;">
                      📋 No hay logs disponibles.<br>
                      <small>Los logs del sistema aparecerán aquí.</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <script>
              // Initialize App Bridge 3.0 with proper session token handling
              let app = null;
              let sessionToken = null;
              let authenticatedFetch = null;
              const host = '${host || ''}';
              
              // Helper function to get session token from App Bridge
              async function getSessionToken() {
                return new Promise((resolve, reject) => {
                  if (!app) {
                    reject('App Bridge not initialized');
                    return;
                  }
                  
                  const timeout = setTimeout(() => {
                    reject('Session token request timeout');
                  }, 5000);
                  
                  try {
                    app.getSessionToken().then(token => {
                      clearTimeout(timeout);
                      sessionToken = token;
                      resolve(token);
                    }).catch(error => {
                      clearTimeout(timeout);
                      reject(error);
                    });
                  } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                  }
                });
              }
              
              if (host && typeof AppBridge !== 'undefined') {
                try {
                  app = AppBridge.createApp({
                    apiKey: '${config.shopify.apiKey}',
                    host: host
                  });
                  
                  console.log('App Bridge 3.0 initialized successfully');
                  
                  // Try to get initial session token
                  getSessionToken().then(token => {
                    console.log('Initial session token obtained');
                  }).catch(error => {
                    console.warn('Could not get initial session token:', error);
                  });
                  
                } catch (error) {
                  console.error('Failed to initialize App Bridge:', error);
                }
              } else if (!host) {
                console.warn('No host parameter provided - App Bridge cannot initialize');
              }
              
              // Enhanced helper function for authenticated requests
              async function makeAuthenticatedRequest(url, options = {}) {
                // Strategy 1: Try to get fresh session token from App Bridge
                if (app) {
                  try {
                    const token = await getSessionToken();
                    console.log('Using fresh session token for request');
                    return await fetch(url, {
                      ...options,
                      headers: {
                        ...options.headers,
                        'Authorization': \`Bearer \${token}\`,
                        'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                      }
                    });
                  } catch (error) {
                    console.warn('Session token failed, trying fallback:', error);
                  }
                }
                
                // Strategy 2: Try cached session token
                if (sessionToken) {
                  try {
                    console.log('Using cached session token');
                    return await fetch(url, {
                      ...options,
                      headers: {
                        ...options.headers,
                        'Authorization': \`Bearer \${sessionToken}\`,
                        'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                      }
                    });
                  } catch (error) {
                    console.warn('Cached session token failed, trying legacy:', error);
                  }
                }
                
                // Strategy 3: Fallback to legacy token 
                console.log('Using legacy token fallback');
                return await fetch(url, {
                  ...options,
                  headers: {
                    ...options.headers,
                    'Authorization': 'Bearer ${token || ''}',
                    'Content-Type': options.headers?.['Content-Type'] || 'application/json'
                  }
                });
              }
              
              // Function definitions
              window.syncProducts = async function() {
                try {
                  // Show loading state
                  const button = document.querySelector('button[onclick="syncProducts()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Sincronizando...';
                  button.disabled = true;
                  
                  const response = await fetch('/api/admin-bypass/products/sync', { 
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shop: '${shop || ''}' })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Sincronización iniciada correctamente. Revisa los logs para seguimiento.');
                  } else {
                    alert('❌ Error en sincronización: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Sync error:', error);
                  alert('❌ Error de conexión durante la sincronización');
                }
              };
              
              window.testChat = function() {
                if (app) {
                  // Use App Bridge 3.0 actions
                  app.dispatch(AppBridge.actions.Navigation.navigate('/api/chat/test'));
                } else {
                  window.open('/api/chat/test', '_blank');
                }
              };
              
              window.viewLogs = function() {
                showTab('logs');
              };
              
              // Tab management functions
              window.showTab = function(tabName) {
                // Hide all tab contents
                document.querySelectorAll('.polaris-tab-content').forEach(content => {
                  content.classList.remove('active');
                });
                
                // Remove active class from all tabs
                document.querySelectorAll('.polaris-tabs__tab').forEach(tab => {
                  tab.classList.remove('active');
                });
                
                // Show selected tab content
                const selectedContent = document.getElementById(tabName + '-tab');
                if (selectedContent) {
                  selectedContent.classList.add('active');
                }
                
                // Add active class to selected tab button
                const selectedTab = event?.target || document.querySelector(\`[onclick="showTab('\${tabName}')"]\`);
                if (selectedTab) {
                  selectedTab.classList.add('active');
                }
                
                // Load data for the selected tab
                switch(tabName) {
                  case 'conversations':
                    loadConversations();
                    break;
                  case 'analytics':
                    loadAnalytics();
                    break;
                  case 'logs':
                    loadLogs();
                    break;
                  case 'dashboard':
                    loadDashboardStats();
                    break;
                }
              };
              
              // Load dashboard statistics
              async function loadDashboardStats() {
                try {
                  const response = await fetch('/api/admin-bypass/stats?shop=' + encodeURIComponent('${shop || ''}'));
                  
                  if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success) {
                      const stats = data.data;
                      document.getElementById('products-count').textContent = stats.products || 0;
                      document.getElementById('conversations-count').textContent = stats.conversations || 0;
                      document.getElementById('webhooks-count').textContent = stats.webhooks || 0;
                      document.getElementById('chat-status').textContent = stats.chatStatus || 'Active';
                    }
                  }
                } catch (error) {
                  console.error('Error loading dashboard stats:', error);
                }
              }
              
              // Load conversations
              async function loadConversations() {
                const loadingEl = document.getElementById('conversations-loading');
                const listEl = document.getElementById('conversations-list');
                const emptyEl = document.getElementById('conversations-empty');
                
                loadingEl.style.display = 'block';
                listEl.style.display = 'none';
                emptyEl.style.display = 'none';
                
                try {
                  const response = await fetch('/api/admin-bypass/conversations?shop=' + encodeURIComponent('${shop || ''}') + '&limit=20');
                  
                  if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.data.conversations.length > 0) {
                      renderConversations(data.data.conversations);
                      listEl.style.display = 'block';
                    } else {
                      emptyEl.style.display = 'block';
                    }
                  } else {
                    emptyEl.style.display = 'block';
                  }
                } catch (error) {
                  console.error('Error loading conversations:', error);
                  emptyEl.style.display = 'block';
                } finally {
                  loadingEl.style.display = 'none';
                }
              }
              
              function renderConversations(conversations) {
                const listEl = document.getElementById('conversations-list');
                listEl.innerHTML = conversations.map(conv => {
                  const lastMessage = conv.messages[conv.messages.length - 1];
                  const previewText = lastMessage?.user?.substring(0, 100) || 'Sin mensajes';
                  const timeAgo = new Date(conv.last_message).toLocaleString('es-ES');
                  
                  return \`
                    <div class="conversation-item" onclick="showConversationDetails('\${conv.session_id}')">
                      <div class="conversation-header">
                        <span class="conversation-id">ID: \${conv.session_id.substring(0, 12)}...</span>
                        <span class="conversation-time">\${timeAgo}</span>
                      </div>
                      <div class="conversation-preview">\${previewText}\${previewText.length >= 100 ? '...' : ''}</div>
                      <div style="font-size: 12px; color: #8c9196; margin-top: 4px;">
                        \${conv.messages.length} mensaje\${conv.messages.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  \`;
                }).join('');
              }
              
              window.showConversationDetails = function(sessionId) {
                // Esta función podría expandir para mostrar detalles de la conversación
                alert(\`Mostrando detalles de la conversación: \${sessionId}\`);
              };
              
              // Load analytics
              async function loadAnalytics() {
                const loadingEl = document.getElementById('analytics-loading');
                const contentEl = document.getElementById('analytics-content');
                const emptyEl = document.getElementById('analytics-empty');
                
                loadingEl.style.display = 'block';
                contentEl.style.display = 'none';
                emptyEl.style.display = 'none';
                
                try {
                  const response = await fetch('/api/admin-bypass/analytics/products?shop=' + encodeURIComponent('${shop || ''}') + '&days=30');
                  
                  if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.data.topProducts.length > 0) {
                      renderAnalytics(data.data);
                      contentEl.style.display = 'block';
                    } else {
                      emptyEl.style.display = 'block';
                    }
                  } else {
                    emptyEl.style.display = 'block';
                  }
                } catch (error) {
                  console.error('Error loading analytics:', error);
                  emptyEl.style.display = 'block';
                } finally {
                  loadingEl.style.display = 'none';
                }
              }
              
              function renderAnalytics(data) {
                document.getElementById('total-conversations').textContent = data.totalConversations;
                document.getElementById('analytics-period').textContent = \`Últimos \${data.periodDays} días\`;
                
                const productsListEl = document.getElementById('products-list');
                productsListEl.innerHTML = data.topProducts.map(product => \`
                  <div class="product-item">
                    <div class="product-name">\${product.name}</div>
                    <div class="product-mentions">
                      <span>\${product.mentions} menciones</span>
                      <span style="color: #008060; font-weight: 600;">(\${product.percentage}%)</span>
                    </div>
                  </div>
                \`).join('');
              }
              
              // Load logs
              async function loadLogs() {
                const loadingEl = document.getElementById('logs-loading');
                const listEl = document.getElementById('logs-list');
                const emptyEl = document.getElementById('logs-empty');
                
                loadingEl.style.display = 'block';
                listEl.style.display = 'none';
                emptyEl.style.display = 'none';
                
                try {
                  const level = document.getElementById('log-level-filter')?.value || 'all';
                  const response = await fetch('/api/admin-bypass/logs?shop=' + encodeURIComponent('${shop || ''}') + '&level=' + level + '&limit=50');
                  
                  if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.data.logs.length > 0) {
                      renderLogs(data.data.logs);
                      listEl.style.display = 'block';
                    } else {
                      emptyEl.style.display = 'block';
                    }
                  } else {
                    emptyEl.style.display = 'block';
                  }
                } catch (error) {
                  console.error('Error loading logs:', error);
                  emptyEl.style.display = 'block';
                } finally {
                  loadingEl.style.display = 'none';
                }
              }
              
              function renderLogs(logs) {
                const listEl = document.getElementById('logs-list');
                listEl.innerHTML = logs.map(log => {
                  const timestamp = new Date(log.timestamp).toLocaleString('es-ES');
                  return \`
                    <div class="log-item">
                      <div class="log-timestamp">\${timestamp}</div>
                      <div class="log-level \${log.level}">\${log.level.toUpperCase()}</div>
                      <div class="log-message">\${log.message}</div>
                    </div>
                  \`;
                }).join('');
              }
              
              window.filterLogs = function() {
                loadLogs();
              };
              
              window.refreshLogs = function() {
                loadLogs();
              };
              
              // Webhook management functions
              window.recreateWebhooks = async function() {
                try {
                  const button = document.querySelector('button[onclick="recreateWebhooks()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Creando...';
                  button.disabled = true;
                  
                  const response = await fetch('/api/admin-bypass/webhooks/create', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shop: '${shop || ''}' })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Webhooks recreados correctamente');
                    loadWebhookStatus(); // Refresh status
                  } else {
                    alert('❌ Error al recrear webhooks: ' + data.error);
                  }
                  
                  button.textContent = originalText;
                  button.disabled = false;
                } catch (error) {
                  console.error('Webhook recreation error:', error);
                  alert('❌ Error de conexión al recrear webhooks');
                }
              };
              
              window.testWebhooks = async function() {
                try {
                  const response = await fetch('/api/admin-bypass/webhooks/test', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shop: '${shop || ''}' })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    const results = data.data.testResults;
                    const reachable = results.filter(r => r.status === 'reachable').length;
                    const total = results.length;
                    alert(\`🔗 Test de conectividad: \${reachable}/\${total} endpoints alcanzables\`);
                  } else {
                    alert('❌ Error al probar webhooks: ' + data.error);
                  }
                } catch (error) {
                  console.error('Webhook test error:', error);
                  alert('❌ Error de conexión al probar webhooks');
                }
              };
              
              
              // Check system status on load
              window.addEventListener('load', async function() {
                try {
                  // Check detailed health endpoint
                  const healthResponse = await fetch('/health/detailed');
                  const healthData = await healthResponse.json();
                  
                  // Update system status indicators
                  document.querySelector('#server-status').textContent = healthData.success ? '✅ En línea' : '❌ Error';
                  document.querySelector('#db-status').textContent = 
                    healthData.services?.database === 'healthy' ? '✅ Conectado' : '⚠️ Error de conexión';
                  document.querySelector('#ai-status').textContent = 
                    healthData.services?.openai === 'healthy' ? '✅ Conectado' : '⚠️ Error de conexión';
                  
                  // Update credential status indicators
                  document.querySelector('#shopify-api-status').textContent = '✅';
                  document.querySelector('#shopify-secret-status').textContent = '✅';
                  document.querySelector('#supabase-status').textContent = 
                    healthData.services?.database === 'healthy' ? '✅' : '⚠️';
                  document.querySelector('#openai-status').textContent = 
                    healthData.services?.openai === 'healthy' ? '✅' : '⚠️';
                  
                  // Widget is always enabled - update status display
                  const chatStatusNumber = document.querySelector('.polaris-stat-card:nth-child(3) .polaris-stat-number');
                  if (chatStatusNumber) {
                    chatStatusNumber.textContent = 'Active';
                    
                    // Update the main chat status indicator to always show active
                    const chatStatusDiv = document.querySelector('.polaris-stat-card:nth-child(3)');
                    if (chatStatusDiv) {
                      chatStatusDiv.style.backgroundColor = '#f0f9ff';
                      chatStatusDiv.style.border = '1px solid #b3e5ff';
                      chatStatusNumber.style.color = '#008060';
                    }
                  }
                  
                  // Load webhook status
                  loadWebhookStatus();
                  
                  // Load settings on page load
                  loadSettings(true);
                  
                  // Load initial dashboard stats
                  loadDashboardStats();
                  
                } catch (error) {
                  console.error('Status check failed:', error);
                  document.querySelector('#server-status').textContent = '❌ Error';
                  document.querySelector('#db-status').textContent = '❌ Error';
                  document.querySelector('#ai-status').textContent = '❌ Error';
                }
              });
              
              // Function to load webhook status
              async function loadWebhookStatus() {
                try {
                  const statsResponse = await fetch('/api/admin-bypass/webhooks/stats?shop=${shop || ''}');
                  const statsData = await statsResponse.json();
                  
                  if (statsData.success) {
                    const stats = statsData.data.stats;
                    document.querySelector('#webhook-status').textContent = '✅ Configurado';
                    document.querySelector('#webhook-connectivity').textContent = '✅ Conectado';
                    
                    // Show webhook stats
                    document.querySelector('#webhook-stats').style.display = 'block';
                    document.querySelector('#webhook-total').textContent = stats.total || 0;
                    document.querySelector('#webhook-today').textContent = stats.today || 0;
                    document.querySelector('#webhook-pending').textContent = stats.pending || 0;
                    
                    // Update products synchronized count (approximate from webhook events)
                    const productEvents = ['products/create', 'products/update'].reduce((sum, topic) => 
                      sum + (stats.topicBreakdown[topic] || 0), 0);
                    document.querySelector('.polaris-stat-card:first-child .polaris-stat-number').textContent = productEvents;
                  } else {
                    document.querySelector('#webhook-status').textContent = '⚠️ No configurado';
                    document.querySelector('#webhook-connectivity').textContent = '⚠️ Error';
                  }
                } catch (error) {
                  console.error('Webhook status check failed:', error);
                  document.querySelector('#webhook-status').textContent = '❌ Error';
                  document.querySelector('#webhook-connectivity').textContent = '❌ Error';
                }
              }
              
              // Settings management functions
              window.saveSettings = async function() {
                try {
                  const button = document.querySelector('button[onclick="saveSettings()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Guardando...';
                  button.disabled = true;
                  
                  // Gather form data
                  const formData = {
                    shop: '${shop || ''}',
                    welcome_message: document.getElementById('welcome-message').value,
                    chat_position: document.getElementById('chat-position').value,
                    chat_color: document.getElementById('chat-color').value,
                    auto_open_chat: document.getElementById('auto-open-chat').checked,
                    show_agent_avatar: document.getElementById('show-agent-avatar').checked,
                    enable_product_recommendations: document.getElementById('enable-product-recommendations').checked
                  };
                  
                  const response = await fetch('/api/admin-bypass/settings/update', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    alert('✅ Configuración guardada correctamente');
                  } else {
                    alert('❌ Error al guardar configuración: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Save settings error:', error);
                  alert('❌ Error de conexión al guardar configuración');
                  
                  // Restore button
                  const button = document.querySelector('button[onclick="saveSettings()"]');
                  button.textContent = 'Guardar Configuración';
                  button.disabled = false;
                }
              };
              
              window.loadSettings = async function(silent = false) {
                try {
                  const button = document.querySelector('button[onclick="loadSettings()"]');
                  let originalText = '';
                  
                  if (button && !silent) {
                    originalText = button.textContent;
                    button.textContent = 'Cargando...';
                    button.disabled = true;
                  }
                  
                  const response = await fetch('/api/admin-bypass/settings?shop=${shop || ''}');
                  const data = await response.json();
                  
                  if (data.success && data.data.settings) {
                    const settings = data.data.settings;
                    
                    // Populate form fields
                    document.getElementById('welcome-message').value = settings.welcome_message || '';
                    document.getElementById('chat-position').value = settings.chat_position || 'bottom-right';
                    document.getElementById('chat-color').value = settings.chat_color || '#008060';
                    document.getElementById('auto-open-chat').checked = settings.auto_open_chat || false;
                    document.getElementById('show-agent-avatar').checked = settings.show_agent_avatar !== false;
                    document.getElementById('enable-product-recommendations').checked = settings.enable_product_recommendations !== false;
                    
                    if (!silent) {
                      alert('✅ Configuración recargada correctamente');
                    }
                  } else {
                    if (!silent) {
                      alert('❌ Error al cargar configuración: ' + (data.error || 'Unknown error'));
                    }
                  }
                  
                  // Restore button
                  if (button && !silent) {
                    button.textContent = originalText;
                    button.disabled = false;
                  }
                  
                } catch (error) {
                  console.error('Load settings error:', error);
                  
                  if (!silent) {
                    alert('❌ Error de conexión al cargar configuración');
                    
                    // Restore button
                    const button = document.querySelector('button[onclick="loadSettings()"]');
                    if (button) {
                      button.textContent = 'Recargar';
                      button.disabled = false;
                    }
                  }
                }
              };
              
              window.resetSettings = async function() {
                if (!confirm('¿Estás seguro de que deseas restablecer todas las configuraciones a sus valores por defecto?')) {
                  return;
                }
                
                try {
                  const button = document.querySelector('button[onclick="resetSettings()"]');
                  const originalText = button.textContent;
                  button.textContent = 'Restableciendo...';
                  button.disabled = true;
                  
                  const response = await fetch('/api/admin-bypass/settings/reset', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ shop: '${shop || ''}' })
                  });
                  
                  const data = await response.json();
                  
                  if (data.success) {
                    // Update form with default values
                    const settings = data.data.settings;
                    document.getElementById('welcome-message').value = settings.welcome_message || '';
                    document.getElementById('chat-position').value = settings.chat_position || 'bottom-right';
                    document.getElementById('chat-color').value = settings.chat_color || '#008060';
                    document.getElementById('auto-open-chat').checked = settings.auto_open_chat || false;
                    document.getElementById('show-agent-avatar').checked = settings.show_agent_avatar !== false;
                    document.getElementById('enable-product-recommendations').checked = settings.enable_product_recommendations !== false;
                    
                    alert('✅ Configuración restablecida a valores por defecto');
                  } else {
                    alert('❌ Error al restablecer configuración: ' + data.error);
                  }
                  
                  // Restore button
                  button.textContent = originalText;
                  button.disabled = false;
                  
                } catch (error) {
                  console.error('Reset settings error:', error);
                  alert('❌ Error de conexión al restablecer configuración');
                  
                  // Restore button
                  const button = document.querySelector('button[onclick="resetSettings()"]');
                  button.textContent = 'Restablecer';
                  button.disabled = false;
                }
              };
            </script>
          </body>
          </html>
        `);
      } else if (hmac && shop && host) {
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
