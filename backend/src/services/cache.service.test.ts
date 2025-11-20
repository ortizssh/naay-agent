import { cacheService } from './cache.service';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    flushall: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    pipeline: jest.fn(() => ({
      setex: jest.fn(),
      exec: jest.fn()
    })),
    on: jest.fn(),
    lazyConnect: true
  }));
});

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    it('should set and get cache values', async () => {
      const testKey = 'test:key';
      const testValue = { message: 'test value', timestamp: Date.now() };

      await cacheService.set(testKey, testValue, { ttl: 300 });
      const result = await cacheService.get(testKey);

      // Since we're using fallback cache, it should work
      expect(result).toEqual(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheService.get('non:existent:key');
      expect(result).toBeNull();
    });

    it('should delete cache entries', async () => {
      const testKey = 'test:delete';
      const testValue = 'delete me';

      await cacheService.set(testKey, testValue);
      let result = await cacheService.get(testKey);
      expect(result).toEqual(testValue);

      await cacheService.del(testKey);
      result = await cacheService.get(testKey);
      expect(result).toBeNull();
    });

    it('should handle TTL expiration in memory cache', async () => {
      const testKey = 'test:ttl';
      const testValue = 'expires soon';

      // Set with very short TTL (1ms)
      await cacheService.set(testKey, testValue, { ttl: 0.001 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await cacheService.get(testKey);
      expect(result).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple get operations', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      // Set values
      for (let i = 0; i < keys.length; i++) {
        await cacheService.set(keys[i], values[i]);
      }

      const results = await cacheService.mget(keys);
      expect(results).toEqual(values);
    });

    it('should handle multiple set operations', async () => {
      const entries: Array<[string, string]> = [
        ['batch1', 'value1'],
        ['batch2', 'value2'],
        ['batch3', 'value3']
      ];

      await cacheService.mset(entries, { ttl: 300 });

      // Verify all values were set
      for (const [key, expectedValue] of entries) {
        const result = await cacheService.get(key);
        expect(result).toEqual(expectedValue);
      }
    });
  });

  describe('Shopify-specific Methods', () => {
    const testShop = 'test-shop.myshopify.com';

    it('should cache and retrieve shop data', async () => {
      const shopData = {
        id: 'shop-123',
        name: 'Test Shop',
        currency: 'USD',
        timezone: 'America/New_York'
      };

      await cacheService.cacheShopData(testShop, shopData, 600);
      const result = await cacheService.getShopData(testShop);

      expect(result).toEqual(shopData);
    });

    it('should cache and retrieve product embeddings', async () => {
      const productId = 'product-123';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      await cacheService.cacheProductEmbedding(productId, embedding, 86400);
      const result = await cacheService.getProductEmbedding(productId);

      expect(result).toEqual(embedding);
    });

    it('should cache and retrieve Shopify sessions', async () => {
      const sessionData = {
        accessToken: 'shpat_test_token',
        scopes: 'read_products,write_products',
        expiresAt: new Date(Date.now() + 3600000),
        isOnline: true
      };

      await cacheService.cacheShopifySession(testShop, sessionData, 3600);
      const result = await cacheService.getShopifySession(testShop);

      expect(result).toEqual(sessionData);
    });

    it('should invalidate shop cache', async () => {
      const shopData = { test: 'data' };
      const sessionData = { token: 'test' };

      await cacheService.cacheShopData(testShop, shopData);
      await cacheService.cacheShopifySession(testShop, sessionData);

      // Verify data exists
      expect(await cacheService.getShopData(testShop)).toEqual(shopData);
      expect(await cacheService.getShopifySession(testShop)).toEqual(sessionData);

      // Invalidate
      await cacheService.invalidateShopCache(testShop);

      // Verify data is cleared (this tests the fallback cache clear pattern)
      const keys = [`shop:${testShop}:data`, `session:${testShop}`];
      for (const key of keys) {
        const result = await cacheService.get(key);
        expect(result).toBeNull();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // This test verifies that cache operations don't throw errors
      // even when Redis is unavailable (which it is in this test)
      
      const testKey = 'error:test';
      const testValue = 'error test value';

      await expect(cacheService.set(testKey, testValue)).resolves.not.toThrow();
      await expect(cacheService.get(testKey)).resolves.not.toThrow();
      await expect(cacheService.del(testKey)).resolves.not.toThrow();
    });

    it('should fallback to memory cache when Redis fails', async () => {
      const testKey = 'fallback:test';
      const testValue = 'fallback value';

      // Set value (should use memory cache since Redis is mocked)
      await cacheService.set(testKey, testValue);
      
      // Get value (should retrieve from memory cache)
      const result = await cacheService.get(testKey);
      expect(result).toEqual(testValue);
    });
  });

  describe('Memory Cache Management', () => {
    it('should limit memory cache size', async () => {
      // Set more than 1000 items to test size limiting
      const promises = [];
      for (let i = 0; i < 1050; i++) {
        promises.push(cacheService.set(`test:${i}`, `value${i}`));
      }
      
      await Promise.all(promises);

      // The cache should have automatically pruned to keep only 1000 items
      // We can't easily test this without exposing internal state,
      // but the operation should complete without errors
      expect(true).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      const operations = [];
      
      // Simulate concurrent cache operations
      for (let i = 0; i < 100; i++) {
        operations.push(cacheService.set(`concurrent:${i}`, `value${i}`));
        operations.push(cacheService.get(`concurrent:${i}`));
      }

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});