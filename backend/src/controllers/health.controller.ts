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

/**
 * Widget file debug endpoint
 * GET /health/widget-debug
 */
router.get('/widget-debug', async (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      directories: {},
      widget_paths: {},
      file_exists: {},
    };

    // Check current working directory
    debugInfo.directories.cwd = process.cwd();
    debugInfo.directories.dirname = __dirname;

    // List contents of working directory
    try {
      const cwdContents = fs.readdirSync(process.cwd());
      debugInfo.directories.cwd_contents = cwdContents;
    } catch (err: any) {
      debugInfo.directories.cwd_error = err.message;
    }

    // List contents of __dirname
    try {
      const dirnameContents = fs.readdirSync(__dirname);
      debugInfo.directories.dirname_contents = dirnameContents;
    } catch (err: any) {
      debugInfo.directories.dirname_error = err.message;
    }

    // Test widget paths
    const widgetPaths = [
      path.join(__dirname, 'public', 'naay-widget.js'),
      path.join(__dirname, '../public', 'naay-widget.js'),
      path.join(process.cwd(), 'public', 'naay-widget.js'),
      path.join(process.cwd(), 'dist', 'public', 'naay-widget.js'),
    ];

    widgetPaths.forEach((testPath, index) => {
      debugInfo.widget_paths[`path_${index}`] = testPath;
      debugInfo.file_exists[`path_${index}`] = fs.existsSync(testPath);

      if (fs.existsSync(testPath)) {
        try {
          const stats = fs.statSync(testPath);
          debugInfo[`path_${index}_size`] = stats.size;
          debugInfo[`path_${index}_modified`] = stats.mtime;
        } catch (err: any) {
          debugInfo[`path_${index}_error`] = err.message;
        }
      }
    });

    // Try to list public directory if it exists
    const publicPaths = [
      path.join(__dirname, 'public'),
      path.join(__dirname, '../public'),
      path.join(process.cwd(), 'public'),
    ];

    publicPaths.forEach((pubPath, index) => {
      if (fs.existsSync(pubPath)) {
        try {
          const contents = fs.readdirSync(pubPath);
          debugInfo[`public_${index}_contents`] = contents;
        } catch (err: any) {
          debugInfo[`public_${index}_error`] = err.message;
        }
      }
    });

    res.json(debugInfo);
  } catch (error) {
    logger.error('Widget debug endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve widget debug info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Admin file debug endpoint 
 * GET /health/admin-debug
 */
router.get('/admin-debug', async (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const adminPaths = [
      path.join(__dirname, '../public/admin/index.html'),
      path.join(__dirname, 'public/admin/index.html'),
      path.join(process.cwd(), 'public/admin/index.html'),
      path.join(process.cwd(), 'dist/public/admin/index.html')
    ];
    
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      admin_paths: {},
      file_exists: {},
      admin_directory: {}
    };
    
    adminPaths.forEach((testPath, index) => {
      debugInfo.admin_paths[`path_${index}`] = testPath;
      debugInfo.file_exists[`path_${index}`] = fs.existsSync(testPath);
      
      if (fs.existsSync(testPath)) {
        try {
          const stats = fs.statSync(testPath);
          debugInfo[`admin_${index}_size`] = stats.size;
          debugInfo[`admin_${index}_modified`] = stats.mtime;
        } catch (err: any) {
          debugInfo[`admin_${index}_error`] = err.message;
        }
      }
    });
    
    // Check admin directories
    const adminDirs = [
      path.join(__dirname, '../public/admin'),
      path.join(__dirname, 'public/admin'),
      path.join(process.cwd(), 'public/admin')
    ];
    
    adminDirs.forEach((dirPath, index) => {
      if (fs.existsSync(dirPath)) {
        try {
          const contents = fs.readdirSync(dirPath);
          debugInfo.admin_directory[`dir_${index}_contents`] = contents;
          debugInfo.admin_directory[`dir_${index}_path`] = dirPath;
        } catch (err: any) {
          debugInfo.admin_directory[`dir_${index}_error`] = err.message;
        }
      }
    });
    
    res.json(debugInfo);
    
  } catch (error) {
    logger.error('Admin debug endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve admin debug info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
