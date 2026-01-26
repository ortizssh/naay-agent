-- =====================================================
-- Seed: Test Users (Admin and Client)
-- Description: Create test users for development
-- Password for both: Test1234!
-- =====================================================

-- Note: Password hash is SHA256 of "Test1234!" + JWT_SECRET
-- Using default JWT_SECRET: 'kova-admin-secret-key-change-in-production'
-- SHA256("Test1234!kova-admin-secret-key-change-in-production") = hash below

-- 1. Create Admin Test User
INSERT INTO admin_users (
    email,
    password_hash,
    first_name,
    last_name,
    company,
    role,
    plan,
    status,
    user_type,
    onboarding_completed,
    onboarding_step,
    created_at,
    updated_at
) VALUES (
    'admin@test.com',
    'fa08e0820ad9f16732052886b64c2e510a0bbc91d7ad0ff412f0a7aa875076a3',
    'Admin',
    'Test',
    'Kova',
    'admin',
    'enterprise',
    'active',
    'admin',
    true,
    4,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    user_type = EXCLUDED.user_type,
    onboarding_completed = EXCLUDED.onboarding_completed,
    onboarding_step = EXCLUDED.onboarding_step,
    updated_at = NOW();

-- 2. Create Client Test User
INSERT INTO admin_users (
    email,
    password_hash,
    first_name,
    last_name,
    company,
    role,
    plan,
    status,
    user_type,
    onboarding_completed,
    onboarding_step,
    created_at,
    updated_at
) VALUES (
    'cliente@test.com',
    'fa08e0820ad9f16732052886b64c2e510a0bbc91d7ad0ff412f0a7aa875076a3',
    'Cliente',
    'Test',
    'Mi Tienda',
    'viewer',
    'starter',
    'active',
    'client',
    false,
    0,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    user_type = EXCLUDED.user_type,
    onboarding_completed = EXCLUDED.onboarding_completed,
    onboarding_step = EXCLUDED.onboarding_step,
    updated_at = NOW();

-- Verify the users were created
SELECT id, email, first_name, last_name, user_type, onboarding_completed, onboarding_step, status
FROM admin_users
WHERE email IN ('admin@test.com', 'cliente@test.com');
