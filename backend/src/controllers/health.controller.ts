import { Router, Request, Response } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';

const router = Router();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
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
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      }
    }
  };

  try {
    // Check Supabase connection
    const supabaseService = new SupabaseService();
    await (supabaseService as any).serviceClient.from('stores').select('id').limit(1);
    health.services.database = 'healthy';
  } catch (error) {
    logger.error('Database health check failed:', error);
    health.services.database = 'unhealthy';
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
    await (supabaseService as any).serviceClient.from('stores').select('id').limit(1);

    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Liveness check
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

export default router;