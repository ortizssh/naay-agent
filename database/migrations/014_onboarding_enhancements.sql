-- Migration 014: Onboarding enhancements
-- Adds store metadata columns for improved onboarding flow

-- Store metadata in client_stores
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_currency VARCHAR(10),
ADD COLUMN IF NOT EXISTS shop_country VARCHAR(10),
ADD COLUMN IF NOT EXISTS shop_timezone VARCHAR(100),
ADD COLUMN IF NOT EXISTS shop_locale VARCHAR(20),
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sync_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhooks_configured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Store metadata in stores
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_currency VARCHAR(10),
ADD COLUMN IF NOT EXISTS shop_country VARCHAR(10),
ADD COLUMN IF NOT EXISTS shop_timezone VARCHAR(100);
