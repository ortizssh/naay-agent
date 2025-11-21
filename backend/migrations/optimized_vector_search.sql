-- Optimized Vector Search Function for Naay
-- This replaces the existing search_products_semantic function with improved performance
-- Updated to match the actual implemented schema (stores table with shop_domain)

-- First, drop existing function if it exists
DROP FUNCTION IF EXISTS search_products_semantic(TEXT, TEXT, VECTOR(1536), FLOAT, INT);

-- Create optimized function matching actual schema
CREATE OR REPLACE FUNCTION search_products_semantic(
    shop_domain TEXT,
    query_text TEXT,
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    product_id VARCHAR(255),
    variant_id VARCHAR(255),
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    vendor VARCHAR(255),
    handle VARCHAR(255),
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_results AS (
        SELECT 
            e.product_id,
            e.variant_id,
            p.title,
            p.description,
            COALESCE(v.price, 0) as price,
            p.vendor,
            p.handle,
            1 - (e.embedding <=> query_embedding) as similarity_score,
            e.metadata
        FROM product_embeddings e
        JOIN products p ON e.product_id = p.id
        LEFT JOIN product_variants v ON e.variant_id = v.id
        WHERE e.shop_domain = search_products_semantic.shop_domain
          AND 1 - (e.embedding <=> query_embedding) > match_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count
    )
    SELECT 
        r.product_id,
        r.variant_id,
        r.title,
        r.description,
        r.price,
        r.vendor,
        r.handle,
        r.similarity_score,
        r.metadata
    FROM ranked_results r
    ORDER BY r.similarity_score DESC;
END;
$$;

-- Create optimized indexes for vector search
-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_embeddings_vector;
DROP INDEX IF EXISTS idx_embeddings_vector_optimized;

-- Calculate optimal number of lists for ivfflat index
-- Rule of thumb: sqrt(number_of_rows), but we'll start with a reasonable default
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_vector_optimized 
ON product_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 316);

-- Additional indexes for filtering (using actual schema)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_shop_domain 
ON product_embeddings (shop_domain);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_shop_domain 
ON products (shop_domain);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_product_id 
ON product_variants (product_id);

-- Function to search with enhanced caching support (using actual schema)
CREATE OR REPLACE FUNCTION search_products_semantic_cached(
    shop_domain TEXT,
    query_text TEXT,
    query_embedding VECTOR(1536),
    cache_key TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    product_id VARCHAR(255),
    variant_id VARCHAR(255),
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    vendor VARCHAR(255),
    handle VARCHAR(255),
    similarity FLOAT,
    metadata JSONB,
    cache_hit BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    cache_result JSONB;
    cache_expiry TIMESTAMPTZ;
BEGIN
    -- Try cache first if cache_key provided
    IF cache_key IS NOT NULL THEN
        SELECT data, expires_at INTO cache_result, cache_expiry
        FROM search_cache 
        WHERE key = cache_key AND expires_at > NOW();
        
        IF cache_result IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                (item->>'product_id')::VARCHAR(255),
                (item->>'variant_id')::VARCHAR(255),
                item->>'title',
                item->>'description',
                (item->>'price')::DECIMAL(10,2),
                item->>'vendor',
                item->>'handle',
                (item->>'similarity')::FLOAT,
                (item->>'metadata')::JSONB,
                true as cache_hit
            FROM jsonb_array_elements(cache_result) as item;
            RETURN;
        END IF;
    END IF;
    
    -- No cache hit, perform actual search
    RETURN QUERY
    SELECT 
        result.*,
        false as cache_hit
    FROM search_products_semantic(
        shop_domain,
        query_text,
        query_embedding, 
        match_threshold, 
        match_count
    ) as result;
END;
$$;

-- Create cache table for search results
CREATE TABLE IF NOT EXISTS search_cache (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache (expires_at);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_search_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to get products by embedding with metadata (using actual schema)
CREATE OR REPLACE FUNCTION get_product_embedding_with_metadata(
    product_id_param VARCHAR(255),
    shop_domain_param TEXT
)
RETURNS TABLE (
    embedding VECTOR(1536),
    content TEXT,
    metadata JSONB,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.embedding,
        pe.content,
        jsonb_build_object(
            'title', p.title,
            'vendor', p.vendor,
            'product_type', p.product_type,
            'tags', p.tags,
            'handle', p.handle,
            'updated_at', p.updated_at
        ) as metadata,
        pe.created_at
    FROM product_embeddings pe
    JOIN products p ON pe.product_id = p.id
    WHERE pe.product_id = product_id_param 
        AND pe.shop_domain = shop_domain_param
    ORDER BY pe.created_at DESC
    LIMIT 1;
END;
$$;

-- Comments for documentation
COMMENT ON FUNCTION search_products_semantic IS 'Optimized semantic search for products using vector embeddings with cosine similarity';
COMMENT ON FUNCTION search_products_semantic_cached IS 'Cached version of semantic search with automatic cache management';
COMMENT ON FUNCTION get_product_embedding_with_metadata IS 'Retrieves product embedding with enhanced metadata for cache warming';
COMMENT ON TABLE search_cache IS 'Cache table for storing frequently accessed search results';

-- Grant necessary permissions (adjust as needed)
-- GRANT EXECUTE ON FUNCTION search_products_semantic TO your_app_user;
-- GRANT EXECUTE ON FUNCTION search_products_semantic_cached TO your_app_user;
-- GRANT ALL ON TABLE search_cache TO your_app_user;