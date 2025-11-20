import { logger } from '@/utils/logger';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  timestamp: Date;
}

export class MonitoringService {
  private metrics: MetricData[] = [];
  private healthChecks: HealthCheck[] = [];

  // Record custom metrics
  recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
    const metric: MetricData = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    logger.debug(`Metric recorded: ${name}`, { value, tags });
  }

  // Increment counter metric
  incrementCounter(name: string, tags: Record<string, string> = {}) {
    this.recordMetric(name, 1, { ...tags, type: 'counter' });
  }

  // Record timing metric
  recordTiming(name: string, duration: number, tags: Record<string, string> = {}) {
    this.recordMetric(name, duration, { ...tags, type: 'timing', unit: 'ms' });
  }

  // Record health check
  recordHealthCheck(service: string, status: HealthCheck['status'], responseTime?: number, error?: string) {
    const healthCheck: HealthCheck = {
      service,
      status,
      responseTime,
      error,
      timestamp: new Date()
    };

    this.healthChecks.push(healthCheck);

    // Keep only last 100 health checks
    if (this.healthChecks.length > 100) {
      this.healthChecks = this.healthChecks.slice(-100);
    }

    logger.info(`Health check: ${service}`, { status, responseTime, error });
  }

  // Get metrics summary
  getMetricsSummary() {
    const summary: Record<string, any> = {};

    // Group metrics by name
    const metricsByName = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric);
      return acc;
    }, {} as Record<string, MetricData[]>);

    // Calculate statistics for each metric
    Object.entries(metricsByName).forEach(([name, metrics]) => {
      const values = metrics.map(m => m.value);
      const counters = metrics.filter(m => m.tags?.type === 'counter');
      const timings = metrics.filter(m => m.tags?.type === 'timing');

      summary[name] = {
        count: metrics.length,
        latest: values[values.length - 1],
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        counters: counters.length,
        avgTiming: timings.length > 0 ?
          timings.reduce((a, b) => a + b.value, 0) / timings.length : null
      };
    });

    return summary;
  }

  // Get health status
  getHealthStatus() {
    const latestChecks = this.healthChecks.reduce((acc, check) => {
      acc[check.service] = check;
      return acc;
    }, {} as Record<string, HealthCheck>);

    const overallStatus = Object.values(latestChecks).every(check => check.status === 'healthy')
      ? 'healthy'
      : Object.values(latestChecks).some(check => check.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return {
      overall: overallStatus,
      services: latestChecks,
      timestamp: new Date()
    };
  }

  // Performance monitoring wrapper
  async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.recordTiming(`${operation}_duration`, duration, tags);
      this.incrementCounter(`${operation}_success`, tags);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordTiming(`${operation}_duration`, duration, { ...tags, error: 'true' });
      this.incrementCounter(`${operation}_error`, { ...tags, error_type: error.name });

      throw error;
    }
  }

  // External service health check
  async checkExternalService(url: string, timeout: number = 5000): Promise<HealthCheck> {
    const startTime = Date.now();
    const serviceName = new URL(url).hostname;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const status = response.ok ? 'healthy' : 'degraded';

      this.recordHealthCheck(serviceName, status, responseTime);

      return {
        service: serviceName,
        status,
        responseTime,
        timestamp: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.recordHealthCheck(serviceName, 'unhealthy', responseTime, error.message);

      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // Memory usage monitoring
  recordMemoryUsage() {
    const memUsage = process.memoryUsage();

    this.recordMetric('memory_heap_used', memUsage.heapUsed, { unit: 'bytes' });
    this.recordMetric('memory_heap_total', memUsage.heapTotal, { unit: 'bytes' });
    this.recordMetric('memory_external', memUsage.external, { unit: 'bytes' });
    this.recordMetric('memory_rss', memUsage.rss, { unit: 'bytes' });
  }

  // Clear old data
  clearOldData(maxAge: number = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge;

    this.metrics = this.metrics.filter(m => (m.timestamp?.getTime() || 0) > cutoff);
    this.healthChecks = this.healthChecks.filter(h => h.timestamp.getTime() > cutoff);
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();

// Periodic cleanup (every hour)
setInterval(() => {
  monitoringService.clearOldData();
}, 60 * 60 * 1000);

// Periodic memory monitoring (every 5 minutes)
setInterval(() => {
  monitoringService.recordMemoryUsage();
}, 5 * 60 * 1000);

// Shopify-specific monitoring extensions
export interface ShopifyMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorCount: number;
  rateLimitHits: number;
  webhookEvents: number;
  chatMessages: number;
  productSearches: number;
  cartOperations: number;
  lastActivity: Date;
}

export class ShopifyMonitoring {
  // Record Shopify-specific metrics
  static recordShopifyRequest(shop: string, endpoint: string, responseTime: number, success: boolean) {
    monitoringService.recordTiming('shopify_request', responseTime, {
      shop,
      endpoint,
      success: success.toString(),
      category: this.categorizeEndpoint(endpoint)
    });

    if (!success) {
      monitoringService.incrementCounter('shopify_error', { shop, endpoint });
    }
  }

  static recordChatMessage(shop: string, processingTime: number, intent?: string, success: boolean = true) {
    monitoringService.recordTiming('chat_message', processingTime, {
      shop,
      intent: intent || 'unknown',
      success: success.toString()
    });
  }

  static recordProductSearch(shop: string, query: string, resultsCount: number, searchTime: number) {
    monitoringService.recordTiming('product_search', searchTime, {
      shop,
      query_length: query.length.toString(),
      results_count: resultsCount.toString(),
      has_results: (resultsCount > 0).toString()
    });
  }

  static recordEmbeddingGeneration(shop: string, textLength: number, processingTime: number, cached: boolean) {
    monitoringService.recordTiming('embedding_generation', processingTime, {
      shop,
      text_length: textLength.toString(),
      cached: cached.toString()
    });

    if (cached) {
      monitoringService.incrementCounter('embedding_cache_hit', { shop });
    } else {
      monitoringService.incrementCounter('embedding_cache_miss', { shop });
    }
  }

  static recordWebhookProcessing(shop: string, topic: string, processingTime: number, success: boolean) {
    monitoringService.recordTiming('webhook_processing', processingTime, {
      shop,
      topic,
      success: success.toString()
    });
  }

  static recordShopifyRateLimit(shop: string, endpoint: string) {
    monitoringService.incrementCounter('shopify_rate_limit', {
      shop,
      endpoint
    });
  }

  // Get shop-specific metrics
  static getShopMetrics(shop: string): ShopifyMetrics {
    const summary = monitoringService.getMetricsSummary();
    
    // Filter metrics for specific shop
    // Note: This is a simplified version. In production, you'd want to filter by shop tag
    const now = new Date();
    
    return {
      requestCount: summary.shopify_request?.count || 0,
      averageResponseTime: summary.shopify_request?.avgTiming || 0,
      errorCount: summary.shopify_error?.count || 0,
      rateLimitHits: summary.shopify_rate_limit?.count || 0,
      webhookEvents: summary.webhook_processing?.count || 0,
      chatMessages: summary.chat_message?.count || 0,
      productSearches: summary.product_search?.count || 0,
      cartOperations: summary.cart_operation?.count || 0,
      lastActivity: now
    };
  }

  // Check if a shop is healthy
  static isShopHealthy(shop: string, thresholds: {
    maxErrorRate?: number;
    maxResponseTime?: number;
    minCacheHitRate?: number;
  } = {}): boolean {
    const metrics = this.getShopMetrics(shop);
    const defaults = {
      maxErrorRate: 5, // 5%
      maxResponseTime: 2000, // 2 seconds
      minCacheHitRate: 70 // 70%
    };

    const config = { ...defaults, ...thresholds };

    const errorRate = metrics.requestCount > 0 ? 
      (metrics.errorCount / metrics.requestCount) * 100 : 0;

    return errorRate <= config.maxErrorRate && 
           metrics.averageResponseTime <= config.maxResponseTime;
  }

  // Alert on shop issues
  static checkShopHealth(shop: string): Array<{ type: 'warning' | 'critical'; message: string }> {
    const alerts: Array<{ type: 'warning' | 'critical'; message: string }> = [];
    const metrics = this.getShopMetrics(shop);

    // High error rate
    const errorRate = metrics.requestCount > 0 ? 
      (metrics.errorCount / metrics.requestCount) * 100 : 0;
    
    if (errorRate > 15) {
      alerts.push({
        type: 'critical',
        message: `High error rate: ${errorRate.toFixed(1)}% for shop ${shop}`
      });
    } else if (errorRate > 5) {
      alerts.push({
        type: 'warning',
        message: `Elevated error rate: ${errorRate.toFixed(1)}% for shop ${shop}`
      });
    }

    // Slow response times
    if (metrics.averageResponseTime > 5000) {
      alerts.push({
        type: 'critical',
        message: `Very slow response times: ${metrics.averageResponseTime}ms for shop ${shop}`
      });
    } else if (metrics.averageResponseTime > 2000) {
      alerts.push({
        type: 'warning',
        message: `Slow response times: ${metrics.averageResponseTime}ms for shop ${shop}`
      });
    }

    // Rate limiting issues
    if (metrics.rateLimitHits > 10) {
      alerts.push({
        type: 'warning',
        message: `Frequent rate limiting for shop ${shop}: ${metrics.rateLimitHits} hits`
      });
    }

    return alerts;
  }

  private static categorizeEndpoint(endpoint: string): string {
    if (endpoint.includes('webhook')) return 'webhook';
    if (endpoint.includes('chat')) return 'chat';
    if (endpoint.includes('product')) return 'product';
    if (endpoint.includes('auth')) return 'auth';
    if (endpoint.includes('admin')) return 'admin';
    if (endpoint.includes('widget')) return 'widget';
    return 'other';
  }
}

// Enhanced health check for Shopify services
export async function performShopifyHealthCheck(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  const results: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } = {
    overall: 'healthy',
    details: {}
  };

  try {
    // Check Shopify Partners API
    const shopifyCheck = await monitoringService.checkExternalService(
      'https://partners.shopify.com',
      5000
    );
    results.details.shopify = shopifyCheck;

    // Check OpenAI API
    const openaiCheck = await monitoringService.checkExternalService(
      'https://api.openai.com',
      10000
    );
    results.details.openai = openaiCheck;

    // Determine overall status
    const checks = [shopifyCheck, openaiCheck];
    if (checks.some(c => c.status === 'unhealthy')) {
      results.overall = 'unhealthy';
    } else if (checks.some(c => c.status === 'degraded')) {
      results.overall = 'degraded';
    }

    // Add system metrics
    const systemHealth = monitoringService.getHealthStatus();
    results.details.system = systemHealth;

    return results;
  } catch (error) {
    return {
      overall: 'unhealthy',
      details: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}