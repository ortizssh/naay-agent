import { Request } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { config } from '@/utils/config';
import { 
  ShopifyWebhookError, 
  ShopifyError, 
  ErrorCode,
  ShopifyProduct,
  ShopifyWebhookPayload 
} from '@/types';
import { cacheService } from './cache.service';
import { monitoringService } from './monitoring.service';
import { recordShopifyRateLimit } from '@/middleware/rateLimiter';

export interface WebhookProcessingResult {
  success: boolean;
  processed: boolean;
  action: string;
  shop: string;
  topic: string;
  processingTime: number;
  error?: string;
  retryAfter?: number;
}

export interface WebhookRetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class WebhookProcessor {
  private readonly retryConfig: WebhookRetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2
  };

  async processWebhook(req: Request): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const topic = req.headers['x-shopify-topic'] as string;
    const shop = req.headers['x-shopify-shop-domain'] as string;
    const webhookId = req.headers['x-shopify-webhook-id'] as string;

    try {
      // Validate webhook signature
      this.validateWebhookSignature(req);

      // Check for duplicate processing
      const isDuplicate = await this.checkDuplicateWebhook(webhookId, shop);
      if (isDuplicate) {
        logger.info('Duplicate webhook detected, skipping processing', {
          topic,
          shop,
          webhookId
        });
        
        return {
          success: true,
          processed: false,
          action: 'skipped_duplicate',
          shop,
          topic,
          processingTime: Date.now() - startTime
        };
      }

      // Mark webhook as being processed
      await this.markWebhookProcessing(webhookId, shop);

      // Process the webhook based on topic
      const result = await this.processWebhookByTopic(topic, req.body, shop);

      // Mark webhook as processed
      await this.markWebhookCompleted(webhookId, shop, result.success);

      // Record metrics
      const processingTime = Date.now() - startTime;
      monitoringService.recordWebhookProcessing(topic, processingTime, result.success, shop);

      return {
        ...result,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        const resetTime = this.extractRateLimitReset(error);
        if (resetTime) {
          await recordShopifyRateLimit(shop, resetTime);
        }

        monitoringService.recordShopifyRateLimit(0, 100, shop);

        return {
          success: false,
          processed: false,
          action: 'rate_limited',
          shop,
          topic,
          processingTime,
          error: 'Rate limit exceeded',
          retryAfter: resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : 60
        };
      }

      // Handle other errors
      logger.error('Webhook processing failed', {
        topic,
        shop,
        webhookId,
        error: error.message,
        stack: error.stack
      });

      monitoringService.recordWebhookProcessing(topic, processingTime, false, shop);

      // Mark webhook as failed
      await this.markWebhookFailed(webhookId, shop, error.message);

      return {
        success: false,
        processed: false,
        action: 'failed',
        shop,
        topic,
        processingTime,
        error: error.message
      };
    }
  }

  private validateWebhookSignature(req: Request): void {
    const signature = req.headers['x-shopify-hmac-sha256'] as string;
    const body = req.rawBody || Buffer.from(JSON.stringify(req.body));

    if (!signature) {
      throw new ShopifyWebhookError('Missing webhook signature');
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.shopify.webhookSecret)
      .update(body)
      .digest('base64');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new ShopifyWebhookError('Invalid webhook signature');
    }
  }

  private async checkDuplicateWebhook(webhookId: string, shop: string): Promise<boolean> {
    if (!webhookId) return false;

    const key = `webhook:${shop}:${webhookId}`;
    const existing = await cacheService.get(key);
    return existing !== null;
  }

  private async markWebhookProcessing(webhookId: string, shop: string): Promise<void> {
    if (!webhookId) return;

    const key = `webhook:${shop}:${webhookId}`;
    await cacheService.set(key, { status: 'processing', timestamp: new Date() }, { ttl: 3600 });
  }

  private async markWebhookCompleted(webhookId: string, shop: string, success: boolean): Promise<void> {
    if (!webhookId) return;

    const key = `webhook:${shop}:${webhookId}`;
    await cacheService.set(key, { 
      status: success ? 'completed' : 'failed', 
      timestamp: new Date() 
    }, { ttl: 86400 }); // Keep for 24 hours
  }

  private async markWebhookFailed(webhookId: string, shop: string, error: string): Promise<void> {
    if (!webhookId) return;

    const key = `webhook:${shop}:${webhookId}`;
    await cacheService.set(key, { 
      status: 'failed', 
      error, 
      timestamp: new Date() 
    }, { ttl: 86400 });
  }

  private async processWebhookByTopic(
    topic: string, 
    payload: ShopifyWebhookPayload, 
    shop: string
  ): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    
    try {
      switch (topic) {
        case 'products/create':
          return await this.handleProductCreate(payload, shop);
        
        case 'products/update':
          return await this.handleProductUpdate(payload, shop);
        
        case 'products/delete':
          return await this.handleProductDelete(payload, shop);
        
        case 'app/uninstalled':
          return await this.handleAppUninstall(payload, shop);
        
        case 'orders/create':
          return await this.handleOrderCreate(payload, shop);
        
        case 'orders/updated':
          return await this.handleOrderUpdate(payload, shop);
        
        case 'customers/create':
          return await this.handleCustomerCreate(payload, shop);
        
        case 'shop/update':
          return await this.handleShopUpdate(payload, shop);

        default:
          logger.info('Unhandled webhook topic', { topic, shop });
          return {
            success: true,
            processed: false,
            action: 'unhandled_topic',
            shop,
            topic
          };
      }
    } catch (error) {
      throw new ShopifyWebhookError(
        `Failed to process ${topic} webhook: ${error.message}`,
        shop,
        { topic, payload: payload.id || 'unknown' }
      );
    }
  }

  private async handleProductCreate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing product create webhook', { 
      productId: payload.id, 
      shop, 
      title: payload.title 
    });

    // Enqueue product sync job
    await this.enqueueProductSync(shop, payload.id, 'create');
    
    // Invalidate product cache
    await this.invalidateProductCache(shop);

    return {
      success: true,
      processed: true,
      action: 'product_created',
      shop,
      topic: 'products/create'
    };
  }

  private async handleProductUpdate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing product update webhook', { 
      productId: payload.id, 
      shop, 
      title: payload.title 
    });

    // Enqueue product sync job
    await this.enqueueProductSync(shop, payload.id, 'update');
    
    // Invalidate specific product cache
    await this.invalidateProductCache(shop, payload.id);

    return {
      success: true,
      processed: true,
      action: 'product_updated',
      shop,
      topic: 'products/update'
    };
  }

  private async handleProductDelete(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing product delete webhook', { 
      productId: payload.id, 
      shop 
    });

    // Enqueue product deletion job
    await this.enqueueProductSync(shop, payload.id, 'delete');
    
    // Invalidate product cache
    await this.invalidateProductCache(shop, payload.id);

    return {
      success: true,
      processed: true,
      action: 'product_deleted',
      shop,
      topic: 'products/delete'
    };
  }

  private async handleAppUninstall(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.warn('Processing app uninstall webhook', { shop });

    // Clear all shop data
    await this.cleanupShopData(shop);

    return {
      success: true,
      processed: true,
      action: 'app_uninstalled',
      shop,
      topic: 'app/uninstalled'
    };
  }

  private async handleOrderCreate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing order create webhook', { 
      orderId: payload.id, 
      shop,
      total: payload.total_price 
    });

    // Track order analytics
    monitoringService.recordShopifyRequest('order_create', 'POST', 200, 0, shop);

    return {
      success: true,
      processed: true,
      action: 'order_created',
      shop,
      topic: 'orders/create'
    };
  }

  private async handleOrderUpdate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing order update webhook', { 
      orderId: payload.id, 
      shop,
      status: payload.fulfillment_status 
    });

    return {
      success: true,
      processed: true,
      action: 'order_updated',
      shop,
      topic: 'orders/updated'
    };
  }

  private async handleCustomerCreate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing customer create webhook', { 
      customerId: payload.id, 
      shop,
      email: payload.email 
    });

    return {
      success: true,
      processed: true,
      action: 'customer_created',
      shop,
      topic: 'customers/create'
    };
  }

  private async handleShopUpdate(payload: any, shop: string): Promise<Omit<WebhookProcessingResult, 'processingTime'>> {
    logger.info('Processing shop update webhook', { shop });

    // Update cached shop data
    await cacheService.invalidateShopCache(shop);

    return {
      success: true,
      processed: true,
      action: 'shop_updated',
      shop,
      topic: 'shop/update'
    };
  }

  private async enqueueProductSync(shop: string, productId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    // This would integrate with your queue service (BullMQ, etc.)
    logger.info('Enqueueing product sync job', { shop, productId, action });
    
    // For now, we'll use cache to track sync jobs
    const syncKey = `sync:${shop}:${productId}:${action}`;
    await cacheService.set(syncKey, {
      shop,
      productId,
      action,
      enqueuedAt: new Date(),
      status: 'pending'
    }, { ttl: 3600 });
  }

  private async invalidateProductCache(shop: string, productId?: string): Promise<void> {
    if (productId) {
      // Invalidate specific product caches
      await cacheService.del(`product:${shop}:${productId}`);
      await cacheService.del(`embedding:product:${productId}`);
    } else {
      // Invalidate all product caches for shop
      await cacheService.clear(`product:${shop}:*`);
    }
    
    // Invalidate search caches
    await cacheService.clear(`search:${shop}:*`);
  }

  private async cleanupShopData(shop: string): Promise<void> {
    // Invalidate all shop-related caches
    await cacheService.invalidateShopCache(shop);
    
    // Clear product and search caches
    await cacheService.clear(`product:${shop}:*`);
    await cacheService.clear(`search:${shop}:*`);
    await cacheService.clear(`sync:${shop}:*`);
    
    logger.info('Shop data cleanup completed', { shop });
  }

  private isRateLimitError(error: any): boolean {
    return error.response?.status === 429 || 
           error.code === 'SHOPIFY_RATE_LIMIT' ||
           error.message?.includes('rate limit') ||
           error.message?.includes('throttled');
  }

  private extractRateLimitReset(error: any): Date | null {
    // Try to extract reset time from various possible sources
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10);
      return new Date(Date.now() + retryAfter * 1000);
    }
    
    if (error.response?.headers?.['x-shopify-shop-api-call-limit']) {
      // Shopify specific header - estimate reset time
      return new Date(Date.now() + 60000); // 1 minute default
    }
    
    return null;
  }

  // Retry mechanism for failed webhooks
  async retryWebhook(
    webhookData: any, 
    retryCount: number = 0
  ): Promise<WebhookProcessingResult> {
    if (retryCount >= this.retryConfig.maxRetries) {
      throw new ShopifyWebhookError(
        `Webhook retry limit exceeded after ${retryCount} attempts`
      );
    }

    try {
      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxDelay
      );

      logger.info('Retrying webhook processing', {
        retryCount,
        delay,
        topic: webhookData.topic,
        shop: webhookData.shop
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Attempt to process again
      const result = await this.processWebhookByTopic(
        webhookData.topic,
        webhookData.payload,
        webhookData.shop
      );
      
      return {
        ...result,
        processingTime: Date.now() - Date.now() // This would be calculated properly in real implementation
      };

    } catch (error) {
      if (this.isRateLimitError(error)) {
        // For rate limit errors, wait longer before retry
        const resetTime = this.extractRateLimitReset(error);
        if (resetTime) {
          const waitTime = resetTime.getTime() - Date.now();
          if (waitTime > 0 && waitTime < 300000) { // Max 5 minutes wait
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.retryWebhook(webhookData, retryCount + 1);
          }
        }
      }

      // For other errors, use exponential backoff
      return this.retryWebhook(webhookData, retryCount + 1);
    }
  }

  // Health check for webhook processing
  async getWebhookHealth(shop: string): Promise<{
    healthy: boolean;
    recentWebhooks: number;
    failureRate: number;
    avgProcessingTime: number;
  }> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // This would typically query your database or monitoring service
    // For now, return a basic health check
    return {
      healthy: true,
      recentWebhooks: 0,
      failureRate: 0,
      avgProcessingTime: 150
    };
  }
}

// Singleton instance
export const webhookProcessor = new WebhookProcessor();