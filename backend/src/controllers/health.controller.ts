import { Router, Request, Response } from 'express';
import { monitoringService } from '@/services/monitoring.service';
import { cacheService } from '@/services/cache.service';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = monitoringService.getHealthStatus();
    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200
          : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'naay-agent-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      issues: health.issues,
      metrics: health.metrics,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Detailed metrics endpoint
 * GET /api/health/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const cacheMetrics = cacheService.getMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      cache: cacheMetrics,
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * Azure debug endpoint for troubleshooting production issues
 * GET /api/health/azure-debug
 */
router.get('/azure-debug', async (req: Request, res: Response) => {
  try {
    const envVarsFiltered = Object.keys(process.env)
      .filter(
        k =>
          k.includes('SHOPIFY') ||
          k.includes('SUPABASE') ||
          k.includes('OPENAI') ||
          k.includes('REDIS') ||
          k.includes('NODE_') ||
          k.includes('PORT')
      )
      .reduce(
        (obj, key) => {
          // Hide sensitive values but show they exist
          obj[key] = process.env[key] ? '***SET***' : 'NOT_SET';
          return obj;
        },
        {} as Record<string, string>
      );

    res.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        totalEnvVars: Object.keys(process.env).length,
        filteredEnvVars: envVarsFiltered,
      },
      paths: {
        __dirname: __dirname,
        'process.cwd()': process.cwd(),
        'require.resolve()': require
          .resolve('../index.js')
          .replace('/index.js', ''),
      },
      azure: {
        WEBSITES_PORT: process.env.WEBSITES_PORT || 'NOT_SET',
        WEBSITE_NODE_DEFAULT_VERSION:
          process.env.WEBSITE_NODE_DEFAULT_VERSION || 'NOT_SET',
        AZURE_STATIC_WEB_APPS_API_TOKEN: process.env
          .AZURE_STATIC_WEB_APPS_API_TOKEN
          ? 'SET'
          : 'NOT_SET',
      },
      process: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    logger.error('Azure debug endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve Azure debug info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
