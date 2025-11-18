-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Stores table
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scopes TEXT NOT NULL,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    handle VARCHAR(255),
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    tags TEXT[],
    images JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table  
CREATE TABLE product_variants (
    id VARCHAR(255) PRIMARY KEY,
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR(255),
    sku VARCHAR(255),
    price DECIMAL(10,2),
    compare_at_price DECIMAL(10,2),
    inventory_quantity INTEGER DEFAULT 0,
    weight DECIMAL(8,2),
    weight_unit VARCHAR(10),
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product embeddings table (for RAG)
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
    variant_id VARCHAR(255) REFERENCES product_variants(id) ON DELETE CASCADE,
    embedding vector(1536),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    customer_id VARCHAR(255),
    cart_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook events table (for tracking and processing)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    verified BOOLEAN DEFAULT false,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Analytics table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_products_shop_domain ON products(shop_domain);
CREATE INDEX idx_products_handle ON products(handle);
CREATE INDEX idx_products_updated_at ON products(updated_at);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_shop_domain ON product_variants(shop_domain);

CREATE INDEX idx_embeddings_shop_domain ON product_embeddings(shop_domain);
CREATE INDEX idx_embeddings_product_id ON product_embeddings(product_id);

-- Vector similarity index for embeddings
CREATE INDEX idx_embeddings_vector ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_chat_sessions_shop_domain ON chat_sessions(shop_domain);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_sessions_last_activity ON chat_sessions(last_activity);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

CREATE INDEX idx_webhooks_shop_domain ON webhook_events(shop_domain);
CREATE INDEX idx_webhooks_processed ON webhook_events(processed);
CREATE INDEX idx_webhooks_topic ON webhook_events(topic);

CREATE INDEX idx_analytics_shop_domain ON analytics_events(shop_domain);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variants_updated_at BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();