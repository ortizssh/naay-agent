-- =====================================================
-- Migration 002 STANDALONE: SaaS Multi-Tenant Support
-- =====================================================
-- Esta versión funciona independientemente de si stores existe o no
-- =====================================================

-- Enable required extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. CREATE STORES TABLE IF NOT EXISTS
-- =====================================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scopes TEXT NOT NULL,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TENANTS TABLE (SaaS Management)
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants (
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

-- Indexes for tenants (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_tenants_shop_domain ON tenants(shop_domain);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- 3. UPDATE TRIGGER FUNCTION (create if not exists)
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate trigger for tenants
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. HELPER FUNCTION FOR RLS
-- =====================================================

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
-- 5. ROW-LEVEL SECURITY ON STORES
-- =====================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to stores" ON stores;
CREATE POLICY "Service role full access to stores" ON stores
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "Stores can read own data" ON stores;
CREATE POLICY "Stores can read own data" ON stores
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- 6. ROW-LEVEL SECURITY ON TENANTS
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to tenants" ON tenants;
CREATE POLICY "Service role full access to tenants" ON tenants
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "Tenants can read own data" ON tenants;
CREATE POLICY "Tenants can read own data" ON tenants
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- 7. USAGE TRACKING FUNCTION
-- =====================================================

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

    -- Check if within limits (-1 means unlimited)
    IF v_tenant.monthly_messages_limit != -1 AND
       v_tenant.monthly_messages_used + p_messages_count > v_tenant.monthly_messages_limit THEN
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
-- 8. MONTHLY USAGE RESET FUNCTION
-- =====================================================

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
-- 9. AUTO-CREATE TENANT ON STORE INSERT
-- =====================================================

CREATE OR REPLACE FUNCTION create_tenant_for_store()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tenants (shop_domain, shop_name, plan, status)
    VALUES (NEW.shop_domain, NEW.shop_domain, 'free', 'trial')
    ON CONFLICT (shop_domain) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_tenant ON stores;
CREATE TRIGGER auto_create_tenant
AFTER INSERT ON stores
FOR EACH ROW EXECUTE FUNCTION create_tenant_for_store();

-- =====================================================
-- 10. MIGRATE EXISTING STORES TO TENANTS
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
-- 11. AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_domain ON audit_logs(shop_domain);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to audit_logs" ON audit_logs;
CREATE POLICY "Service role full access to audit_logs" ON audit_logs
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "Audit logs isolated by shop" ON audit_logs;
CREATE POLICY "Audit logs isolated by shop" ON audit_logs
    FOR SELECT
    USING (shop_domain = current_setting('app.current_shop', true));

-- =====================================================
-- DONE!
-- =====================================================
-- This migration creates:
-- 1. stores table (if not exists)
-- 2. tenants table for SaaS management
-- 3. RLS on stores and tenants
-- 4. Usage tracking functions
-- 5. Auto-tenant creation trigger
-- 6. Audit logs table
-- =====================================================
