import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { config } from '@/utils/config';

export interface CacheOptions {
  ttl?: number; // seconds
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
  mget<T>(keys: string[]): Promise<Array<T | null>>;
  mset<T>(entries: Array<[string, T]>, options?: CacheOptions): Promise<void>;

  // Shopify-specific methods
  cacheShopData(shop: string, data: any, ttl?: number): Promise<void>;
  getShopData(shop: string): Promise<any>;
  cacheProductEmbedding(
    productId: string,
    embedding: number[],
    ttl?: number
  ): Promise<void>;
  getProductEmbedding(productId: string): Promise<number[] | null>;
  cacheShopifySession(
    shop: string,
    sessionData: any,
    ttl?: number
  ): Promise<void>;
  getShopifySession(shop: string): Promise<any>;
  invalidateShopCache(shop: string): Promise<void>;

  // Metrics
  getMetrics(): any;
}

class RedisCacheService implements CacheService {
  private redis: Redis | null = null; // Proper type safety
  private fallbackCache = new Map<string, { value: any; expires: number }>();
  private isRedisConnected = false;
  private hitCount = 0;
  private missCount = 0;
  private memoryUsage = 0;
  private maxMemorySize = 50 * 1024 * 1024; // 50MB limit for memory cache

  constructor() {
    // Skip Redis initialization if disabled
    if (!config.redis?.enabled) {
      logger.info('Redis disabled, using memory cache only');
      return;
    }

    try {
      // Use REDIS_URL if available (preferred for cloud services)
      const redisUrl = process.env.REDIS_URL;

      if (redisUrl) {
        this.redis = new Redis(redisUrl);
      } else {
        // Fallback to individual config values
        this.redis = new Redis({
          host: config.redis?.host || 'localhost',
          port: config.redis?.port || 6379,
          password: config.redis?.password,
          db: 0,
          family: 4,
          keepAlive: 30000,

          // Enhanced retry configuration for production
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: null, // Required for BullMQ compatibility
          retryDelayOnClusterDown: 300,
          enableOfflineQueue: false,

          // Connection pooling and performance
          lazyConnect: true,
          maxLoadingTimeout: 5000,
          connectTimeout: 10000,
          commandTimeout: 5000,

          // Reconnection strategy
          reconnectOnError: err => {
            const targetError = 'READONLY';
            return err.message.includes(targetError);
          },
        });
      }

      (this.redis as any).on('connect', () => {
        this.isRedisConnected = true;
        logger.info('Redis cache connected successfully');
      });

      (this.redis as any).on('ready', () => {
        logger.info('Redis ready for commands');
      });

      (this.redis as any).on('error', (error: any) => {
        this.isRedisConnected = false;
        logger.warn('Redis cache error, falling back to memory cache:', {
          error: error.message,
          code: error.code,
        });
      });

      (this.redis as any).on('close', () => {
        this.isRedisConnected = false;
        logger.warn('Redis connection closed');
      });

      // Cleanup memory cache every 5 minutes
      setInterval(() => this.cleanupMemoryCache(), 5 * 60 * 1000);

      // Log metrics every 10 minutes
      setInterval(() => this.logMetrics(), 10 * 60 * 1000);
    } catch (error) {
      logger.warn(
        'Failed to initialize Redis, using memory cache only:',
        error
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (this.isRedisConnected && this.redis) {
        const value = await (this.redis as any).get(key);
        if (value) {
          this.hitCount++;
          return JSON.parse(value);
        }
      }

      // Fallback to memory cache
      const cached = this.fallbackCache.get(key);
      if (cached && cached.expires > Date.now()) {
        this.hitCount++;
        return cached.value;
      }

      // Remove expired entry
      if (cached) {
        this.fallbackCache.delete(key);
        this.updateMemoryUsage();
      }

      this.missCount++;
      return null;
    } catch (error) {
      this.missCount++;
      logger.error('Cache get error:', { key, error: error.message });
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 3600; // Default 1 hour

    try {
      const serialized = JSON.stringify(value);

      // Set in Redis if connected
      if (this.isRedisConnected && this.redis) {
        await (this.redis as any).setex(key, ttl, serialized);
      }

      // Always set in memory cache as backup
      this.fallbackCache.set(key, {
        value,
        expires: Date.now() + ttl * 1000,
      });

      this.updateMemoryUsage();

      // Intelligent memory management
      if (this.memoryUsage > this.maxMemorySize) {
        this.evictLeastRecentlyUsed();
      }
    } catch (error) {
      logger.error('Cache set error:', { key, error: error.message });
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.isRedisConnected && this.redis) {
        await (this.redis as any).del(key);
      }
      this.fallbackCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (this.isRedisConnected && this.redis) {
        if (pattern) {
          // Use SCAN instead of KEYS for production safety
          await this.scanAndDelete(pattern);
        } else {
          await (this.redis as any).flushall();
        }
      }

      if (pattern) {
        // Clear matching keys from memory cache
        const searchPattern = pattern.replace(/\*/g, '');
        for (const key of this.fallbackCache.keys()) {
          if (key.includes(searchPattern)) {
            this.fallbackCache.delete(key);
          }
        }
      } else {
        this.fallbackCache.clear();
      }

      this.updateMemoryUsage();
    } catch (error) {
      logger.error('Cache clear error:', { pattern, error: error.message });
    }
  }

  private async scanAndDelete(pattern: string): Promise<void> {
    if (!this.redis) return;

    let cursor = '0';
    do {
      const result = await (this.redis as any).scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await (this.redis as any).del(...keys);
      }
    } while (cursor !== '0');
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      if (this.isRedisConnected && this.redis) {
        const values = await (this.redis as any).mget(...keys);
        return values.map(value => (value ? JSON.parse(value) : null));
      }

      // Fallback to memory cache
      return keys.map(key => {
        const cached = this.fallbackCache.get(key);
        if (cached && cached.expires > Date.now()) {
          return cached.value;
        }
        return null;
      });
    } catch (error) {
      logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(
    entries: Array<[string, T]>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || 3600;

      if (this.isRedisConnected && this.redis) {
        const pipeline = (this.redis as any).pipeline();
        for (const [key, value] of entries) {
          pipeline.setex(key, ttl, JSON.stringify(value));
        }
        await pipeline.exec();
      }

      // Set in memory cache
      const expiresAt = Date.now() + ttl * 1000;
      for (const [key, value] of entries) {
        this.fallbackCache.set(key, {
          value,
          expires: expiresAt,
        });
      }
    } catch (error) {
      logger.error('Cache mset error:', error);
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.fallbackCache.entries()) {
      if (cached.expires <= now) {
        this.fallbackCache.delete(key);
      }
    }
  }

  // Shopify-specific cache methods
  async cacheShopData(shop: string, data: any, ttl = 300): Promise<void> {
    await this.set(`shop:${shop}:data`, data, { ttl });
  }

  async getShopData(shop: string): Promise<any> {
    return await this.get(`shop:${shop}:data`);
  }

  async cacheProductEmbedding(
    productId: string,
    embedding: number[],
    ttl = 86400
  ): Promise<void> {
    await this.set(`embedding:product:${productId}`, embedding, { ttl });
  }

  async getProductEmbedding(productId: string): Promise<number[] | null> {
    return await this.get(`embedding:product:${productId}`);
  }

  async cacheShopifySession(
    shop: string,
    sessionData: any,
    ttl = 3600
  ): Promise<void> {
    await this.set(`session:${shop}`, sessionData, { ttl });
  }

  async getShopifySession(shop: string): Promise<any> {
    return await this.get(`session:${shop}`);
  }

  async invalidateShopCache(shop: string): Promise<void> {
    await this.clear(`*${shop}*`);
  }

  // Enhanced cache warming for popular products
  async warmCache(shopDomain: string): Promise<void> {
    try {
      // This would typically load popular/recent products from DB
      logger.info('Cache warming started for shop', { shop: shopDomain });

      // Example: Pre-load shop data
      await this.cacheShopData(
        shopDomain,
        { warmed: true, timestamp: Date.now() },
        7200
      );
    } catch (error) {
      logger.error('Cache warming failed:', { shop: shopDomain, error });
    }
  }

  // Cache tags for intelligent invalidation
  async invalidateByTag(tag: string): Promise<void> {
    const pattern = `*:tag:${tag}:*`;
    await this.clear(pattern);
  }

  // Metrics and monitoring methods
  private updateMemoryUsage(): void {
    this.memoryUsage = 0;
    for (const [key, cached] of this.fallbackCache.entries()) {
      // Rough estimation: key length + JSON stringified value length * 2 bytes per char
      const size = (key.length + JSON.stringify(cached.value).length) * 2;
      this.memoryUsage += size;
    }
  }

  private evictLeastRecentlyUsed(): void {
    // Simple LRU: remove oldest entries (this could be improved with proper LRU algorithm)
    const entriesToRemove = Math.floor(this.fallbackCache.size * 0.1); // Remove 10%
    let removed = 0;

    for (const [key] of this.fallbackCache.entries()) {
      if (removed >= entriesToRemove) break;
      this.fallbackCache.delete(key);
      removed++;
    }

    this.updateMemoryUsage();
    logger.info('Cache LRU eviction completed', {
      removed,
      newSize: this.fallbackCache.size,
    });
  }

  private logMetrics(): void {
    const totalRequests = this.hitCount + this.missCount;
    const hitRatio =
      totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    logger.info('Cache metrics', {
      hitRatio: `${hitRatio.toFixed(2)}%`,
      hits: this.hitCount,
      misses: this.missCount,
      totalRequests,
      memoryUsage: `${(this.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      memoryCacheSize: this.fallbackCache.size,
      redisConnected: this.isRedisConnected,
    });
  }

  getMetrics() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRatio = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      hitRatio,
      hits: this.hitCount,
      misses: this.missCount,
      totalRequests,
      memoryUsage: this.memoryUsage,
      memoryCacheSize: this.fallbackCache.size,
      redisConnected: this.isRedisConnected,
    };
  }
}

// Singleton instance
export const cacheService = new RedisCacheService();
