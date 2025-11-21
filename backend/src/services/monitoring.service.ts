import { logger } from '@/utils/logger';
import { cacheService } from './cache.service';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percentage';
  shop?: string;
  endpoint?: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface VectorSearchMetrics {
  searchCount: number;
  averageLatency: number;
  cacheHitRate: number;
  errorCount: number;
  lastSearchTime: Date;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private vectorSearchMetrics: Map<string, VectorSearchMetrics> = new Map();
  private readonly maxMetricsHistory = 1000;

  constructor() {
    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
    
    // Log aggregated metrics every 15 minutes
    setInterval(() => this.logAggregatedMetrics(), 15 * 60 * 1000);
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: new Date()
    });

    // Limit memory usage
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log critical metrics immediately
    if (metric.name.includes('error') || metric.value > 5000) {
      logger.warn('Critical performance metric recorded', metric);
    }
  }

  /**
   * Measure execution time of an operation
   */
  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now();
    let error: Error | null = null;

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: `${operationName}_duration`,
        value: duration,
        unit: 'ms',
        tags: metadata
      });

      if (duration > 1000) {
        logger.warn('Slow operation detected', {
          operation: operationName,
          duration,
          metadata
        });
      }

      return result;
    } catch (err) {
      error = err as Error;
      const duration = Date.now() - startTime;

      this.recordMetric({
        name: `${operationName}_error`,
        value: 1,
        unit: 'count',
        tags: { ...metadata, error: error.message }
      });

      this.recordMetric({
        name: `${operationName}_duration`,
        value: duration,
        unit: 'ms',
        tags: { ...metadata, status: 'error' }
      });

      throw error;
    }
  }

  /**
   * Measure vector search performance
   */
  async measureVectorSearch<T>(
    shopDomain: string,
    operation: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    let isError = false;

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      // Update vector search metrics
      const shopMetrics = this.vectorSearchMetrics.get(shopDomain) || {
        searchCount: 0,
        averageLatency: 0,
        cacheHitRate: 0,
        errorCount: 0,
        lastSearchTime: new Date()
      };

      shopMetrics.searchCount++;
      shopMetrics.averageLatency = 
        (shopMetrics.averageLatency * (shopMetrics.searchCount - 1) + duration) / shopMetrics.searchCount;
      shopMetrics.lastSearchTime = new Date();

      this.vectorSearchMetrics.set(shopDomain, shopMetrics);

      // Record individual metric
      this.recordMetric({
        name: 'vector_search_duration',
        value: duration,
        unit: 'ms',
        shop: shopDomain,
        tags: metadata
      });

      logger.info('Vector search completed', {
        shop: shopDomain,
        duration,
        ...metadata
      });

      return result;
    } catch (error) {
      isError = true;
      const duration = Date.now() - startTime;

      // Update error count
      const shopMetrics = this.vectorSearchMetrics.get(shopDomain);
      if (shopMetrics) {
        shopMetrics.errorCount++;
        this.vectorSearchMetrics.set(shopDomain, shopMetrics);
      }

      this.recordMetric({
        name: 'vector_search_error',
        value: 1,
        unit: 'count',
        shop: shopDomain,
        tags: { ...metadata, error: (error as Error).message }
      });

      logger.error('Vector search failed', {
        shop: shopDomain,
        duration,
        error: (error as Error).message,
        ...metadata
      });

      throw error;
    }
  }

  /**
   * Legacy method alias for measureOperation
   */
  async measurePerformance<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string>
  ): Promise<T> {
    return this.measureOperation(operationName, operation, metadata);
  }

  /**
   * Record Shopify API request
   */
  recordShopifyRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    shop?: string
  ): void {
    this.recordMetric({
      name: 'shopify_request',
      value: duration,
      unit: 'ms',
      shop,
      tags: {
        endpoint,
        method,
        statusCode: statusCode.toString(),
        success: statusCode < 400 ? 'true' : 'false'
      }
    });
  }

  /**
   * Record webhook processing
   */
  recordWebhookProcessing(
    webhook: string,
    duration: number,
    success: boolean,
    shop?: string
  ): void {
    this.recordMetric({
      name: 'webhook_processing',
      value: duration,
      unit: 'ms',
      shop,
      tags: {
        webhook,
        success: success.toString()
      }
    });
  }

  /**
   * Record Shopify rate limit information
   */
  recordShopifyRateLimit(
    remaining: number,
    limit: number,
    shop?: string
  ): void {
    const percentage = limit > 0 ? (remaining / limit) * 100 : 0;
    this.recordMetric({
      name: 'shopify_rate_limit',
      value: percentage,
      unit: 'percentage',
      shop,
      tags: {
        remaining: remaining.toString(),
        limit: limit.toString()
      }
    });
  }

  /**
   * Health check for monitoring systems
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: Record<string, any>;
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check cache health
    const cacheMetrics = cacheService.getMetrics();
    if (!cacheMetrics.redisConnected) {
      issues.push('Redis cache not connected');
      status = 'degraded';
    }

    if (cacheMetrics.hitRatio < 0.5) {
      issues.push('Low cache hit ratio');
      if (status === 'healthy') status = 'degraded';
    }

    // Check vector search performance
    const recentMetrics = this.metrics.filter(
      m => m.timestamp > new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
    );

    const searchErrors = recentMetrics.filter(m => m.name.includes('error')).length;
    const totalSearches = recentMetrics.filter(m => m.name.includes('search')).length;

    if (totalSearches > 0 && (searchErrors / totalSearches) > 0.1) {
      issues.push('High error rate in vector search');
      status = 'unhealthy';
    }

    return {
      status,
      issues,
      metrics: {
        cacheMetrics,
        recentErrorCount: searchErrors,
        recentSearchCount: totalSearches,
        vectorSearchShops: this.vectorSearchMetrics.size
      }
    };
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    
    logger.info('Metrics cleanup completed', {
      removed: initialCount - this.metrics.length,
      remaining: this.metrics.length
    });
  }

  private logAggregatedMetrics(): void {
    const health = this.getHealthStatus();
    
    logger.info('Performance metrics summary', {
      health: health.status,
      issues: health.issues,
      totalMetrics: this.metrics.length,
      vectorSearchShops: this.vectorSearchMetrics.size
    });
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();

// Legacy exports for compatibility
export { MonitoringService };
export { MonitoringService as ShopifyMonitoring };

// Export helper function for common use cases
export function withVectorSearchTracking<T>(
  shopDomain: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return monitoringService.measureVectorSearch(shopDomain, operation, metadata);
}