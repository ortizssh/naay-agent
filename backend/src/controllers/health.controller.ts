import { Router, Request, Response } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { monitoringService } from '@/services/monitoring.service';
import { logger } from '@/utils/logger';
import { config } from '@/utils/config';
import OpenAI from 'openai';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const health = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'unknown',
      openai: 'unknown',
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
    },
  };

  // Check Supabase connection
  try {
    const supabaseService = new SupabaseService();
    await (supabaseService as any).serviceClient
      .from('stores')
      .select('id')
      .limit(1);
    health.services.database = 'healthy';
  } catch (error) {
    logger.error('Database health check failed:', error);
    health.services.database = 'unhealthy';
    health.success = false;
    health.status = 'unhealthy';
  }

  // Check OpenAI connection
  try {
    if (!config.openai.apiKey || config.openai.apiKey.startsWith('your_')) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    // Basic validation - check if API key format is valid
    if (!config.openai.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    health.services.openai = 'healthy';
  } catch (error) {
    logger.error('OpenAI health check failed:', error);
    health.services.openai = 'unhealthy';
    health.success = false;
    health.status = 'unhealthy';
  }

  const statusCode = health.success ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all required services are ready
    const supabaseService = new SupabaseService();
    await (supabaseService as any).serviceClient
      .from('stores')
      .select('id')
      .limit(1);

    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// Liveness check
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getMetricsSummary();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Health status endpoint
router.get('/status', (req: Request, res: Response) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();

    const statusCode = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: healthStatus.overall === 'healthy',
      status: healthStatus.overall,
      timestamp: healthStatus.timestamp,
      services: healthStatus.services
    });
  } catch (error) {
    logger.error('Health status endpoint error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to retrieve health status',
      timestamp: new Date().toISOString()
    });
  }
});

// External service check endpoint
router.get('/external-check', async (req: Request, res: Response) => {
  try {
    const { url, timeout } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }

    const timeoutNum = timeout ? parseInt(timeout as string) : 5000;
    const result = await monitoringService.checkExternalService(url, timeoutNum);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      check: result
    });
  } catch (error) {
    logger.error('External check endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform external check',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
