import { logger } from '@/utils/logger';
import { SupabaseService } from './supabase.service';
import { SimpleConversionTracker } from './simple-conversion-tracker.service';

const SYNC_INTERVAL_HOURS = 1;
const SYNC_INTERVAL_MS = SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
const HOURS_TO_PROCESS = 24; // Process orders from last 24 hours to match attribution window

export class ConversionSyncScheduler {
  private supabaseService: SupabaseService;
  private conversionTracker: SimpleConversionTracker;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.conversionTracker = new SimpleConversionTracker();
  }

  /**
   * Start the scheduler - runs immediately and then every hour
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Conversion sync scheduler already running');
      return;
    }

    logger.info('Starting conversion sync scheduler', {
      intervalHours: SYNC_INTERVAL_HOURS,
      hoursToProcess: HOURS_TO_PROCESS,
    });

    // Run immediately on startup
    this.runSync();

    // Schedule recurring sync
    this.intervalId = setInterval(() => {
      this.runSync();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Conversion sync scheduler stopped');
    }
  }

  /**
   * Run a sync cycle for all active stores
   */
  async runSync(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Conversion sync already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled conversion sync');

      // Get all active stores
      const { data: stores, error } = await (
        this.supabaseService as any
      ).serviceClient
        .from('stores')
        .select('shop_domain, access_token')
        .not('access_token', 'is', null);

      if (error || !stores || stores.length === 0) {
        logger.warn('No active stores found for conversion sync');
        return;
      }

      const results = {
        storesProcessed: 0,
        totalOrders: 0,
        totalConversions: 0,
        errors: [] as string[],
      };

      for (const store of stores) {
        try {
          const storeResult = await this.syncStoreConversions(
            store.shop_domain,
            store.access_token
          );
          results.storesProcessed++;
          results.totalOrders += storeResult.ordersProcessed;
          results.totalConversions += storeResult.conversions;
        } catch (storeError: any) {
          results.errors.push(`${store.shop_domain}: ${storeError.message}`);
          logger.error('Error syncing store conversions', {
            shop: store.shop_domain,
            error: storeError.message,
          });
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      logger.info('Scheduled conversion sync complete', {
        ...results,
        durationSeconds: duration,
      });
    } catch (error: any) {
      logger.error('Error in scheduled conversion sync', {
        error: error.message,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync conversions for a single store
   */
  private async syncStoreConversions(
    shopDomain: string,
    accessToken: string
  ): Promise<{ ordersProcessed: number; conversions: number }> {
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - HOURS_TO_PROCESS * 60 * 60 * 1000
    );

    // Use full ISO strings for precise hour-based filtering
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    logger.info('Syncing conversions for store', {
      shop: shopDomain,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // Fetch orders from Shopify REST API
    const apiVersion = '2024-01';
    const ordersUrl = `https://${shopDomain}/admin/api/${apiVersion}/orders.json?status=any&created_at_min=${startDateStr}&created_at_max=${endDateStr}&limit=250`;

    const response = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const orders = data.orders || [];

    let ordersProcessed = 0;
    let conversions = 0;

    for (const order of orders) {
      try {
        const orderId = order.id.toString();

        // Get already-converted product IDs for this order to avoid duplicates
        const { data: existingConversions } = await (
          this.supabaseService as any
        ).serviceClient
          .from('simple_conversions')
          .select('product_id')
          .eq('order_id', orderId)
          .eq('shop_domain', shopDomain);

        const alreadyConvertedProducts = new Set(
          (existingConversions || []).map((c: any) => c.product_id)
        );

        // Build order event — exclude products that already have conversions
        const orderEvent = {
          orderId,
          shopDomain,
          customerId: order.customer?.id?.toString(),
          browserIp: order.browser_ip || order.client_details?.browser_ip,
          userAgent: order.client_details?.user_agent,
          products: (order.line_items || [])
            .map((item: any) => ({
              productId: item.product_id?.toString(),
              quantity: parseInt(item.quantity) || 1,
              price: parseFloat(item.price) || 0,
            }))
            .filter((p: any) => p.productId && !alreadyConvertedProducts.has(p.productId)),
          totalAmount: parseFloat(order.total_price) || 0,
          createdAt: new Date(order.created_at),
        };

        if (orderEvent.products.length === 0) {
          continue;
        }

        // Process for conversions
        const orderConversions =
          await this.conversionTracker.processOrderForConversions(
            orderEvent,
            false
          );

        ordersProcessed++;
        conversions += orderConversions.length;
      } catch (orderError: any) {
        logger.error('Error processing order in sync', {
          orderId: order.id,
          error: orderError.message,
        });
      }
    }

    return { ordersProcessed, conversions };
  }
}

// Singleton instance
let schedulerInstance: ConversionSyncScheduler | null = null;

export function getConversionSyncScheduler(): ConversionSyncScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new ConversionSyncScheduler();
  }
  return schedulerInstance;
}
