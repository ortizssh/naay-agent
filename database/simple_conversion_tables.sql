-- Simple conversion tracking tables for 10-minute attribution window

-- Table to store AI recommendations with expiration
CREATE TABLE IF NOT EXISTS simple_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT,
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 10 minutes after recommended_at
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table to store successful conversions
CREATE TABLE IF NOT EXISTS simple_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  recommended_at TIMESTAMPTZ NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL,
  minutes_to_conversion INTEGER NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  order_quantity INTEGER NOT NULL DEFAULT 1,
  order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, order_id, product_id) -- Prevent duplicate conversions
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simple_recommendations_shop_expires 
ON simple_recommendations(shop_domain, expires_at);

CREATE INDEX IF NOT EXISTS idx_simple_recommendations_session 
ON simple_recommendations(session_id);

CREATE INDEX IF NOT EXISTS idx_simple_recommendations_product 
ON simple_recommendations(product_id);

-- Removed problematic index with NOW() function
-- CREATE INDEX IF NOT EXISTS idx_simple_recommendations_window 
-- ON simple_recommendations(shop_domain, recommended_at) 
-- WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_simple_conversions_shop_date 
ON simple_conversions(shop_domain, purchased_at);

CREATE INDEX IF NOT EXISTS idx_simple_conversions_session 
ON simple_conversions(session_id);

CREATE INDEX IF NOT EXISTS idx_simple_conversions_product 
ON simple_conversions(product_id);

-- Auto-cleanup function to remove expired recommendations
CREATE OR REPLACE FUNCTION cleanup_expired_simple_recommendations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM simple_recommendations 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup if any rows were deleted
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired simple recommendations', deleted_count;
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversion stats for a shop
CREATE OR REPLACE FUNCTION get_simple_conversion_stats(
  p_shop_domain TEXT,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
  total_recommendations BIGINT,
  total_conversions BIGINT,
  conversion_rate DECIMAL(5,2),
  avg_minutes_to_conversion DECIMAL(8,2),
  total_revenue DECIMAL(12,2)
) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH stats AS (
    SELECT 
      (SELECT COUNT(*) 
       FROM simple_recommendations 
       WHERE shop_domain = p_shop_domain 
         AND recommended_at >= cutoff_date) AS recs,
      (SELECT COUNT(*) 
       FROM simple_conversions 
       WHERE shop_domain = p_shop_domain 
         AND purchased_at >= cutoff_date) AS convs,
      (SELECT AVG(minutes_to_conversion) 
       FROM simple_conversions 
       WHERE shop_domain = p_shop_domain 
         AND purchased_at >= cutoff_date) AS avg_mins,
      (SELECT SUM(order_amount) 
       FROM simple_conversions 
       WHERE shop_domain = p_shop_domain 
         AND purchased_at >= cutoff_date) AS revenue
  )
  SELECT 
    stats.recs,
    stats.convs,
    CASE 
      WHEN stats.recs > 0 THEN (stats.convs::DECIMAL / stats.recs::DECIMAL * 100)
      ELSE 0 
    END,
    COALESCE(stats.avg_mins, 0),
    COALESCE(stats.revenue, 0)
  FROM stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE simple_recommendations IS 'Tracks AI product recommendations with 10-minute expiration for simple conversion attribution';
COMMENT ON TABLE simple_conversions IS 'Tracks successful conversions from AI recommendations to purchases within 10 minutes';
COMMENT ON FUNCTION cleanup_expired_simple_recommendations() IS 'Removes recommendations older than their expiration time';
COMMENT ON FUNCTION get_simple_conversion_stats(TEXT, INTEGER) IS 'Returns conversion statistics for a shop within specified days';