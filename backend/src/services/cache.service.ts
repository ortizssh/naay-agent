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
  cacheProductEmbedding(productId: string, embedding: number[], ttl?: number): Promise<void>;
  getProductEmbedding(productId: string): Promise<number[] | null>;
  cacheShopifySession(shop: string, sessionData: any, ttl?: number): Promise<void>;
  getShopifySession(shop: string): Promise<any>;
  invalidateShopCache(shop: string): Promise<void>;
}

class RedisCacheService implements CacheService {
  private redis: any; // Using any to avoid ioredis type issues
  private fallbackCache = new Map<string, { value: any; expires: number }>();
  private isRedisConnected = false;

  constructor() {
    // Skip Redis initialization if disabled
    if (!config.redis?.enabled) {
      logger.info('Redis disabled, using memory cache only');
      return;
    }

    try {
      this.redis = new Redis({
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        logger.info('Redis cache connected successfully');
      });

      this.redis.on('error', (error) => {
        this.isRedisConnected = false;
        logger.warn('Redis cache error, falling back to memory cache:', error.message);
      });

      // Cleanup memory cache periodically
      setInterval(() => this.cleanupMemoryCache(), 60 * 1000); // Every minute
    } catch (error) {
      logger.warn('Failed to initialize Redis, using memory cache only:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisConnected) {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      }

      // Fallback to memory cache
      const cached = this.fallbackCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }

      // Remove expired entry
      if (cached) {
        this.fallbackCache.delete(key);
      }

      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 3600; // Default 1 hour

    try {
      const serialized = JSON.stringify(value);

      if (this.isRedisConnected) {
        await this.redis.setex(key, ttl, serialized);
      }

      // Always set in memory cache as backup
      this.fallbackCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });

      // Limit memory cache size
      if (this.fallbackCache.size > 1000) {
        const firstKey = this.fallbackCache.keys().next().value;
        this.fallbackCache.delete(firstKey);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.isRedisConnected) {
        await this.redis.del(key);
      }
      this.fallbackCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (this.isRedisConnected) {
        if (pattern) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          await this.redis.flushall();
        }
      }

      if (pattern) {
        // Clear matching keys from memory cache
        for (const key of this.fallbackCache.keys()) {
          if (key.includes(pattern.replace('*', ''))) {
            this.fallbackCache.delete(key);
          }
        }
      } else {
        this.fallbackCache.clear();
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      if (this.isRedisConnected) {
        const values = await this.redis.mget(...keys);
        return values.map(value => value ? JSON.parse(value) : null);
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

  async mset<T>(entries: Array<[string, T]>, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || 3600;

      if (this.isRedisConnected) {
        const pipeline = this.redis.pipeline();
        for (const [key, value] of entries) {
          pipeline.setex(key, ttl, JSON.stringify(value));
        }
        await pipeline.exec();
      }

      // Set in memory cache
      const expiresAt = Date.now() + (ttl * 1000);
      for (const [key, value] of entries) {
        this.fallbackCache.set(key, {
          value,
          expires: expiresAt
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

  async cacheProductEmbedding(productId: string, embedding: number[], ttl = 86400): Promise<void> {
    await this.set(`embedding:product:${productId}`, embedding, { ttl });
  }

  async getProductEmbedding(productId: string): Promise<number[] | null> {
    return await this.get(`embedding:product:${productId}`);
  }

  async cacheShopifySession(shop: string, sessionData: any, ttl = 3600): Promise<void> {
    await this.set(`session:${shop}`, sessionData, { ttl });
  }

  async getShopifySession(shop: string): Promise<any> {
    return await this.get(`session:${shop}`);
  }

  async invalidateShopCache(shop: string): Promise<void> {
    await this.clear(`*${shop}*`);
  }
}

// Singleton instance
export const cacheService = new RedisCacheService();