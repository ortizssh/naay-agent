-- =====================================================
-- Migration: Client Onboarding Support
-- Description: Add user_type to admin_users and create client_stores table
-- =====================================================

-- 1. Add user_type and onboarding columns to admin_users
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'admin' CHECK (user_type IN ('admin', 'client')),
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Create index for user_type
CREATE INDEX IF NOT EXISTS idx_admin_users_user_type ON admin_users(user_type);

-- 2. Create client_stores table for linking clients with their stores
CREATE TABLE IF NOT EXISTS client_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    shop_domain VARCHAR(255) NOT NULL,
    platform VARCHAR(50) DEFAULT 'shopify' CHECK (platform IN ('shopify', 'woocommerce')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'active', 'suspended', 'disconnected')),
    access_token TEXT,
    widget_position VARCHAR(50) DEFAULT 'bottom-right' CHECK (widget_position IN ('bottom-right', 'bottom-left', 'top-right', 'top-left')),
    widget_color VARCHAR(20) DEFAULT '#6d5cff',
    welcome_message TEXT DEFAULT 'Hola! Como puedo ayudarte?',
    widget_enabled BOOLEAN DEFAULT TRUE,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT FALSE,
    products_synced INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, shop_domain)
);

-- Create indexes for client_stores
CREATE INDEX IF NOT EXISTS idx_client_stores_user_id ON client_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_client_stores_shop_domain ON client_stores(shop_domain);
CREATE INDEX IF NOT EXISTS idx_client_stores_status ON client_stores(status);

-- Enable RLS on client_stores
ALTER TABLE client_stores ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to client_stores
CREATE POLICY "Service role can manage client_stores"
    ON client_stores
    FOR ALL
    USING (is_admin_service_role());

-- Grant permissions
GRANT ALL ON client_stores TO service_role;
GRANT SELECT, INSERT, UPDATE ON client_stores TO authenticated;

-- Create updated_at trigger for client_stores
CREATE OR REPLACE FUNCTION update_client_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_client_stores_updated_at ON client_stores;
CREATE TRIGGER trigger_update_client_stores_updated_at
    BEFORE UPDATE ON client_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stores_updated_at();

-- =====================================================
-- IMPORTANT: Run this migration in Supabase SQL Editor
-- =====================================================
