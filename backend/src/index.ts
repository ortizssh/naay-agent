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
