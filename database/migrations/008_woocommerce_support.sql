-- =====================================================
-- Migration 008: WooCommerce Platform Support
-- =====================================================
-- Adds support for WooCommerce stores alongside existing Shopify stores
-- Includes platform field, external IDs, and credentials storage

-- Add platform column to stores table
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'shopify',
ADD COLUMN IF NOT EXISTS site_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN stores.platform IS 'E-commerce platform: shopify or woocommerce';
COMMENT ON COLUMN stores.site_url IS 'Full site URL for WooCommerce stores';
COMMENT ON COLUMN stores.webhook_secret IS 'Secret for webhook signature verification';
COMMENT ON COLUMN stores.credentials IS 'Platform-specific credentials (encrypted in application layer)';

-- Add platform column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'shopify',
ADD COLUMN IF NOT EXISTS external_id TEXT;

COMMENT ON COLUMN products.platform IS 'Source platform: shopify or woocommerce';
COMMENT ON COLUMN products.external_id IS 'Original platform ID (Shopify GID or WC integer)';

-- Add external_id to product_variants table
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS external_id TEXT;

COMMENT ON COLUMN product_variants.external_id IS 'Original platform variant ID';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_stores_platform ON stores(platform);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_external_id ON product_variants(external_id);

-- Update existing stores to have platform = 'shopify'
UPDATE stores
SET platform = 'shopify'
WHERE platform IS NULL;

-- Update existing products to have platform = 'shopify'
UPDATE products
SET platform = 'shopify'
WHERE platform IS NULL;

-- Create table for chat conversions (if not exists)
CREATE TABLE IF NOT EXISTS chat_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL REFERENCES stores(shop_domain) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_total DECIMAL(10, 2),
    currency VARCHAR(10),
    products_recommended TEXT[], -- Array of product IDs that were recommended
    products_purchased TEXT[], -- Array of product IDs that were purchased
    attributed_revenue DECIMAL(10, 2), -- Revenue attributed to chat
    converted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for chat_conversions
CREATE INDEX IF NOT EXISTS idx_chat_conversions_shop ON chat_conversions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_session ON chat_conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_order ON chat_conversions(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_date ON chat_conversions(converted_at);

-- Add RLS policy for chat_conversions
ALTER TABLE chat_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conversions_tenant_isolation ON chat_conversions
    FOR ALL
    USING (shop_domain = current_setting('app.current_tenant', true));

-- Create view for conversion analytics by platform
CREATE OR REPLACE VIEW conversion_analytics_by_platform AS
SELECT
    s.platform,
    s.shop_domain,
    COUNT(DISTINCT cc.id) as total_conversions,
    COALESCE(SUM(cc.order_total), 0) as total_revenue,
    COALESCE(SUM(cc.attributed_revenue), 0) as attributed_revenue,
    COUNT(DISTINCT cc.session_id) as unique_sessions,
    COALESCE(AVG(cc.order_total), 0) as avg_order_value,
    MAX(cc.converted_at) as last_conversion
FROM stores s
LEFT JOIN chat_conversions cc ON s.shop_domain = cc.shop_domain
GROUP BY s.platform, s.shop_domain;

-- Create function to get platform-specific product count
CREATE OR REPLACE FUNCTION get_product_count_by_platform(p_shop_domain TEXT)
RETURNS TABLE (platform VARCHAR, product_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.platform,
        COUNT(*)::BIGINT as product_count
    FROM products p
    WHERE p.shop_domain = p_shop_domain
    GROUP BY p.platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update semantic search function to include platform
CREATE OR REPLACE FUNCTION search_products_semantic_v2(
    p_shop_domain TEXT,
    p_query_embedding vector(1536),
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INT DEFAULT 10,
    p_platform TEXT DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    external_id TEXT,
    platform VARCHAR,
    title TEXT,
    description TEXT,
    handle TEXT,
    vendor TEXT,
    product_type TEXT,
    tags TEXT[],
    images JSONB,
    variants JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.external_id,
        p.platform,
        p.title,
        p.description,
        p.handle,
        p.vendor,
        p.product_type,
        p.tags,
        p.images,
        p.variants,
        (1 - (pe.embedding <=> p_query_embedding))::FLOAT as similarity
    FROM products p
    INNER JOIN product_embeddings pe ON p.id = pe.product_id AND p.shop_domain = pe.shop_domain
    WHERE p.shop_domain = p_shop_domain
        AND (p_platform IS NULL OR p.platform = p_platform)
        AND (1 - (pe.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY pe.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_product_count_by_platform TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_count_by_platform TO service_role;
GRANT EXECUTE ON FUNCTION search_products_semantic_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION search_products_semantic_v2 TO service_role;
GRANT SELECT ON conversion_analytics_by_platform TO authenticated;
GRANT SELECT ON conversion_analytics_by_platform TO service_role;
