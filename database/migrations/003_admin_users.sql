-- =====================================================
-- Migration: Admin Users Table
-- Description: Create table for admin panel users
-- =====================================================

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'pro', 'enterprise')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    avatar_url TEXT,
    phone VARCHAR(50),
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can manage admin users"
    ON admin_users
    FOR ALL
    USING (
        (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
        OR auth.role() = 'service_role'
    );

-- Create bypass function for admin_users (similar to is_service_role)
CREATE OR REPLACE FUNCTION is_admin_service_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        current_setting('role', true) = 'service_role'
        OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow service role full access
CREATE POLICY "Service role bypass for admin_users"
    ON admin_users
    FOR ALL
    USING (is_admin_service_role());

-- Grant permissions
GRANT ALL ON admin_users TO service_role;
GRANT SELECT, INSERT, UPDATE ON admin_users TO authenticated;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_users_updated_at();

-- =====================================================
-- IMPORTANT: Run this migration in Supabase SQL Editor
-- =====================================================
