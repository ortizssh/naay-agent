/**
 * Performance monitoring utilities for conversation queries
 */

import { logger } from './logger';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  recordCount?: number;
  cacheHit?: boolean;
  queryType?: 'fast' | 'optimized' | 'fallback';
  shop?: string;
  timestamp: Date;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 operations

  // Performance thresholds in milliseconds
  private static readonly THRESHOLDS = {
    CONVERSATION_LIST: 100,
    CONVERSATION_COUNT: 50,
    CONVERSATION_DETAILS: 200,
    CHART_DATA: 300,
    STATS: 150,
  };

  /**
   * Record a performance metric
   */
  static recordMetric(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: new Date(),
    };

    // Add to metrics array
    this.metrics.push(fullMetric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log if performance is poor
    const threshold = this.getThreshold(metric.operation);
    if (metric.duration > threshold) {
      logger.warn('Poor performance detected', {
        operation: metric.operation,
        duration: metric.duration,
        threshold,
        shop: metric.shop,
        recordCount: metric.recordCount,
        queryType: metric.queryType,
      });
    } else {
      logger.info('Performance metric recorded', {
        operation: metric.operation,
        duration: metric.duration,
        shop: metric.shop,
        queryType: metric.queryType,
      });
    }
  }

  /**
   * Get performance threshold for an operation
   */
  private static getThreshold(operation: string): number {
    if (operation.includes('conversation') && operation.includes('list')) {
      return this.THRESHOLDS.CONVERSATION_LIST;
    }
    if (operation.includes('conversation') && operation.includes('count')) {
      return this.THRESHOLDS.CONVERSATION_COUNT;
    }
    if (operation.includes('conversation') && operation.includes('details')) {
      return this.THRESHOLDS.CONVERSATION_DETAILS;
    }
    if (operation.includes('chart')) {
      return this.THRESHOLDS.CHART_DATA;
    }
    if (operation.includes('stats')) {
      return this.THRESHOLDS.STATS;
    }
    return 1000; // Default threshold
  }

  /**
   * Get performance statistics
   */
  static getStatistics(
    operation?: string,
    shop?: string
  ): {
    totalOperations: number;
    averageDuration: number;
    p95Duration: number;
    slowOperations: number;
    fastQueryUsage: number;
    cacheHitRate: number;
    recentMetrics: PerformanceMetrics[];
  } {
    let filteredMetrics = this.metrics;

    if (operation) {
      filteredMetrics = filteredMetrics.filter(m =>
        m.operation.toLowerCase().includes(operation.toLowerCase())
      );
    }

    if (shop) {
      filteredMetrics = filteredMetrics.filter(m => m.shop === shop);
    }

    if (filteredMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        p95Duration: 0,
        slowOperations: 0,
        fastQueryUsage: 0,
        cacheHitRate: 0,
        recentMetrics: [],
      };
    }

    const durations = filteredMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b);
    const threshold = operation ? this.getThreshold(operation) : 1000;

    const slowOperations = filteredMetrics.filter(
      m => m.duration > threshold
    ).length;
    const fastQueries = filteredMetrics.filter(
      m => m.queryType === 'fast'
    ).length;
    const cacheHits = filteredMetrics.filter(m => m.cacheHit === true).length;

    return {
      totalOperations: filteredMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      slowOperations,
      fastQueryUsage: (fastQueries / filteredMetrics.length) * 100,
      cacheHitRate: (cacheHits / filteredMetrics.length) * 100,
      recentMetrics: filteredMetrics.slice(-10), // Last 10 operations
    };
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Get recent performance alerts
   */
  static getAlerts(minutesBack: number = 5): Array<{
    severity: 'warning' | 'critical';
    message: string;
    operation: string;
    duration: number;
    timestamp: Date;
  }> {
    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    return recentMetrics
      .filter(m => {
        const threshold = this.getThreshold(m.operation);
        return m.duration > threshold;
      })
      .map(m => {
        const threshold = this.getThreshold(m.operation);
        const severity = m.duration > threshold * 2 ? 'critical' : 'warning';

        return {
          severity,
          message: `${m.operation} took ${m.duration}ms (threshold: ${threshold}ms)`,
          operation: m.operation,
          duration: m.duration,
          timestamp: m.timestamp,
        };
      });
  }

  /**
   * Export metrics for analysis
   */
  static exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Performance timing decorator
   */
  static withTiming<T extends any[], R>(
    operation: string,
    shop?: string,
    queryType?: 'fast' | 'optimized' | 'fallback'
  ) {
    return function (
      target: any,
      propertyName: string,
      descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
    ) {
      const method = descriptor.value!;

      descriptor.value = async function (...args: T): Promise<R> {
        const startTime = Date.now();
        let recordCount: number | undefined;
        let cacheHit: boolean | undefined;

        try {
          const result = await method.apply(this, args);

          // Try to extract record count from result
          if (result && typeof result === 'object') {
            if (
              'conversations' in result &&
              Array.isArray(result.conversations)
            ) {
              recordCount = result.conversations.length;
            } else if ('data' in result && Array.isArray(result.data)) {
              recordCount = result.data.length;
            }
          }

          return result;
        } finally {
          const duration = Date.now() - startTime;

          PerformanceMonitor.recordMetric({
            operation,
            duration,
            recordCount,
            cacheHit,
            queryType,
            shop,
          });
        }
      };
    };
  }
}

/**
 * Simple timing utility for non-decorator usage
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  options?: {
    shop?: string;
    queryType?: 'fast' | 'optimized' | 'fallback';
    cacheHit?: boolean;
  }
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    let recordCount: number | undefined;
    if (result && typeof result === 'object') {
      if ('conversations' in result && Array.isArray(result.conversations)) {
        recordCount = result.conversations.length;
      } else if ('data' in result && Array.isArray(result.data)) {
        recordCount = result.data.length;
      }
    }

    PerformanceMonitor.recordMetric({
      operation,
      duration,
      recordCount,
      cacheHit: options?.cacheHit,
      queryType: options?.queryType,
      shop: options?.shop,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    PerformanceMonitor.recordMetric({
      operation: `${operation} (failed)`,
      duration,
      queryType: options?.queryType,
      shop: options?.shop,
    });

    throw error;
  }
}
