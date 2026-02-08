-- Migration 013: Fix data inconsistencies across tables
-- Fixes: tenants.features sync, stores.platform correction, admin_users.plan CHECK constraint

-- ============================================================
-- 1. Sync tenants.features with plan 'professional' from plans table
-- Both tenants have plan='professional' but features from plan 'free'
-- ============================================================
UPDATE tenants
SET features = (
  SELECT features FROM plans WHERE slug = 'professional'
),
updated_at = NOW()
WHERE plan = 'professional'
  AND (
    features->>'analytics' = 'false'
    OR features->>'custom_branding' = 'false'
    OR features->>'priority_support' = 'false'
  );

-- ============================================================
-- 2. Fix stores.platform for imperionfc.cl
-- stores says 'shopify' but client_stores says 'woocommerce'
-- ============================================================
UPDATE stores
SET platform = 'woocommerce',
    updated_at = NOW()
WHERE shop_domain LIKE '%imperionfc.cl%'
  AND platform = 'shopify';

-- ============================================================
-- 3. Update admin_users.plan CHECK constraint
-- Old constraint allows: starter, growth, pro, enterprise
-- New constraint allows: free, starter, professional, enterprise
-- ============================================================

-- First, migrate existing values to new slugs
UPDATE admin_users SET plan = 'professional' WHERE plan = 'pro';
UPDATE admin_users SET plan = 'professional' WHERE plan = 'growth';

-- Drop old CHECK constraint (name may vary, use safe pattern)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'admin_users'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%plan%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE admin_users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Add new CHECK constraint with correct plan slugs
ALTER TABLE admin_users
ADD CONSTRAINT admin_users_plan_check
CHECK (plan IN ('free', 'starter', 'professional', 'enterprise'));
