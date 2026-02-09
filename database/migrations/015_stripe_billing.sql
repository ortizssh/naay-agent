-- 015_stripe_billing.sql
-- Add stripe_price_id to plans table for Stripe Checkout integration

ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255);

-- The actual stripe_price_id values should be populated manually
-- after creating Products + Prices in Stripe Dashboard:
-- UPDATE plans SET stripe_price_id = 'price_xxx' WHERE slug = 'starter';
-- UPDATE plans SET stripe_price_id = 'price_yyy' WHERE slug = 'professional';
-- UPDATE plans SET stripe_price_id = 'price_zzz' WHERE slug = 'enterprise';
