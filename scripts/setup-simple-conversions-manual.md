# Setup Simple Conversion Tracking - Manual Instructions

## Step 1: Execute SQL in Supabase

Go to your Supabase project → SQL Editor and execute the following statements **one by one**:

### Create Tables

```sql
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
```

```sql
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
```

### Create Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_simple_recommendations_shop_expires 
ON simple_recommendations(shop_domain, expires_at);
```

```sql
CREATE INDEX IF NOT EXISTS idx_simple_recommendations_session 
ON simple_recommendations(session_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_simple_recommendations_product 
ON simple_recommendations(product_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_simple_conversions_shop_date 
ON simple_conversions(shop_domain, purchased_at);
```

```sql
CREATE INDEX IF NOT EXISTS idx_simple_conversions_session 
ON simple_conversions(session_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_simple_conversions_product 
ON simple_conversions(product_id);
```

### Create Functions

```sql
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
```

```sql
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
```

## Step 2: Test the Setup

### Verify Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('simple_recommendations', 'simple_conversions');
```

### Test the Function
```sql
SELECT * FROM get_simple_conversion_stats('test.myshopify.com', 7);
```

## Step 3: Deploy Application

After the SQL setup is complete:

1. **Build and deploy the application:**
   ```bash
   npm run build
   # Deploy to your hosting platform
   ```

2. **Update Shopify webhooks:**
   ```bash
   npm run shopify:deploy
   ```

3. **Verify webhooks are registered:**
   - Go to Shopify Partner Dashboard → Apps → Your App → App setup
   - Check that `orders/create` and `orders/paid` webhooks are listed

## Step 4: Test the System

### Test Recommendation Tracking
```bash
curl -X POST https://your-app-domain.com/api/simple-conversions/test-recommendation \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "shopDomain": "your-store.myshopify.com",
    "productId": "123456789",
    "productTitle": "Test Product"
  }'
```

### Monitor Dashboard
```bash
curl "https://your-app-domain.com/api/simple-conversions/dashboard?shop=your-store.myshopify.com"
```

### Check Active Recommendations
```sql
SELECT * FROM simple_recommendations 
WHERE shop_domain = 'your-store.myshopify.com'
  AND expires_at > NOW()
ORDER BY recommended_at DESC;
```

## Step 5: Monitor in Production

1. **Check conversion stats:** `/api/simple-conversions/stats?shop=your-store.myshopify.com&days=7`
2. **View recent conversions:** `/api/simple-conversions/conversions?shop=your-store.myshopify.com`
3. **Monitor logs** for webhook processing and conversion detection
4. **Set up cleanup job** to run `cleanup_expired_simple_recommendations()` periodically

## Troubleshooting

### If no conversions are detected:
1. Check webhook delivery in Shopify Partner Dashboard
2. Verify order webhooks are reaching your endpoints
3. Check application logs for webhook processing
4. Ensure products have correct IDs in recommendations

### If performance issues:
1. Monitor index usage with `EXPLAIN ANALYZE`
2. Run cleanup function more frequently
3. Consider adding more specific indexes based on query patterns