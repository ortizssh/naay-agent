-- Migration: Drop redundant columns from tenants table
-- These fields now live elsewhere:
--   monthly_messages_limit → plans.monthly_messages
--   monthly_messages_used  → counted from chat_messages (role='agent', current month)
--   products_limit         → plans.products_limit
--   settings               → client_stores (widget config)
--
-- Kept: features (per-tenant override, used in middleware + admin UI)

ALTER TABLE tenants DROP COLUMN IF EXISTS monthly_messages_limit;
ALTER TABLE tenants DROP COLUMN IF EXISTS monthly_messages_used;
ALTER TABLE tenants DROP COLUMN IF EXISTS products_limit;
ALTER TABLE tenants DROP COLUMN IF EXISTS settings;
