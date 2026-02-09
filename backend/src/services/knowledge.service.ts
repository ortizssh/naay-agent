import { logger } from '@/utils/logger';
import { SupabaseService } from '@/services/supabase.service';
import { EmbeddingService } from '@/services/embedding.service';
import { cacheService } from '@/services/cache.service';
import { KnowledgeDocument } from '@/types';
import crypto from 'crypto';

const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();

const BATCH_SIZE = 20; // Embeddings per batch call
const MAX_CHUNK_TOKENS = 500;
const CHUNK_OVERLAP = 50;
const KNOWLEDGE_CACHE_TTL = 300; // 5 minutes

export class KnowledgeService {
  /**
   * Create a new knowledge document and start async processing
   */
  async createDocument(
    shopDomain: string,
    params: { title: string; content: string; sourceType: 'text' | 'file' | 'url'; originalFilename?: string }
  ): Promise<KnowledgeDocument> {
    const contentHash = crypto.createHash('sha256').update(params.content).digest('hex');

    const { data, error } = await (supabaseService as any).serviceClient
      .from('knowledge_documents')
      .insert({
        shop_domain: shopDomain,
        title: params.title,
        content: params.content,
        source_type: params.sourceType,
        original_filename: params.originalFilename || null,
        content_hash: contentHash,
        embedding_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating knowledge document:', error);
      throw new Error('Failed to create document');
    }

    // Process document async (chunking + embeddings)
    this.processDocument(data.id).catch(err => {
      logger.error('Background document processing failed:', { documentId: data.id, error: err.message });
    });

    return data;
  }

  /**
   * Process document: chunk text, generate embeddings, insert chunks
   */
  async processDocument(documentId: string): Promise<void> {
    try {
      // Mark as processing
      await (supabaseService as any).serviceClient
        .from('knowledge_documents')
        .update({ embedding_status: 'processing' })
        .eq('id', documentId);

      // Fetch document
      const { data: doc, error } = await (supabaseService as any).serviceClient
        .from('knowledge_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        throw new Error('Document not found');
      }

      // Chunk the text
      const chunks = this.chunkText(doc.content, MAX_CHUNK_TOKENS, CHUNK_OVERLAP);

      if (chunks.length === 0) {
        await (supabaseService as any).serviceClient
          .from('knowledge_documents')
          .update({ embedding_status: 'failed', error_message: 'No content to process' })
          .eq('id', documentId);
        return;
      }

      // Generate embeddings in batches
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddings = await embeddingService.generateBatchEmbeddings(batch);
        allEmbeddings.push(...embeddings);
      }

      // Insert chunks with embeddings
      const chunkRows = chunks.map((content, index) => ({
        document_id: documentId,
        shop_domain: doc.shop_domain,
        chunk_index: index,
        content,
        token_count: Math.ceil(content.length / 4),
        embedding: JSON.stringify(allEmbeddings[index]),
        metadata: { document_title: doc.title, source_type: doc.source_type },
      }));

      const { error: insertError } = await (supabaseService as any).serviceClient
        .from('knowledge_chunks')
        .insert(chunkRows);

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }

      // Update document status
      await (supabaseService as any).serviceClient
        .from('knowledge_documents')
        .update({
          embedding_status: 'completed',
          chunk_count: chunks.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      logger.info('Knowledge document processed successfully', {
        documentId,
        chunks: chunks.length,
        shopDomain: doc.shop_domain,
      });
    } catch (err: any) {
      logger.error('Error processing knowledge document:', { documentId, error: err.message });
      await (supabaseService as any).serviceClient
        .from('knowledge_documents')
        .update({ embedding_status: 'failed', error_message: err.message })
        .eq('id', documentId);
    }
  }

  /**
   * Split text into chunks by paragraphs, then sentences if needed
   */
  chunkText(text: string, maxTokens: number = MAX_CHUNK_TOKENS, overlap: number = CHUNK_OVERLAP): string[] {
    if (!text || !text.trim()) return [];

    const maxChars = maxTokens * 4; // ~4 chars per token approximation
    const overlapChars = overlap * 4;

    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();

      if ((current + ' ' + trimmed).length <= maxChars) {
        current = current ? current + '\n\n' + trimmed : trimmed;
      } else {
        if (current) {
          chunks.push(current.trim());
        }

        // If single paragraph exceeds max, split by sentences
        if (trimmed.length > maxChars) {
          const sentences = trimmed.split(/(?<=[.!?])\s+/);
          current = '';
          for (const sentence of sentences) {
            if ((current + ' ' + sentence).length <= maxChars) {
              current = current ? current + ' ' + sentence : sentence;
            } else {
              if (current) chunks.push(current.trim());
              current = sentence;
            }
          }
        } else {
          current = trimmed;
        }
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    // Add overlap between chunks
    if (overlap > 0 && chunks.length > 1) {
      const overlapped: string[] = [chunks[0]];
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.slice(-overlapChars);
        overlapped.push(overlapText + ' ' + chunks[i]);
      }
      return overlapped;
    }

    return chunks;
  }

  /**
   * Search knowledge base using semantic similarity
   */
  async searchKnowledge(shopDomain: string, query: string, limit: number = 5): Promise<Array<{
    chunk_id: string;
    document_id: string;
    document_title: string;
    content: string;
    similarity: number;
  }>> {
    const cacheKey = `knowledge:search:${shopDomain}:${Buffer.from(query).toString('base64').slice(0, 40)}`;
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Call RPC function - pass embedding as string for vector type casting
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const { data, error } = await (supabaseService as any).serviceClient
        .rpc('search_knowledge_semantic', {
          p_shop_domain: shopDomain,
          p_query_embedding: embeddingStr,
          p_match_threshold: 0.3,
          p_match_count: limit,
        });

      if (error) {
        logger.error('Knowledge semantic search error:', error);
        return [];
      }

      const results = data || [];
      await cacheService.set(cacheKey, results, { ttl: KNOWLEDGE_CACHE_TTL });
      return results;
    } catch (err) {
      logger.error('Error searching knowledge:', err);
      return [];
    }
  }

  /**
   * List all documents for a tenant
   */
  async listDocuments(shopDomain: string): Promise<KnowledgeDocument[]> {
    const { data, error } = await (supabaseService as any).serviceClient
      .from('knowledge_documents')
      .select('id, shop_domain, title, source_type, original_filename, content_hash, chunk_count, embedding_status, error_message, created_at, updated_at')
      .eq('shop_domain', shopDomain)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error listing knowledge documents:', error);
      throw new Error('Failed to list documents');
    }

    return data || [];
  }

  /**
   * Get a single document by ID (with ownership check)
   */
  async getDocument(documentId: string, shopDomain: string): Promise<KnowledgeDocument | null> {
    const { data, error } = await (supabaseService as any).serviceClient
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .eq('shop_domain', shopDomain)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Error getting knowledge document:', error);
      throw new Error('Failed to get document');
    }

    return data;
  }

  /**
   * Delete a document and its chunks (cascade)
   */
  async deleteDocument(documentId: string, shopDomain: string): Promise<void> {
    const { error } = await (supabaseService as any).serviceClient
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId)
      .eq('shop_domain', shopDomain);

    if (error) {
      logger.error('Error deleting knowledge document:', error);
      throw new Error('Failed to delete document');
    }
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(documentId: string, shopDomain: string): Promise<{
    embedding_status: string;
    chunk_count: number;
    error_message: string | null;
  } | null> {
    const { data, error } = await (supabaseService as any).serviceClient
      .from('knowledge_documents')
      .select('embedding_status, chunk_count, error_message')
      .eq('id', documentId)
      .eq('shop_domain', shopDomain)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Failed to get document status');
    }

    return data;
  }
}

export const knowledgeService = new KnowledgeService();
