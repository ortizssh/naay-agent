-- =====================================================
-- Migration 002: SaaS Multi-Tenant Support
-- =====================================================
-- This migration adds:
-- 1. Tenants table for SaaS subscription management
-- 2. Row-Level Security (RLS) on all multi-tenant tables
-- 3. Shop context column on chat_messages for faster queries
-- =====================================================

-- =====================================================
-- 1. TENANTS TABLE (SaaS Management)
-- =====================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Shop identification
    shop_domain VARCHAR(255) UNIQUE NOT NULL REFERENCES stores(shop_domain) ON DELETE CASCADE,
    shop_name VARCHAR(255),
    shop_email VARCHAR(255),

    -- Subscription info
    plan VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
    trial_ends_at TIMESTAMP WITH TIME ZONE,

    -- Plan limits
    monthly_messages_limit INTEGER DEFAULT 100,
    monthly_messages_used INTEGER DEFAULT 0,
    products_limit INTEGER DEFAULT 50,

    -- Billing (for future integration with Stripe/etc)
    billing_email VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),

    -- Features flags
    features JSONB DEFAULT '{
        "semantic_search": true,
        "cart_management": true,
        "analytics": false,
        "custom_branding": false,
        "priority_support": false,
        "api_access": false
    }'::jsonb,

    -- Customization
    settings JSONB DEFAULT '{
        "widget_position": "bottom-right",
        "widget_color": "#000000",
        "welcome_message": "¡Hola! ¿En qué puedo ayudarte?",
        "language": "es"
    }'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tenants
CREATE INDEX idx_tenants_shop_domain ON tenants(shop_domain);
CREATE INDEX idx_tenants_plan ON tenants(plan);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Update trigger for tenants
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. ADD shop_domain TO chat_messages (Optimization)
-- =====================================================
-- This allows direct RLS and faster queries without JOINs

ALTER TABLE chat_messages
ADD COLUMN shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE;

-- Backfill existing messages with shop_domain from their sessions
UPDATE chat_messages cm
SET shop_domain = cs.shop_domain
FROM chat_sessions cs
WHERE cm.session_id = cs.id;

-- Make it NOT NULL after backfill
ALTER TABLE chat_messages
ALTER COLUMN shop_domain SET NOT NULL;

-- Index for faster queries
CREATE INDEX idx_chat_messages_shop_domain ON chat_messages(shop_domain);

-- =====================================================
-- 3. ROW-LEVEL SECURITY (RLS)
-- =====================================================
-- Strategy: Enable RLS but allow service_role to bypass
-- This maintains current functionality while adding protection

-- Helper function to check if current role is service_role
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS on STORES table
-- =====================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to stores" ON stores
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Stores can read own data" ON stores
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on PRODUCTS table
-- =====================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to products" ON products
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Products isolated by shop" ON products
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on PRODUCT_VARIANTS table
-- =====================================================
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to variants" ON product_variants
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Variants isolated by shop" ON product_variants
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on PRODUCT_EMBEDDINGS table
-- =====================================================
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to embeddings" ON product_embeddings
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Embeddings isolated by shop" ON product_embeddings
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on CHAT_SESSIONS table
-- =====================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to chat_sessions" ON chat_sessions
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Chat sessions isolated by shop" ON chat_sessions
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on CHAT_MESSAGES table
-- =====================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to chat_messages" ON chat_messages
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Chat messages isolated by shop" ON chat_messages
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on ANALYTICS_EVENTS table
-- =====================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to analytics" ON analytics_events
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Analytics isolated by shop" ON analytics_events
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- RLS on TENANTS table
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to tenants" ON tenants
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Tenants can read own data" ON tenants
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- 4. USAGE TRACKING FUNCTION
-- =====================================================
-- Function to increment message usage for a tenant

CREATE OR REPLACE FUNCTION increment_tenant_usage(
    p_shop_domain VARCHAR(255),
    p_messages_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant tenants%ROWTYPE;
BEGIN
    -- Get tenant info
    SELECT * INTO v_tenant
    FROM tenants
    WHERE shop_domain = p_shop_domain;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Check if within limits
    IF v_tenant.monthly_messages_used + p_messages_count > v_tenant.monthly_messages_limit THEN
        RETURN false;
    END IF;

    -- Increment usage
    UPDATE tenants
    SET
        monthly_messages_used = monthly_messages_used + p_messages_count,
        last_activity_at = NOW()
    WHERE shop_domain = p_shop_domain;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. MONTHLY USAGE RESET FUNCTION
-- =====================================================
-- Call this via a cron job at the start of each month

CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE tenants
    SET monthly_messages_used = 0
    WHERE status = 'active';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. AUTO-CREATE TENANT ON STORE INSERT
-- =====================================================
-- Automatically create a tenant record when a new store is added

CREATE OR REPLACE FUNCTION create_tenant_for_store()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tenants (shop_domain, shop_name, plan, status)
    VALUES (NEW.shop_domain, NEW.shop_domain, 'trial', 'trial')
    ON CONFLICT (shop_domain) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_tenant
AFTER INSERT ON stores
FOR EACH ROW EXECUTE FUNCTION create_tenant_for_store();

-- =====================================================
-- 7. MIGRATE EXISTING STORES TO TENANTS
-- =====================================================
-- Create tenant records for any existing stores

INSERT INTO tenants (shop_domain, shop_name, plan, status, trial_ends_at)
SELECT
    shop_domain,
    shop_domain as shop_name,
    'professional' as plan,  -- Existing stores get professional plan
    'active' as status,
    NULL as trial_ends_at
FROM stores
ON CONFLICT (shop_domain) DO NOTHING;

-- =====================================================
-- 8. AUDIT LOG TABLE (Optional but recommended)
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    performed_by VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_shop_domain ON audit_logs(shop_domain);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to audit_logs" ON audit_logs
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "Audit logs isolated by shop" ON audit_logs
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));
