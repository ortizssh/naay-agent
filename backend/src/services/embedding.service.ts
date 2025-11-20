import OpenAI from 'openai';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import { cacheService } from './cache.service';

export class EmbeddingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Clean and prepare text
      const cleanText = this.cleanText(text);

      if (!cleanText.trim()) {
        throw new AppError('Empty text provided for embedding', 400);
      }

      const cacheKey = `embedding:${Buffer.from(cleanText).toString('base64')}`;

      // Try to get from cache first
      const cached = await cacheService.get<number[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Generate embedding using OpenAI
      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: cleanText,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError('No embedding generated', 500);
      }

      const embedding = response.data[0].embedding;

      // Cache the result for 24 hours
      await cacheService.set(cacheKey, embedding, { ttl: 24 * 60 * 60 });

      logger.debug(
        `Generated embedding for text: "${cleanText.substring(0, 50)}..."`,
        {
          textLength: cleanText.length,
          embeddingDimension: embedding.length,
        }
      );

      return embedding;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Error generating embedding:', error);
      throw new AppError(`Failed to generate embedding: ${error.message}`, 500);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (texts.length === 0) {
        return [];
      }

      // Clean all texts
      const cleanTexts = texts
        .map(text => this.cleanText(text))
        .filter(text => text.trim());

      if (cleanTexts.length === 0) {
        return [];
      }

      // OpenAI API supports batch embedding generation
      const response = await this.openai.embeddings.create({
        model: config.openai.embeddingModel,
        input: cleanTexts,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length !== cleanTexts.length) {
        throw new AppError('Incomplete batch embedding generation', 500);
      }

      const embeddings = response.data.map(item => item.embedding);

      logger.debug(`Generated ${embeddings.length} embeddings in batch`);

      return embeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw new AppError(
        `Failed to generate batch embeddings: ${error.message}`,
        500
      );
    }
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return (
      text
        // Remove HTML tags
        .replace(/<[^>]*>/g, ' ')
        // Remove extra whitespace and newlines
        .replace(/\s+/g, ' ')
        // Remove special characters but keep basic punctuation
        .replace(/[^\w\s.,!?-]/g, ' ')
        // Trim and limit length (OpenAI has token limits)
        .trim()
        .substring(0, 8000)
    ); // Rough character limit to stay under token limits
  }

  async searchSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: number[][]
  ): Promise<Array<{ index: number; similarity: number }>> {
    const similarities = candidateEmbeddings.map((embedding, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .filter(item => item.similarity > 0.7); // Filter out low similarity results
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Utility method to prepare product content for embedding
  prepareProductContent(product: any): string {
    const parts = [
      product.title,
      product.description,
      product.vendor,
      product.product_type,
      ...(product.tags || []),
    ].filter(Boolean);

    return parts.join(' ');
  }

  prepareVariantContent(product: any, variant: any): string {
    const parts = [
      product.title,
      variant.title !== 'Default Title' ? variant.title : '',
      product.description,
      product.vendor,
      product.product_type,
      `Price: ${variant.price}`,
      variant.sku ? `SKU: ${variant.sku}` : '',
      ...(product.tags || []),
    ].filter(Boolean);

    return parts.join(' ');
  }
}
