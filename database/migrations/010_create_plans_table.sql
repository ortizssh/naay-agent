-- Migration: Create plans table
-- Dynamic plan configuration stored in database instead of hardcoded constants

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,       -- 'free', 'starter', 'professional', 'enterprise'
  name VARCHAR(100) NOT NULL,              -- 'Free', 'Starter', 'Professional', 'Enterprise'
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,           -- Monthly price
  currency VARCHAR(3) DEFAULT 'USD',
  billing_period VARCHAR(20) DEFAULT 'monthly',  -- 'monthly', 'yearly'
  monthly_messages INTEGER NOT NULL DEFAULT 100,  -- -1 = unlimited
  products_limit INTEGER NOT NULL DEFAULT 50,     -- -1 = unlimited
  features JSONB NOT NULL DEFAULT '{}',
  badge_color VARCHAR(50) DEFAULT 'neutral',  -- badge CSS class: 'neutral', 'primary', 'success', 'warning'
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing plans
INSERT INTO plans (slug, name, description, price, currency, monthly_messages, products_limit, features, badge_color, sort_order) VALUES
('free', 'Free', 'Plan gratuito con funcionalidades básicas', 0, 'USD', 100, 50,
 '{"semantic_search": true, "cart_management": true, "analytics": false, "custom_branding": false, "priority_support": false, "api_access": false}',
 'neutral', 0),
('starter', 'Starter', 'Plan inicial para tiendas en crecimiento', 49, 'USD', 1000, 500,
 '{"semantic_search": true, "cart_management": true, "analytics": true, "custom_branding": false, "priority_support": false, "api_access": false}',
 'primary', 1),
('professional', 'Professional', 'Plan profesional para tiendas establecidas', 149, 'USD', 10000, 5000,
 '{"semantic_search": true, "cart_management": true, "analytics": true, "custom_branding": true, "priority_support": true, "api_access": false}',
 'success', 2),
('enterprise', 'Enterprise', 'Plan enterprise con todas las funcionalidades', 499, 'USD', -1, -1,
 '{"semantic_search": true, "cart_management": true, "analytics": true, "custom_branding": true, "priority_support": true, "api_access": true}',
 'warning', 3)
ON CONFLICT (slug) DO NOTHING;
