-- Migration: Fix Multi-tenant Analytics
-- Date: 2026-01-27
-- Description: Add shop_domain to admin_users and create client_store for existing stores

-- 1. Add shop_domain column to admin_users for linking users to stores
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS shop_domain VARCHAR(255);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_shop_domain ON admin_users(shop_domain);

-- 3. Add unique constraint to prevent duplicate user-store associations (before inserts)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_shop'
    ) THEN
        ALTER TABLE client_stores ADD CONSTRAINT unique_user_shop UNIQUE (user_id, shop_domain);
        RAISE NOTICE 'Created unique constraint unique_user_shop';
    ELSE
        RAISE NOTICE 'Constraint unique_user_shop already exists';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint unique_user_shop already exists (caught exception)';
END $$;

-- 4. Create client_store entry for naaycl.myshopify.com
DO $$
DECLARE
    naay_user_id UUID;
    store_exists BOOLEAN;
BEGIN
    -- Check if client_store already exists for naay
    SELECT EXISTS(
        SELECT 1 FROM client_stores WHERE shop_domain = 'naaycl.myshopify.com'
    ) INTO store_exists;

    IF NOT store_exists THEN
        -- Get the first admin user
        SELECT id INTO naay_user_id FROM admin_users WHERE role = 'admin' LIMIT 1;

        IF naay_user_id IS NOT NULL THEN
            -- Create client_store entry linked to stores table data
            INSERT INTO client_stores (
                user_id,
                shop_domain,
                platform,
                status,
                widget_position,
                widget_color,
                welcome_message,
                widget_enabled,
                is_active,
                products_synced,
                created_at,
                updated_at
            )
            SELECT
                naay_user_id,
                s.shop_domain,
                'shopify',
                'active',
                'bottom-right',
                '#a59457',
                'Necesitas ayuda para tu compra? Habla aqui!',
                s.widget_enabled,
                true,
                (SELECT COUNT(*) FROM products WHERE shop_domain = s.shop_domain),
                s.installed_at,
                NOW()
            FROM stores s
            WHERE s.shop_domain = 'naaycl.myshopify.com'
            ON CONFLICT (user_id, shop_domain) DO NOTHING;

            -- Update admin_user with shop_domain
            UPDATE admin_users
            SET shop_domain = 'naaycl.myshopify.com'
            WHERE id = naay_user_id;

            RAISE NOTICE 'Created client_store for naaycl.myshopify.com linked to user %', naay_user_id;
        ELSE
            RAISE NOTICE 'No admin user found to link naay store';
        END IF;
    ELSE
        RAISE NOTICE 'client_store for naaycl.myshopify.com already exists';
    END IF;
END $$;

-- 5. Verify the migration
SELECT
    'admin_users with shop_domain' as check_type,
    COUNT(*) as count
FROM admin_users
WHERE shop_domain IS NOT NULL
UNION ALL
SELECT
    'client_stores total',
    COUNT(*)
FROM client_stores
UNION ALL
SELECT
    'client_stores for naay',
    COUNT(*)
FROM client_stores
WHERE shop_domain = 'naaycl.myshopify.com';
