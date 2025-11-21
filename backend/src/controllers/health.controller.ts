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
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'naay-agent-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      issues: health.issues,
      metrics: health.metrics
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
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
        nodeVersion: process.version
      }
    });

  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics'
    });
  }
});

export default router;