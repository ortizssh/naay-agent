import { logger } from '@/utils/logger';
import { config } from '@/utils/config';
import Redis from 'ioredis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

export class CacheService {
  private redis: any | null = null;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private useRedis: boolean = false;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    if (config.redis.enabled && config.redis.url) {
      try {
        this.redis = new Redis(config.redis.url);
        this.useRedis = true;
        
        this.redis.on('error', (err: any) => {
          logger.error('Redis connection error:', err);
          this.useRedis = false;
        });

        this.redis.on('connect', () => {
          logger.info('Connected to Redis');
          this.useRedis = true;
        });
      } catch (error) {
        logger.error('Failed to initialize Redis:', error);
        this.useRedis = false;
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          this.hits++;
          return JSON.parse(value);
        } else {
          this.misses++;
          return null;
        }
      } else {
        const item = this.memoryCache.get(key);
        if (!item) {
          this.misses++;
          return null;
        }
        
        if (item.expires < Date.now()) {
          this.memoryCache.delete(key);
          this.misses++;
          return null;
        }
        
        this.hits++;
        return item.value;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || 3600; // Default 1 hour

      if (this.useRedis && this.redis) {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
      } else {
        this.memoryCache.set(key, {
          value,
          expires: Date.now() + ttl * 1000
        });
        
        // Cleanup memory cache if it gets too big
        if (this.memoryCache.size > 1000) {
          this.cleanupMemoryCache();
        }
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async flush(): Promise<void> {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.flushall();
      } else {
        this.memoryCache.clear();
      }
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  // Helper to wrap async functions with caching
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, options);
    return result;
  }

  // Get cache metrics
  getMetrics() {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      redisConnected: this.useRedis && this.redis !== null,
      memoryCacheSize: this.memoryCache.size,
      redisStatus: this.useRedis ? 'connected' : 'disconnected',
      hitRatio,
      hits: this.hits,
      misses: this.misses,
      totalRequests
    };
  }

  // Get Shopify session from cache
  async getShopifySession(shop: string): Promise<any> {
    return await this.get(`shopify_session:${shop}`);
  }

  // Cache Shopify session
  async cacheShopifySession(shop: string, sessionData: any, ttl: number = 3600): Promise<void> {
    await this.set(`shopify_session:${shop}`, sessionData, { ttl });
  }

  // Invalidate shop cache
  async invalidateShopCache(shop: string): Promise<void> {
    const keysToDelete = [
      `shopify_session:${shop}`,
      `shop_data:${shop}`,
      `shop_config:${shop}`
    ];
    
    for (const key of keysToDelete) {
      await this.del(key);
    }
  }

  // Clear cache with pattern support
  async clear(pattern: string): Promise<void> {
    try {
      if (this.useRedis && this.redis) {
        // For Redis, use SCAN with pattern
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        // For memory cache, filter by pattern
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keysToDelete = Array.from(this.memoryCache.keys()).filter(key => regex.test(key));
        for (const key of keysToDelete) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      logger.error(`Cache clear error for pattern ${pattern}:`, error);
    }
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expires < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();