-- Naay Agent Database Schema for Supabase
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Shops table - stores Shopify store installations
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    plan VARCHAR(50),
    timezone VARCHAR(100),
    currency CHAR(3),
    webhook_endpoints JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table - synchronized from Shopify
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    shopify_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description_html TEXT,
    description_text TEXT,
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    handle VARCHAR(255),
    images JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, shopify_id)
);

-- Product variants table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    shopify_id BIGINT NOT NULL,
    title VARCHAR(255),
    sku VARCHAR(255),
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    inventory_quantity INTEGER DEFAULT 0,
    available_for_sale BOOLEAN DEFAULT true,
    weight DECIMAL(8,2),
    weight_unit VARCHAR(10),
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    barcode VARCHAR(255),
    position INTEGER,
    selected_options JSONB DEFAULT '[]',
    image JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, shopify_id)
);

-- Vector embeddings table for RAG
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('product', 'variant', 'description')),
    content_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    model_version VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table - chat history and analytics
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255), -- Shopify customer ID if authenticated
    cart_id VARCHAR(255), -- Shopify cart ID
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table - individual chat messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    intent_detected VARCHAR(100),
    intent_confidence DECIMAL(3,2),
    actions_executed JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync jobs table for tracking synchronization status
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    total INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance

-- Primary lookup indexes
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_shopify_id ON products(shop_id, shopify_id);
CREATE INDEX idx_products_status ON products(shop_id, status);
CREATE INDEX idx_products_updated_at ON products(updated_at);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_shopify_id ON product_variants(shopify_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

-- Vector similarity search index
CREATE INDEX idx_embeddings_vector ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_embeddings_product_id ON product_embeddings(product_id);
CREATE INDEX idx_embeddings_content_type ON product_embeddings(content_type);

-- Conversation and message indexes
CREATE INDEX idx_conversations_shop_id ON conversations(shop_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Analytics indexes
CREATE INDEX idx_analytics_shop_id ON analytics_events(shop_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- Sync jobs indexes
CREATE INDEX idx_sync_jobs_shop_id ON sync_jobs(shop_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at);

-- Search functions

-- Function to search products by semantic similarity
CREATE OR REPLACE FUNCTION search_products_semantic(
    query_embedding VECTOR(1536),
    shop_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    match_limit INT DEFAULT 10
)
RETURNS TABLE (
    product_id UUID,
    title TEXT,
    description_text TEXT,
    price DECIMAL,
    available BOOLEAN,
    similarity FLOAT,
    images JSONB,
    variants JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description_text,
        COALESCE(MIN(pv.price), 0) as price,
        bool_and(pv.available_for_sale) as available,
        (1 - (pe.embedding <=> query_embedding))::FLOAT as similarity,
        p.images,
        jsonb_agg(
            jsonb_build_object(
                'id', pv.id,
                'shopify_id', pv.shopify_id,
                'title', pv.title,
                'price', pv.price,
                'sku', pv.sku,
                'available', pv.available_for_sale,
                'inventory_quantity', pv.inventory_quantity
            ) ORDER BY pv.position
        ) as variants
    FROM product_embeddings pe
    JOIN products p ON pe.product_id = p.id
    JOIN product_variants pv ON p.id = pv.product_id
    WHERE p.shop_id = search_products_semantic.shop_id
        AND pe.content_type = 'product'
        AND (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
        AND p.status = 'active'
    GROUP BY p.id, p.title, p.description_text, pe.embedding, p.images
    ORDER BY similarity DESC
    LIMIT match_limit;
END;
$$;

-- Function to get product recommendations based on cart contents
CREATE OR REPLACE FUNCTION get_product_recommendations(
    cart_product_ids UUID[],
    shop_id UUID,
    recommendation_limit INT DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    title TEXT,
    description_text TEXT,
    price DECIMAL,
    similarity_score FLOAT,
    recommendation_reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    avg_embedding VECTOR(1536);
BEGIN
    -- Calculate average embedding from cart products
    SELECT AVG(embedding) INTO avg_embedding
    FROM product_embeddings pe
    JOIN products p ON pe.product_id = p.id
    WHERE p.id = ANY(cart_product_ids)
        AND p.shop_id = get_product_recommendations.shop_id
        AND pe.content_type = 'product';

    -- Return similar products not in cart
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description_text,
        COALESCE(MIN(pv.price), 0) as price,
        (1 - (pe.embedding <=> avg_embedding))::FLOAT as similarity_score,
        'Based on your cart items'::TEXT as recommendation_reason
    FROM product_embeddings pe
    JOIN products p ON pe.product_id = p.id
    JOIN product_variants pv ON p.id = pv.product_id
    WHERE p.shop_id = get_product_recommendations.shop_id
        AND pe.content_type = 'product'
        AND p.id != ALL(cart_product_ids)
        AND p.status = 'active'
        AND (1 - (pe.embedding <=> avg_embedding)) > 0.6
    GROUP BY p.id, p.title, p.description_text, pe.embedding
    ORDER BY similarity_score DESC
    LIMIT recommendation_limit;
END;
$$;

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (customize based on your auth strategy)
CREATE POLICY "Shops are viewable by service role" ON shops FOR ALL TO service_role;
CREATE POLICY "Products are viewable by service role" ON products FOR ALL TO service_role;
CREATE POLICY "Variants are viewable by service role" ON product_variants FOR ALL TO service_role;
CREATE POLICY "Embeddings are viewable by service role" ON product_embeddings FOR ALL TO service_role;
CREATE POLICY "Conversations are viewable by service role" ON conversations FOR ALL TO service_role;
CREATE POLICY "Messages are viewable by service role" ON messages FOR ALL TO service_role;
CREATE POLICY "Analytics are viewable by service role" ON analytics_events FOR ALL TO service_role;
CREATE POLICY "Sync jobs are viewable by service role" ON sync_jobs FOR ALL TO service_role;

-- Views for common queries

-- Active products with variant count
CREATE VIEW active_products_summary AS
SELECT 
    p.*,
    COUNT(pv.id) as variant_count,
    MIN(pv.price) as min_price,
    MAX(pv.price) as max_price,
    SUM(pv.inventory_quantity) as total_inventory
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
WHERE p.status = 'active'
GROUP BY p.id;

-- Conversation analytics
CREATE VIEW conversation_analytics AS
SELECT 
    c.shop_id,
    DATE_TRUNC('day', c.created_at) as date,
    COUNT(*) as total_conversations,
    COUNT(DISTINCT c.session_id) as unique_sessions,
    AVG(message_count) as avg_messages_per_conversation,
    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_conversations
FROM conversations c
LEFT JOIN (
    SELECT conversation_id, COUNT(*) as message_count
    FROM messages 
    GROUP BY conversation_id
) m ON c.id = m.conversation_id
GROUP BY c.shop_id, DATE_TRUNC('day', c.created_at);

-- Popular products by AI recommendations
CREATE VIEW popular_ai_products AS
SELECT 
    p.shop_id,
    p.id,
    p.title,
    COUNT(*) as recommendation_count,
    COUNT(DISTINCT m.conversation_id) as unique_conversations
FROM products p
JOIN messages m ON m.actions_executed::TEXT LIKE '%' || p.shopify_id || '%'
WHERE m.role = 'assistant'
    AND m.actions_executed IS NOT NULL
GROUP BY p.shop_id, p.id, p.title
ORDER BY recommendation_count DESC;

-- Insert sample configuration
INSERT INTO shops (domain, access_token, scopes) VALUES 
('example-store.myshopify.com', 'sample_token', ARRAY['read_products', 'write_products', 'read_orders']);

COMMENT ON TABLE shops IS 'Stores Shopify shop installations and access tokens';
COMMENT ON TABLE products IS 'Synchronized product catalog from Shopify Admin API';
COMMENT ON TABLE product_variants IS 'Product variants with pricing and inventory';
COMMENT ON TABLE product_embeddings IS 'Vector embeddings for semantic product search';
COMMENT ON TABLE conversations IS 'AI chat conversation sessions';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE analytics_events IS 'User interaction and performance analytics';
COMMENT ON TABLE sync_jobs IS 'Background job tracking for data synchronization';