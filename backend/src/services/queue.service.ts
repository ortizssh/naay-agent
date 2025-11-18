import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { ShopifyService } from './shopify.service';
import { SupabaseService } from './supabase.service';
import { EmbeddingService } from './embedding.service';

const redis = new IORedis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

// Queue definitions
export const syncQueue = new Queue('product-sync', { 
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    }
  }
});

export const embeddingQueue = new Queue('embeddings', { 
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    }
  }
});

// Job data interfaces
interface SyncJobData {
  shop: string;
  accessToken: string;
  type: 'full_sync' | 'product_update' | 'product_create' | 'product_delete';
  productId?: string;
}

interface EmbeddingJobData {
  shop: string;
  productId: string;
  variantId?: string;
  content: string;
  metadata: Record<string, any>;
}

export class QueueService {
  private shopifyService: ShopifyService;
  private supabaseService: SupabaseService;
  private embeddingService: EmbeddingService;

  constructor() {
    this.shopifyService = new ShopifyService();
    this.supabaseService = new SupabaseService();
    this.embeddingService = new EmbeddingService();
    
    this.setupWorkers();
  }

  // Add jobs to queues
  async addFullSyncJob(shop: string, accessToken: string) {
    return syncQueue.add('full-sync', {
      shop,
      accessToken,
      type: 'full_sync'
    }, {
      priority: 10, // High priority for initial sync
      delay: 2000   // Small delay to ensure installation is complete
    });
  }

  async addProductSyncJob(shop: string, accessToken: string, productId: string, type: 'product_update' | 'product_create') {
    return syncQueue.add(`product-${type}`, {
      shop,
      accessToken,
      type,
      productId
    });
  }

  async addProductDeleteJob(shop: string, productId: string) {
    return syncQueue.add('product-delete', {
      shop,
      accessToken: '', // Not needed for delete
      type: 'product_delete',
      productId
    });
  }

  async addEmbeddingJob(shop: string, productId: string, content: string, metadata: Record<string, any>, variantId?: string) {
    return embeddingQueue.add('generate-embedding', {
      shop,
      productId,
      variantId,
      content,
      metadata
    });
  }

  // Setup workers
  private setupWorkers() {
    // Product sync worker
    const syncWorker = new Worker('product-sync', async (job: Job<SyncJobData>) => {
      const { shop, accessToken, type, productId } = job.data;
      
      logger.info(`Processing ${type} job for shop: ${shop}`, { jobId: job.id });

      try {
        switch (type) {
          case 'full_sync':
            await this.processFullSync(shop, accessToken, job);
            break;
          case 'product_create':
          case 'product_update':
            await this.processProductSync(shop, accessToken, productId!, job);
            break;
          case 'product_delete':
            await this.processProductDelete(shop, productId!);
            break;
        }

        logger.info(`Completed ${type} job for shop: ${shop}`, { jobId: job.id });
      } catch (error) {
        logger.error(`Failed ${type} job for shop: ${shop}`, { 
          jobId: job.id, 
          error: error.message 
        });
        throw error;
      }
    }, { 
      connection: redis,
      concurrency: 2 // Process 2 sync jobs simultaneously
    });

    // Embedding worker
    const embeddingWorker = new Worker('embeddings', async (job: Job<EmbeddingJobData>) => {
      const { shop, productId, variantId, content, metadata } = job.data;
      
      logger.info(`Generating embedding for product: ${productId}`, { jobId: job.id });

      try {
        const embedding = await this.embeddingService.generateEmbedding(content);
        
        await this.supabaseService.saveEmbedding({
          shop_domain: shop,
          product_id: productId,
          variant_id: variantId,
          embedding,
          content,
          metadata
        });

        logger.info(`Generated embedding for product: ${productId}`, { jobId: job.id });
      } catch (error) {
        logger.error(`Failed to generate embedding for product: ${productId}`, { 
          jobId: job.id, 
          error: error.message 
        });
        throw error;
      }
    }, { 
      connection: redis,
      concurrency: 5 // Process 5 embedding jobs simultaneously
    });

    // Error handlers
    syncWorker.on('failed', (job, err) => {
      logger.error(`Sync job ${job?.id} failed:`, err);
    });

    embeddingWorker.on('failed', (job, err) => {
      logger.error(`Embedding job ${job?.id} failed:`, err);
    });

    logger.info('Queue workers started successfully');
  }

  private async processFullSync(shop: string, accessToken: string, job: Job) {
    logger.info(`Starting full sync for shop: ${shop}`);

    // Update job progress
    await job.updateProgress(10);

    // Fetch all products from Shopify
    const products = await this.shopifyService.getAllProducts(shop, accessToken);
    
    await job.updateProgress(50);

    // Save products to Supabase
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Save product and variants
      await this.supabaseService.saveProduct(shop, product);
      
      // Queue embedding generation for product
      const content = `${product.title} ${product.description} ${product.vendor} ${product.tags.join(' ')}`.trim();
      await this.addEmbeddingJob(shop, product.id, content, {
        title: product.title,
        description: product.description,
        vendor: product.vendor,
        tags: product.tags,
        price: product.variants[0]?.price || '0'
      });

      // Queue embeddings for variants (if they have unique content)
      for (const variant of product.variants) {
        if (variant.title !== 'Default Title' && variant.title !== product.title) {
          const variantContent = `${product.title} ${variant.title} ${product.description}`.trim();
          await this.addEmbeddingJob(shop, product.id, variantContent, {
            title: product.title,
            variant_title: variant.title,
            description: product.description,
            vendor: product.vendor,
            tags: product.tags,
            price: variant.price
          }, variant.id);
        }
      }

      // Update progress
      const progress = 50 + (i / products.length) * 50;
      await job.updateProgress(progress);
    }

    logger.info(`Completed full sync for shop: ${shop}. Synced ${products.length} products`);
  }

  private async processProductSync(shop: string, accessToken: string, productId: string, job: Job) {
    // Fetch single product from Shopify
    const product = await this.shopifyService.getProduct(shop, accessToken, productId);
    
    if (!product) {
      logger.warn(`Product ${productId} not found in Shopify, may have been deleted`);
      return;
    }

    // Save product to Supabase
    await this.supabaseService.saveProduct(shop, product);

    // Delete old embeddings
    await this.supabaseService.deleteProductEmbeddings(shop, productId);

    // Generate new embeddings
    const content = `${product.title} ${product.description} ${product.vendor} ${product.tags.join(' ')}`.trim();
    await this.addEmbeddingJob(shop, product.id, content, {
      title: product.title,
      description: product.description,
      vendor: product.vendor,
      tags: product.tags,
      price: product.variants[0]?.price || '0'
    });

    logger.info(`Updated product ${productId} for shop: ${shop}`);
  }

  private async processProductDelete(shop: string, productId: string) {
    await this.supabaseService.deleteProduct(shop, productId);
    logger.info(`Deleted product ${productId} for shop: ${shop}`);
  }

  // Queue monitoring methods
  async getQueueStats() {
    const [syncStats, embeddingStats] = await Promise.all([
      syncQueue.getJobCounts(),
      embeddingQueue.getJobCounts()
    ]);

    return {
      sync: syncStats,
      embeddings: embeddingStats
    };
  }

  async getActiveJobs() {
    const [syncJobs, embeddingJobs] = await Promise.all([
      syncQueue.getActive(),
      embeddingQueue.getActive()
    ]);

    return {
      sync: syncJobs.map(job => ({
        id: job.id,
        data: job.data,
        progress: job.progress
      })),
      embeddings: embeddingJobs.map(job => ({
        id: job.id,
        data: job.data,
        progress: job.progress
      }))
    };
  }
}