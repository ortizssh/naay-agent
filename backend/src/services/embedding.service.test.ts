import { EmbeddingService } from './embedding.service';
import { AppError, EmbeddingError } from '@/types';

// Mock dependencies
jest.mock('./cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

const mockOpenAI = {
  embeddings: {
    create: jest.fn()
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

jest.mock('@/utils/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
      embeddingModel: 'text-embedding-3-small'
    }
  }
}));

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockCacheService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingService = new EmbeddingService();
    mockCacheService = require('./cache.service').cacheService;
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const testText = 'Nike Air Jordan sneakers';
      const expectedEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: expectedEmbedding }]
      });

      const result = await embeddingService.generateEmbedding(testText);

      expect(result).toEqual(expectedEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: testText,
        encoding_format: 'float'
      });
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return cached embedding when available', async () => {
      const testText = 'Cached product description';
      const cachedEmbedding = [0.5, 0.4, 0.3, 0.2, 0.1];

      mockCacheService.get.mockResolvedValue(cachedEmbedding);

      const result = await embeddingService.generateEmbedding(testText);

      expect(result).toEqual(cachedEmbedding);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should clean text before generating embedding', async () => {
      const dirtyText = '<p>Nike <script>alert("xss")</script> sneakers</p>\n\n  with   extra   spaces  ';
      const expectedCleanText = 'Nike sneakers with extra spaces';
      const expectedEmbedding = [0.1, 0.2, 0.3];

      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: expectedEmbedding }]
      });

      await embeddingService.generateEmbedding(dirtyText);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expectedCleanText
        })
      );
    });

    it('should throw EmbeddingError for empty text', async () => {
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(AppError);
      await expect(embeddingService.generateEmbedding('   ')).rejects.toThrow(AppError);
    });

    it('should handle OpenAI API errors', async () => {
      const testText = 'Test text';
      mockCacheService.get.mockResolvedValue(null);
      
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbedding(testText)).rejects.toThrow(AppError);
    });

    it('should handle empty embedding response', async () => {
      const testText = 'Test text';
      mockCacheService.get.mockResolvedValue(null);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: []
      });

      await expect(embeddingService.generateEmbedding(testText)).rejects.toThrow(AppError);
    });

    it('should limit text length to prevent token overflow', async () => {
      const longText = 'word '.repeat(10000); // Very long text
      const expectedEmbedding = [0.1, 0.2];

      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: expectedEmbedding }]
      });

      await embeddingService.generateEmbedding(longText);

      // Check that text was truncated to 8000 characters
      const callArgs = mockOpenAI.embeddings.create.mock.calls[0][0];
      expect(callArgs.input.length).toBeLessThanOrEqual(8000);
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Nike shoes', 'Adidas sneakers', 'Running gear'];
      const expectedEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9]
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: expectedEmbeddings.map(embedding => ({ embedding }))
      });

      const result = await embeddingService.generateBatchEmbeddings(texts);

      expect(result).toEqual(expectedEmbeddings);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float'
      });
    });

    it('should handle empty array input', async () => {
      const result = await embeddingService.generateBatchEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });

    it('should filter out empty texts', async () => {
      const texts = ['Valid text', '', '   ', 'Another valid text'];
      const expectedCleanTexts = ['Valid text', 'Another valid text'];
      const expectedEmbeddings = [[0.1, 0.2], [0.3, 0.4]];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: expectedEmbeddings.map(embedding => ({ embedding }))
      });

      const result = await embeddingService.generateBatchEmbeddings(texts);

      expect(result).toEqual(expectedEmbeddings);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expectedCleanTexts
        })
      );
    });

    it('should throw error when response length mismatch', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }] // Only 1 embedding for 3 texts
      });

      await expect(embeddingService.generateBatchEmbeddings(texts)).rejects.toThrow(AppError);
    });
  });

  describe('searchSimilar', () => {
    it('should find similar embeddings above threshold', async () => {
      const queryEmbedding = [1, 0, 0]; // Normalized vector
      const candidateEmbeddings = [
        [1, 0, 0],     // Perfect match (similarity = 1)
        [0.9, 0.436, 0], // High similarity (~0.9)
        [0, 1, 0],     // Low similarity (0)
        [0.8, 0.6, 0]  // Medium similarity (~0.8)
      ];

      const result = await embeddingService.searchSimilar(queryEmbedding, candidateEmbeddings);

      // Should return results above 0.7 threshold, sorted by similarity
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].similarity).toBeGreaterThanOrEqual(result[1]?.similarity || 0);
      
      // All results should be above threshold
      result.forEach(item => {
        expect(item.similarity).toBeGreaterThan(0.7);
      });
    });

    it('should handle empty candidate list', async () => {
      const queryEmbedding = [1, 0, 0];
      const candidateEmbeddings: number[][] = [];

      const result = await embeddingService.searchSimilar(queryEmbedding, candidateEmbeddings);
      expect(result).toEqual([]);
    });

    it('should handle dimension mismatch error', async () => {
      const queryEmbedding = [1, 0, 0]; // 3 dimensions
      const candidateEmbeddings = [
        [1, 0] // 2 dimensions - mismatch
      ];

      await expect(
        embeddingService.searchSimilar(queryEmbedding, candidateEmbeddings)
      ).rejects.toThrow('Vector dimensions must match');
    });
  });

  describe('Product Content Preparation', () => {
    it('should prepare product content for embedding', async () => {
      const product = {
        title: 'Nike Air Max',
        description: 'Comfortable running shoes',
        vendor: 'Nike',
        product_type: 'Footwear',
        tags: ['running', 'sports', 'comfortable']
      };

      const result = embeddingService.prepareProductContent(product);

      expect(result).toBe('Nike Air Max Comfortable running shoes Nike Footwear running sports comfortable');
    });

    it('should prepare variant content for embedding', async () => {
      const product = {
        title: 'Nike Air Max',
        description: 'Comfortable running shoes',
        vendor: 'Nike',
        product_type: 'Footwear',
        tags: ['running', 'sports']
      };

      const variant = {
        title: 'Size 10',
        price: '129.99',
        sku: 'NIKE-AM-10'
      };

      const result = embeddingService.prepareVariantContent(product, variant);

      expect(result).toContain('Nike Air Max');
      expect(result).toContain('Size 10');
      expect(result).toContain('Price: 129.99');
      expect(result).toContain('SKU: NIKE-AM-10');
      expect(result).toContain('running sports');
    });

    it('should handle default variant title', async () => {
      const product = {
        title: 'Simple Product',
        description: 'Basic product',
        vendor: 'Test',
        product_type: 'General',
        tags: []
      };

      const variant = {
        title: 'Default Title',
        price: '10.00',
        sku: ''
      };

      const result = embeddingService.prepareVariantContent(product, variant);

      expect(result).not.toContain('Default Title');
      expect(result).toContain('Price: 10.00');
      expect(result).not.toContain('SKU:');
    });

    it('should handle missing optional fields', async () => {
      const product = {
        title: 'Basic Product',
        description: null,
        vendor: '',
        product_type: '',
        tags: undefined
      };

      const result = embeddingService.prepareProductContent(product);

      expect(result).toBe('Basic Product');
    });
  });

  describe('Cosine Similarity Calculation', () => {
    it('should calculate correct cosine similarity', async () => {
      const embeddingService = new EmbeddingService();
      
      // Access private method for testing
      const cosineSimilarity = (embeddingService as any).cosineSimilarity;

      // Test identical vectors
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);

      // Test orthogonal vectors
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);

      // Test opposite vectors
      expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1, 5);

      // Test zero vectors
      expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
      expect(cosineSimilarity([1, 0, 0], [0, 0, 0])).toBe(0);
    });
  });
});