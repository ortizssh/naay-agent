-- Migration 016: Knowledge Base + AI Agent Configuration
-- Adds knowledge documents/chunks tables for RAG, and AI config columns on client_stores

-- =====================================================
-- 1. Knowledge Documents table
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('text', 'file', 'url')),
  source_url TEXT,
  original_filename TEXT,
  content TEXT NOT NULL,
  content_hash TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_status VARCHAR(20) DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_shop ON knowledge_documents(shop_domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status ON knowledge_documents(embedding_status);

-- =====================================================
-- 2. Knowledge Chunks table (with pgvector embeddings)
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  shop_domain VARCHAR(255) NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_shop ON knowledge_chunks(shop_domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);

-- IVFFlat index for similarity search (same pattern as product_embeddings)
-- Use a lower number of lists since knowledge chunks will be fewer than products
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- =====================================================
-- 3. RPC function for semantic knowledge search
-- =====================================================
CREATE OR REPLACE FUNCTION search_knowledge_semantic(
  p_shop_domain TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  document_title TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.document_id,
    kd.title AS document_title,
    kc.content,
    1 - (kc.embedding <=> p_query_embedding) AS similarity,
    kc.metadata
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.shop_domain = p_shop_domain
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- =====================================================
-- 4. New columns on client_stores for AI config
-- =====================================================
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS chat_mode VARCHAR(20) DEFAULT 'internal' CHECK (chat_mode IN ('internal', 'external'));
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50) DEFAULT 'gpt-4.1-mini';
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS agent_tone VARCHAR(30) DEFAULT 'friendly' CHECK (agent_tone IN ('friendly', 'formal', 'casual', 'professional'));
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS brand_description TEXT;
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS agent_instructions TEXT;
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS agent_language VARCHAR(10) DEFAULT 'es';

-- =====================================================
-- 5. Backwards compatibility: mark existing stores with
--    custom chatbot_endpoint as 'external' mode
-- =====================================================
UPDATE client_stores
SET chat_mode = 'external'
WHERE chatbot_endpoint IS NOT NULL
  AND chatbot_endpoint != ''
  AND chat_mode IS NULL OR chat_mode = 'internal';
