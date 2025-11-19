import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '@/utils/config';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import { requestLogger } from '@/middleware/requestLogger';

// Route imports
import authRoutes from '@/controllers/auth.controller';
import productRoutes from '@/controllers/product.controller';
import webhookRoutes from '@/controllers/webhook.controller';
import chatRoutes from '@/controllers/chat.controller';
import healthRoutes from '@/controllers/health.controller';

async function startServer() {
  try {
    // Validate configuration
    validateConfig();

    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? [config.shopify.appUrl]
            : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      })
    );

    // Rate limiting
    app.use(rateLimiter);

    // Request logging
    app.use(requestLogger);

    // Body parsing middleware
    app.use('/api/webhooks', express.raw({ type: 'application/json' }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Health check (before auth)
    app.use('/health', healthRoutes);

    // Root route for Shopify app installation
    app.get('/', (req, res) => {
      const { token, shop } = req.query;
      
      // Debug logging
      logger.info('Root route accessed', {
        query: req.query,
        url: req.url,
        hasToken: !!token,
        hasShop: !!shop
      });
      
      // If coming from Shopify OAuth callback with token and shop
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
            products: '/api/products'
          }
        });
      }
    });

    // Success page after Shopify app installation
    app.get('/success', (req, res) => {
      const { token, shop } = req.query;
      
      logger.info('Success page accessed', {
        query: req.query,
        hasToken: !!token,
        hasShop: !!shop
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

    // API Routes
    app.use('/auth', authRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/chat', chatRoutes);

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
