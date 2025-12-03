import { SupabaseService } from './supabase.service';
import { ShopifyService } from './shopify.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';

export interface WebhookStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: Array<{
    id: string;
    topic: string;
    shop: string;
    processed: boolean;
    created_at: string;
    error_message?: string;
  }>;
  successRate: number;
}

export interface WebhookTestResult {
  success: boolean;
  webhook_id?: string;
  message: string;
  error?: string;
}

export class AdminWebhooksService {
  private supabaseService: SupabaseService;
  private shopifyService: ShopifyService;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.shopifyService = new ShopifyService();
  }

  async getWebhookStats(shop: string): Promise<WebhookStats> {
    try {
      logger.info('Getting webhook stats for shop:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Get webhook events from the last 30 days including today
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day 30 days ago
      
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      const { data: events, error } = await this.supabaseService.client
        .from('webhook_events')
        .select('*')
        .eq('shop_domain', shop)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.error('Error fetching webhook events:', error);
        throw new AppError('Failed to fetch webhook events', 500);
      }

      const totalEvents = events?.length || 0;
      const processedEvents = events?.filter(e => e.processed) || [];
      const successRate =
        totalEvents > 0 ? (processedEvents.length / totalEvents) * 100 : 100;

      // Group events by type
      const eventsByType = (events || []).reduce(
        (acc: Record<string, number>, event: { topic: string }) => {
          acc[event.topic] = (acc[event.topic] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get recent events (last 10)
      const recentEvents = (events || [])
        .slice(0, 10)
        .map(
          (event: {
            id: string;
            topic: string;
            shop_domain: string;
            processed: boolean;
            created_at: string;
            error_message?: string;
          }) => ({
            id: event.id,
            topic: event.topic,
            shop: event.shop_domain,
            processed: event.processed,
            created_at: event.created_at,
            error_message: event.error_message,
          })
        );

      return {
        totalEvents,
        eventsByType,
        recentEvents,
        successRate,
      };
    } catch (error) {
      logger.error('Error getting webhook stats:', error);
      throw new AppError('Failed to get webhook stats', 500);
    }
  }

  async createWebhooks(shop: string): Promise<{
    success: boolean;
    message: string;
    webhooks?: Array<{ id: string; topic: string }>;
  }> {
    try {
      logger.info('Creating webhooks for shop:', shop);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      const webhookTopics = [
        'products/create',
        'products/update',
        'products/delete',
        'app/uninstalled',
      ];

      const results = [];
      const errors = [];

      for (const topic of webhookTopics) {
        try {
          const webhookEndpoint = `${process.env.SHOPIFY_APP_URL}/api/webhooks/${topic.replace('/', '/')}`;

          // Create webhook using Shopify service
          const result = await this.shopifyService.createWebhook(
            store.access_token,
            shop,
            topic,
            webhookEndpoint
          );

          if (result.success && result.webhook) {
            results.push({
              id: result.webhook.id.toString(),
              topic: topic,
            });
          } else {
            errors.push(
              `Failed to create ${topic}: ${result.error || 'Unknown error'}`
            );
          }
        } catch (error) {
          logger.error(`Error creating webhook ${topic}:`, error);
          errors.push(
            `Failed to create ${topic}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (results.length === 0) {
        throw new AppError(
          `Failed to create any webhooks: ${errors.join(', ')}`,
          500
        );
      }

      const message =
        errors.length > 0
          ? `Created ${results.length} webhooks with ${errors.length} errors: ${errors.join(', ')}`
          : `Successfully created ${results.length} webhooks`;

      return {
        success: true,
        message,
        webhooks: results,
      };
    } catch (error) {
      logger.error('Error creating webhooks:', error);
      throw new AppError('Failed to create webhooks', 500);
    }
  }

  async testWebhook(shop: string, topic: string): Promise<WebhookTestResult> {
    try {
      logger.info('Testing webhook for shop:', shop, 'topic:', topic);

      const store = await this.supabaseService.getStore(shop);
      if (!store) {
        throw new AppError('Store not found', 404);
      }

      // Simulate a webhook call by creating a test webhook event
      const testData = {
        shop_domain: shop,
        topic: topic,
        data: { test: true, timestamp: new Date().toISOString() },
        processed: false,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabaseService.client
        .from('webhook_events')
        .insert(testData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating test webhook event:', error);
        throw new AppError('Failed to create test webhook event', 500);
      }

      return {
        success: true,
        webhook_id: data.id,
        message: `Test webhook event created successfully for topic: ${topic}`,
      };
    } catch (error) {
      logger.error('Error testing webhook:', error);
      return {
        success: false,
        message: 'Failed to test webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
