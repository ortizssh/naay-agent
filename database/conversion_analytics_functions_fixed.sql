-- Fixed Conversion Analytics Functions for Supabase
-- These functions provide optimized queries for conversion analytics

-- Function to get simple conversion statistics for a shop
CREATE OR REPLACE FUNCTION get_simple_conversion_stats(
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
CREATE OR REPLACE FUNCTION get_daily_conversion_timeline(
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
CREATE OR REPLACE FUNCTION get_top_converting_products_simple(
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
CREATE OR REPLACE FUNCTION get_attribution_breakdown(
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

-- Function to get recent activity (simplified)
CREATE OR REPLACE FUNCTION get_recent_activity_simple(
    p_shop_domain TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    activity_type TEXT,
    activity_time TIMESTAMPTZ,
    product_title TEXT,
    session_id TEXT,
    amount DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    -- Recent recommendations
    SELECT 
        'recommendation'::TEXT,
        recommended_at,
        product_title,
        session_id,
        NULL::DECIMAL(10,2)
    FROM simple_recommendations
    WHERE shop_domain = p_shop_domain
    ORDER BY recommended_at DESC
    LIMIT p_limit / 2
    
    UNION ALL
    
    -- Recent conversions  
    SELECT 
        'conversion'::TEXT,
        purchased_at,
        COALESCE('Product ' || product_id, 'Unknown Product')::TEXT,
        session_id,
        order_amount
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
    ORDER BY purchased_at DESC
    LIMIT p_limit / 2
    
    ORDER BY activity_time DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to compare periods
CREATE OR REPLACE FUNCTION get_period_comparison(
    p_shop_domain TEXT,
    p_current_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    period_name TEXT,
    recommendations INTEGER,
    conversions INTEGER,
    conversion_rate DECIMAL(5,2),
    revenue DECIMAL(10,2),
    change_vs_previous DECIMAL(5,2)
) AS $$
DECLARE
    current_start TIMESTAMPTZ;
    previous_start TIMESTAMPTZ;
    previous_end TIMESTAMPTZ;
    
    current_recs INTEGER;
    current_convs INTEGER;
    current_rev DECIMAL(10,2);
    current_rate DECIMAL(5,2);
    
    previous_recs INTEGER;
    previous_convs INTEGER;
    previous_rev DECIMAL(10,2);
    previous_rate DECIMAL(5,2);
BEGIN
    current_start := NOW() - (p_current_days || ' days')::INTERVAL;
    previous_end := current_start;
    previous_start := previous_end - (p_current_days || ' days')::INTERVAL;
    
    -- Get current period stats
    SELECT 
        COUNT(*)::INTEGER
    INTO current_recs
    FROM simple_recommendations 
    WHERE shop_domain = p_shop_domain 
        AND recommended_at >= current_start;
    
    SELECT 
        COUNT(*)::INTEGER,
        SUM(order_amount)::DECIMAL(10,2)
    INTO current_convs, current_rev
    FROM simple_conversions 
    WHERE shop_domain = p_shop_domain 
        AND purchased_at >= current_start;
    
    current_rate := CASE 
        WHEN current_recs > 0 THEN (current_convs::DECIMAL / current_recs * 100)
        ELSE 0 
    END;
    
    -- Get previous period stats
    SELECT 
        COUNT(*)::INTEGER
    INTO previous_recs
    FROM simple_recommendations 
    WHERE shop_domain = p_shop_domain 
        AND recommended_at >= previous_start
        AND recommended_at < previous_end;
    
    SELECT 
        COUNT(*)::INTEGER,
        SUM(order_amount)::DECIMAL(10,2)
    INTO previous_convs, previous_rev
    FROM simple_conversions 
    WHERE shop_domain = p_shop_domain 
        AND purchased_at >= previous_start
        AND purchased_at < previous_end;
    
    previous_rate := CASE 
        WHEN previous_recs > 0 THEN (previous_convs::DECIMAL / previous_recs * 100)
        ELSE 0 
    END;
    
    RETURN QUERY VALUES 
        ('Current Period', current_recs, current_convs, current_rate, COALESCE(current_rev, 0), 0::DECIMAL(5,2)),
        ('Previous Period', previous_recs, previous_convs, previous_rate, COALESCE(previous_rev, 0), 
         CASE 
             WHEN previous_rate > 0 THEN ((current_rate - previous_rate) / previous_rate * 100)
             ELSE 0 
         END);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_simple_conversion_stats(TEXT, INTEGER) IS 'Returns basic conversion statistics for a shop within specified days';
COMMENT ON FUNCTION get_daily_conversion_timeline(TEXT, INTEGER) IS 'Returns daily timeline data for charts showing conversions over time';
COMMENT ON FUNCTION get_top_converting_products_simple(TEXT, INTEGER, INTEGER) IS 'Returns top performing products by revenue and conversion rate';
COMMENT ON FUNCTION get_attribution_breakdown(TEXT, INTEGER) IS 'Returns breakdown of conversions by attribution window (direct/assisted/view-through)';
COMMENT ON FUNCTION get_recent_activity_simple(TEXT, INTEGER) IS 'Returns recent recommendation and conversion activity';
COMMENT ON FUNCTION get_period_comparison(TEXT, INTEGER) IS 'Compares current period performance vs previous period';