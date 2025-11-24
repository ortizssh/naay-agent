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
        return value ? JSON.parse(value) : null;
      } else {
        const item = this.memoryCache.get(key);
        if (!item) return null;
        
        if (item.expires < Date.now()) {
          this.memoryCache.delete(key);
          return null;
        }
        
        return item.value;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
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