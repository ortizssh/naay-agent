-- Function for semantic product search using pgvector
CREATE OR REPLACE FUNCTION search_products_semantic(
    shop_domain TEXT,
    query_text TEXT,
    query_embedding vector(1536),
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
    SELECT 
        e.product_id,
        e.variant_id,
        p.title,
        p.description,
        COALESCE(v.price, 0) as price,
        p.vendor,
        p.handle,
        1 - (e.embedding <=> query_embedding) as similarity,
        e.metadata
    FROM product_embeddings e
    JOIN products p ON e.product_id = p.id
    LEFT JOIN product_variants v ON e.variant_id = v.id
    WHERE e.shop_domain = search_products_semantic.shop_domain
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function for product recommendations based on cart items
CREATE OR REPLACE FUNCTION get_product_recommendations(
    shop_domain TEXT,
    cart_product_ids TEXT[],
    recommendation_count INT DEFAULT 5
)
RETURNS TABLE (
    product_id VARCHAR(255),
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    vendor VARCHAR(255),
    handle VARCHAR(255),
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    avg_embedding vector(1536);
BEGIN
    -- Calculate average embedding of cart products
    SELECT AVG(embedding)
    INTO avg_embedding
    FROM product_embeddings
    WHERE shop_domain = get_product_recommendations.shop_domain
      AND product_id = ANY(cart_product_ids);
    
    -- Return recommendations if we have an average embedding
    IF avg_embedding IS NOT NULL THEN
        RETURN QUERY
        SELECT DISTINCT
            e.product_id,
            p.title,
            p.description,
            COALESCE(MIN(v.price), 0) as price,
            p.vendor,
            p.handle,
            1 - (e.embedding <=> avg_embedding) as similarity_score
        FROM product_embeddings e
        JOIN products p ON e.product_id = p.id
        LEFT JOIN product_variants v ON e.product_id = v.product_id
        WHERE e.shop_domain = get_product_recommendations.shop_domain
          AND e.product_id != ALL(cart_product_ids)
          AND 1 - (e.embedding <=> avg_embedding) > 0.6
        GROUP BY e.product_id, p.title, p.description, p.vendor, p.handle, e.embedding
        ORDER BY e.embedding <=> avg_embedding
        LIMIT recommendation_count;
    END IF;
END;
$$;

-- Function to get similar products
CREATE OR REPLACE FUNCTION get_similar_products(
    shop_domain TEXT,
    product_id VARCHAR(255),
    similarity_count INT DEFAULT 5
)
RETURNS TABLE (
    similar_product_id VARCHAR(255),
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    vendor VARCHAR(255),
    handle VARCHAR(255),
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    product_embedding vector(1536);
BEGIN
    -- Get the embedding for the reference product
    SELECT embedding
    INTO product_embedding
    FROM product_embeddings
    WHERE shop_domain = get_similar_products.shop_domain
      AND product_id = get_similar_products.product_id
    LIMIT 1;
    
    -- Return similar products if we found the embedding
    IF product_embedding IS NOT NULL THEN
        RETURN QUERY
        SELECT DISTINCT
            e.product_id,
            p.title,
            p.description,
            COALESCE(MIN(v.price), 0) as price,
            p.vendor,
            p.handle,
            1 - (e.embedding <=> product_embedding) as similarity_score
        FROM product_embeddings e
        JOIN products p ON e.product_id = p.id
        LEFT JOIN product_variants v ON e.product_id = v.product_id
        WHERE e.shop_domain = get_similar_products.shop_domain
          AND e.product_id != get_similar_products.product_id
          AND 1 - (e.embedding <=> product_embedding) > 0.6
        GROUP BY e.product_id, p.title, p.description, p.vendor, p.handle, e.embedding
        ORDER BY e.embedding <=> product_embedding
        LIMIT similarity_count;
    END IF;
END;
$$;

-- Function to analyze chat analytics
CREATE OR REPLACE FUNCTION get_shop_analytics(
    shop_domain TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    total_sessions BIGINT,
    total_messages BIGINT,
    avg_session_length INTERVAL,
    most_searched_products JSONB,
    conversion_rate FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM chat_sessions 
         WHERE shop_domain = get_shop_analytics.shop_domain 
           AND started_at BETWEEN start_date AND end_date) as total_sessions,
        
        (SELECT COUNT(*) FROM chat_messages m
         JOIN chat_sessions s ON m.session_id = s.id
         WHERE s.shop_domain = get_shop_analytics.shop_domain 
           AND m.timestamp BETWEEN start_date AND end_date) as total_messages,
        
        (SELECT AVG(last_activity - started_at) FROM chat_sessions
         WHERE shop_domain = get_shop_analytics.shop_domain 
           AND started_at BETWEEN start_date AND end_date) as avg_session_length,
        
        (SELECT json_build_object('products', json_agg(product_data))
         FROM (
             SELECT json_build_object('product_id', event_data->>'product_id', 'count', COUNT(*))
             FROM analytics_events
             WHERE shop_domain = get_shop_analytics.shop_domain
               AND event_type = 'product_viewed'
               AND timestamp BETWEEN start_date AND end_date
             GROUP BY event_data->>'product_id'
             ORDER BY COUNT(*) DESC
             LIMIT 10
         ) as product_data) as most_searched_products,
        
        (SELECT 
             CASE 
                 WHEN total_sessions > 0 THEN (converted_sessions::FLOAT / total_sessions::FLOAT)
                 ELSE 0 
             END
         FROM (
             SELECT 
                 COUNT(*) as total_sessions,
                 COUNT(*) FILTER (WHERE status = 'completed') as converted_sessions
             FROM chat_sessions
             WHERE shop_domain = get_shop_analytics.shop_domain 
               AND started_at BETWEEN start_date AND end_date
         ) as session_stats) as conversion_rate;
END;
$$;