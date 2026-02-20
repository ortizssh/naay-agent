-- Migration 021: Fix duplicate recommendations and add unique constraint
-- Run this manually in Supabase SQL Editor

-- Step 1: Delete duplicate recommendations, keeping only the most recent per combo
DELETE FROM simple_recommendations
WHERE id NOT IN (
  SELECT DISTINCT ON (session_id, product_id, shop_domain) id
  FROM simple_recommendations
  ORDER BY session_id, product_id, shop_domain, recommended_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE simple_recommendations
ADD CONSTRAINT uq_simple_recommendations_session_product_shop
UNIQUE (session_id, product_id, shop_domain);
