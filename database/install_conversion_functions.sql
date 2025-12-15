-- Install Conversion Analytics Functions
-- This script safely installs conversion analytics functions by dropping existing ones first

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_simple_conversion_stats(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_daily_conversion_stats(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_daily_conversion_timeline(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_top_converting_products(TEXT, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS get_top_converting_products_simple(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_attribution_breakdown(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_attribution_window_performance(TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_recent_conversion_activity(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_recent_activity_simple(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_conversion_funnel_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_conversion_trends(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_period_comparison(TEXT, INTEGER);

-- Now install the new functions
-- Function to get simple conversion statistics for a shop
CREATE FUNCTION get_simple_conversion_stats(
    p_shop_domain TEXT,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    total_recommendations BIGINT,
    total_conversions BIGINT,
    conversion_rate DECIMAL(5,2),
    total_revenue DECIMAL(12,2),
    avg_time_to_conversion DECIMAL(8,2),
    avg_order_value DECIMAL(10,2)
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    rec_count BIGINT;
    conv_count BIGINT;
    total_rev DECIMAL(12,2);
    avg_minutes DECIMAL(8,2);
BEGIN
    cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    -- Get recommendation count
    SELECT COUNT(*) INTO rec_count
    FROM simple_recommendations 
    WHERE shop_domain = p_shop_domain 
      AND recommended_at >= cutoff_date;
    
    -- Get conversion metrics
    SELECT 
        COUNT(*),
        COALESCE(SUM(order_amount), 0),
        COALESCE(AVG(minutes_to_conversion), 0)
    INTO conv_count, total_rev, avg_minutes
    FROM simple_conversions 
    WHERE shop_domain = p_shop_domain 
      AND purchased_at >= cutoff_date;
    
    RETURN QUERY SELECT 
        rec_count,
        conv_count,
        CASE 
            WHEN rec_count > 0 THEN (conv_count::DECIMAL / rec_count::DECIMAL * 100)
            ELSE 0 
        END::DECIMAL(5,2),
        total_rev,
        avg_minutes,
        CASE 
            WHEN conv_count > 0 THEN (total_rev / conv_count::DECIMAL)
            ELSE 0 
        END::DECIMAL(10,2);
END;
$$ LANGUAGE plpgsql;

-- Function to get daily conversion data for timeline charts
CREATE FUNCTION get_daily_conversion_timeline(
    p_shop_domain TEXT,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    date_day DATE,
    recommendations_count INTEGER,
    conversions_count INTEGER,
    revenue_amount DECIMAL(10,2),
    conversion_rate DECIMAL(5,2)
) AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CURRENT_DATE - (p_days_back - 1);
    
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(
            start_date,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE AS day
    ),
    daily_recs AS (
        SELECT 
            DATE(recommended_at) AS day,
            COUNT(*)::INTEGER AS recs
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
            AND DATE(recommended_at) >= start_date
        GROUP BY DATE(recommended_at)
    ),
    daily_convs AS (
        SELECT 
            DATE(purchased_at) AS day,
            COUNT(*)::INTEGER AS convs,
            SUM(order_amount)::DECIMAL(10,2) AS revenue
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND DATE(purchased_at) >= start_date
        GROUP BY DATE(purchased_at)
    )
    SELECT 
        dr.day,
        COALESCE(rec.recs, 0),
        COALESCE(conv.convs, 0),
        COALESCE(conv.revenue, 0::DECIMAL(10,2)),
        CASE 
            WHEN COALESCE(rec.recs, 0) > 0 
            THEN (COALESCE(conv.convs, 0)::DECIMAL / rec.recs * 100)
            ELSE 0::DECIMAL(5,2)
        END
    FROM date_range dr
    LEFT JOIN daily_recs rec ON dr.day = rec.day
    LEFT JOIN daily_convs conv ON dr.day = conv.day
    ORDER BY dr.day;
END;
$$ LANGUAGE plpgsql;

-- Function to get top converting products
CREATE FUNCTION get_top_converting_products_simple(
    p_shop_domain TEXT,
    p_days_back INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    product_id TEXT,
    product_title TEXT,
    recommendations_count INTEGER,
    conversions_count INTEGER,
    conversion_rate DECIMAL(5,2),
    total_revenue DECIMAL(10,2),
    avg_time_minutes DECIMAL(8,2)
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    RETURN QUERY
    WITH product_recs AS (
        SELECT 
            COALESCE(product_id, '') AS pid,
            product_title,
            COUNT(*)::INTEGER AS rec_count
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
            AND recommended_at >= cutoff_date
        GROUP BY COALESCE(product_id, ''), product_title
    ),
    product_convs AS (
        SELECT 
            product_id AS pid,
            COUNT(*)::INTEGER AS conv_count,
            SUM(order_amount)::DECIMAL(10,2) AS revenue,
            AVG(minutes_to_conversion)::DECIMAL(8,2) AS avg_time
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= cutoff_date
        GROUP BY product_id
    )
    SELECT 
        pr.pid,
        pr.product_title,
        pr.rec_count,
        COALESCE(pc.conv_count, 0),
        CASE 
            WHEN pr.rec_count > 0 
            THEN (COALESCE(pc.conv_count, 0)::DECIMAL / pr.rec_count * 100)
            ELSE 0::DECIMAL(5,2)
        END,
        COALESCE(pc.revenue, 0::DECIMAL(10,2)),
        COALESCE(pc.avg_time, 0::DECIMAL(8,2))
    FROM product_recs pr
    LEFT JOIN product_convs pc ON pr.pid = pc.pid
    WHERE pr.rec_count > 0
    ORDER BY COALESCE(pc.revenue, 0) DESC, pr.rec_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get attribution window breakdown
CREATE FUNCTION get_attribution_breakdown(
    p_shop_domain TEXT,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    window_name TEXT,
    min_range INTEGER,
    max_range INTEGER,
    conversions_count INTEGER,
    revenue_amount DECIMAL(10,2),
    avg_time DECIMAL(8,2)
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        'Direct (0-30min)'::TEXT,
        0,
        30,
        COUNT(*)::INTEGER,
        SUM(order_amount)::DECIMAL(10,2),
        AVG(minutes_to_conversion)::DECIMAL(8,2)
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at >= cutoff_date
        AND minutes_to_conversion <= 30
        
    UNION ALL
    
    SELECT 
        'Assisted (30min-24h)'::TEXT,
        31,
        1440,
        COUNT(*)::INTEGER,
        SUM(order_amount)::DECIMAL(10,2),
        AVG(minutes_to_conversion)::DECIMAL(8,2)
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at >= cutoff_date
        AND minutes_to_conversion > 30 
        AND minutes_to_conversion <= 1440
        
    UNION ALL
    
    SELECT 
        'View-through (24h-7d)'::TEXT,
        1441,
        10080,
        COUNT(*)::INTEGER,
        SUM(order_amount)::DECIMAL(10,2),
        AVG(minutes_to_conversion)::DECIMAL(8,2)
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at >= cutoff_date
        AND minutes_to_conversion > 1440
        AND minutes_to_conversion <= 10080
        
    ORDER BY min_range;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_simple_conversion_stats(TEXT, INTEGER) IS 'Returns basic conversion statistics for a shop within specified days';
COMMENT ON FUNCTION get_daily_conversion_timeline(TEXT, INTEGER) IS 'Returns daily timeline data for charts showing conversions over time';
COMMENT ON FUNCTION get_top_converting_products_simple(TEXT, INTEGER, INTEGER) IS 'Returns top performing products by revenue and conversion rate';
COMMENT ON FUNCTION get_attribution_breakdown(TEXT, INTEGER) IS 'Returns breakdown of conversions by attribution window (direct/assisted/view-through)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Conversion analytics functions installed successfully!';
    RAISE NOTICE '📊 Available functions:';
    RAISE NOTICE '   - get_simple_conversion_stats(shop_domain, days_back)';
    RAISE NOTICE '   - get_daily_conversion_timeline(shop_domain, days_back)';
    RAISE NOTICE '   - get_top_converting_products_simple(shop_domain, days_back, limit)';
    RAISE NOTICE '   - get_attribution_breakdown(shop_domain, days_back)';
END $$;