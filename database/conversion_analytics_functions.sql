-- Conversion Analytics Functions for Supabase
-- These functions provide optimized queries for conversion analytics

-- Function to get daily conversion statistics
CREATE OR REPLACE FUNCTION get_daily_conversion_stats(
    p_shop_domain TEXT,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    date TEXT,
    recommendations INTEGER,
    conversions INTEGER,
    revenue DECIMAL(10,2),
    conversion_rate DECIMAL(5,2)
) AS $$
DECLARE
    start_date DATE;
BEGIN
    start_date := CURRENT_DATE - INTERVAL '1 day' * (p_days_back - 1);
    
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            start_date,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::date AS date
    ),
    daily_recommendations AS (
        SELECT 
            DATE(recommended_at) AS date,
            COUNT(*) AS recommendations
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
            AND DATE(recommended_at) >= start_date
        GROUP BY DATE(recommended_at)
    ),
    daily_conversions AS (
        SELECT 
            DATE(purchased_at) AS date,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND DATE(purchased_at) >= start_date
        GROUP BY DATE(purchased_at)
    )
    SELECT 
        ds.date::TEXT,
        COALESCE(dr.recommendations, 0)::INTEGER,
        COALESCE(dc.conversions, 0)::INTEGER,
        COALESCE(dc.revenue, 0)::DECIMAL(10,2),
        CASE 
            WHEN COALESCE(dr.recommendations, 0) > 0 
            THEN (COALESCE(dc.conversions, 0)::DECIMAL / dr.recommendations * 100)
            ELSE 0 
        END::DECIMAL(5,2)
    FROM date_series ds
    LEFT JOIN daily_recommendations dr ON ds.date = dr.date
    LEFT JOIN daily_conversions dc ON ds.date = dc.date
    ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;

-- Function to get top converting products
CREATE OR REPLACE FUNCTION get_top_converting_products(
    p_shop_domain TEXT,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    product_id TEXT,
    product_title TEXT,
    recommendations INTEGER,
    conversions INTEGER,
    conversion_rate DECIMAL(5,2),
    revenue DECIMAL(10,2),
    avg_time_to_conversion DECIMAL(8,2)
) AS $$
DECLARE
    filter_date TIMESTAMPTZ;
BEGIN
    filter_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    
    RETURN QUERY
    WITH product_recommendations AS (
        SELECT 
            COALESCE(product_id, product_title) AS product_key,
            product_id,
            product_title,
            COUNT(*) AS recommendations
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
            AND recommended_at >= filter_date
        GROUP BY COALESCE(product_id, product_title), product_id, product_title
    ),
    product_conversions AS (
        SELECT 
            product_id AS product_key,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue,
            AVG(minutes_to_conversion) AS avg_minutes
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= filter_date
        GROUP BY product_id
    )
    SELECT 
        pr.product_id,
        pr.product_title,
        pr.recommendations::INTEGER,
        COALESCE(pc.conversions, 0)::INTEGER,
        CASE 
            WHEN pr.recommendations > 0 
            THEN (COALESCE(pc.conversions, 0)::DECIMAL / pr.recommendations * 100)
            ELSE 0 
        END::DECIMAL(5,2),
        COALESCE(pc.revenue, 0)::DECIMAL(10,2),
        COALESCE(pc.avg_minutes, 0)::DECIMAL(8,2)
    FROM product_recommendations pr
    LEFT JOIN product_conversions pc ON pr.product_key = pc.product_key
    WHERE pr.recommendations > 0
    ORDER BY COALESCE(pc.revenue, 0) DESC, pr.recommendations DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate conversion funnel metrics
CREATE OR REPLACE FUNCTION get_conversion_funnel_stats(
    p_shop_domain TEXT,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    stage TEXT,
    count INTEGER,
    percentage DECIMAL(5,2)
) AS $$
DECLARE
    filter_start TIMESTAMPTZ;
    filter_end TIMESTAMPTZ;
    total_recommendations INTEGER;
    total_conversions INTEGER;
    direct_conversions INTEGER;
    assisted_conversions INTEGER;
    view_through_conversions INTEGER;
BEGIN
    filter_start := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    filter_end := COALESCE(p_end_date, NOW());
    
    -- Get total recommendations
    SELECT COUNT(*) INTO total_recommendations
    FROM simple_recommendations
    WHERE shop_domain = p_shop_domain
        AND recommended_at BETWEEN filter_start AND filter_end;
    
    -- Get total conversions
    SELECT COUNT(*) INTO total_conversions
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at BETWEEN filter_start AND filter_end;
    
    -- Get conversions by attribution window
    SELECT 
        COUNT(*) FILTER (WHERE minutes_to_conversion <= 30) INTO direct_conversions,
        COUNT(*) FILTER (WHERE minutes_to_conversion > 30 AND minutes_to_conversion <= 1440) INTO assisted_conversions,
        COUNT(*) FILTER (WHERE minutes_to_conversion > 1440) INTO view_through_conversions
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at BETWEEN filter_start AND filter_end;
    
    -- Return funnel data
    RETURN QUERY VALUES 
        ('Recommendations', total_recommendations, 100.0),
        ('Total Conversions', total_conversions, 
         CASE WHEN total_recommendations > 0 
              THEN (total_conversions::DECIMAL / total_recommendations * 100)
              ELSE 0 END),
        ('Direct (0-30min)', direct_conversions,
         CASE WHEN total_recommendations > 0 
              THEN (direct_conversions::DECIMAL / total_recommendations * 100)
              ELSE 0 END),
        ('Assisted (30min-24h)', assisted_conversions,
         CASE WHEN total_recommendations > 0 
              THEN (assisted_conversions::DECIMAL / total_recommendations * 100)
              ELSE 0 END),
        ('View-through (24h+)', view_through_conversions,
         CASE WHEN total_recommendations > 0 
              THEN (view_through_conversions::DECIMAL / total_recommendations * 100)
              ELSE 0 END);
END;
$$ LANGUAGE plpgsql;

-- Function to get conversion performance over time periods
CREATE OR REPLACE FUNCTION get_conversion_trends(
    p_shop_domain TEXT,
    p_period TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    period TEXT,
    recommendations INTEGER,
    conversions INTEGER,
    revenue DECIMAL(10,2),
    conversion_rate DECIMAL(5,2),
    avg_order_value DECIMAL(10,2)
) AS $$
DECLARE
    start_date TIMESTAMPTZ;
    date_format TEXT;
    interval_expr TEXT;
BEGIN
    start_date := NOW() - (p_days_back || ' days')::INTERVAL;
    
    -- Set date formatting based on period
    CASE p_period
        WHEN 'weekly' THEN 
            date_format := 'YYYY-"W"WW';
            interval_expr := '1 week';
        WHEN 'monthly' THEN 
            date_format := 'YYYY-MM';
            interval_expr := '1 month';
        ELSE -- daily
            date_format := 'YYYY-MM-DD';
            interval_expr := '1 day';
    END CASE;
    
    RETURN QUERY
    WITH period_recommendations AS (
        SELECT 
            to_char(recommended_at, date_format) AS period,
            COUNT(*) AS recommendations
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
            AND recommended_at >= start_date
        GROUP BY to_char(recommended_at, date_format)
    ),
    period_conversions AS (
        SELECT 
            to_char(purchased_at, date_format) AS period,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= start_date
        GROUP BY to_char(purchased_at, date_format)
    )
    SELECT 
        COALESCE(pr.period, pc.period),
        COALESCE(pr.recommendations, 0)::INTEGER,
        COALESCE(pc.conversions, 0)::INTEGER,
        COALESCE(pc.revenue, 0)::DECIMAL(10,2),
        CASE 
            WHEN COALESCE(pr.recommendations, 0) > 0 
            THEN (COALESCE(pc.conversions, 0)::DECIMAL / pr.recommendations * 100)
            ELSE 0 
        END::DECIMAL(5,2),
        CASE 
            WHEN COALESCE(pc.conversions, 0) > 0 
            THEN (pc.revenue / pc.conversions)
            ELSE 0 
        END::DECIMAL(10,2)
    FROM period_recommendations pr
    FULL OUTER JOIN period_conversions pc ON pr.period = pc.period
    ORDER BY COALESCE(pr.period, pc.period);
END;
$$ LANGUAGE plpgsql;

-- Function to get real-time conversion activity
CREATE OR REPLACE FUNCTION get_recent_conversion_activity(
    p_shop_domain TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    activity_type TEXT,
    activity_timestamp TIMESTAMPTZ,
    product_title TEXT,
    session_id TEXT,
    amount DECIMAL(10,2),
    minutes_to_conversion INTEGER
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Recent recommendations
        SELECT 
            'recommendation'::TEXT AS activity_type,
            recommended_at AS activity_timestamp,
            product_title,
            session_id,
            NULL::DECIMAL(10,2) AS amount,
            NULL::INTEGER AS minutes_to_conversion
        FROM simple_recommendations
        WHERE shop_domain = p_shop_domain
        ORDER BY recommended_at DESC
        LIMIT p_limit / 2
    )
    UNION ALL
    (
        -- Recent conversions
        SELECT 
            'conversion'::TEXT AS activity_type,
            purchased_at AS activity_timestamp,
            ('Product ' || product_id)::TEXT AS product_title, -- We'd need to join with products table for actual titles
            session_id,
            order_amount AS amount,
            minutes_to_conversion
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
        ORDER BY purchased_at DESC
        LIMIT p_limit / 2
    )
    ORDER BY activity_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate attribution window performance
CREATE OR REPLACE FUNCTION get_attribution_window_performance(
    p_shop_domain TEXT,
    p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    window_name TEXT,
    time_range TEXT,
    conversions INTEGER,
    revenue DECIMAL(10,2),
    avg_time_minutes DECIMAL(8,2),
    percentage_of_total DECIMAL(5,2)
) AS $$
DECLARE
    filter_date TIMESTAMPTZ;
    total_conversions INTEGER;
BEGIN
    filter_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    
    SELECT COUNT(*) INTO total_conversions
    FROM simple_conversions
    WHERE shop_domain = p_shop_domain
        AND purchased_at >= filter_date;
    
    RETURN QUERY
    SELECT 
        window_stats.window_name,
        window_stats.time_range,
        window_stats.conversions::INTEGER,
        window_stats.revenue::DECIMAL(10,2),
        window_stats.avg_time::DECIMAL(8,2),
        CASE 
            WHEN total_conversions > 0 
            THEN (window_stats.conversions::DECIMAL / total_conversions * 100)
            ELSE 0 
        END::DECIMAL(5,2)
    FROM (
        SELECT 
            'Direct' AS window_name,
            '0-30 minutes' AS time_range,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue,
            AVG(minutes_to_conversion) AS avg_time
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= filter_date
            AND minutes_to_conversion <= 30
            
        UNION ALL
        
        SELECT 
            'Assisted' AS window_name,
            '30min-24h' AS time_range,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue,
            AVG(minutes_to_conversion) AS avg_time
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= filter_date
            AND minutes_to_conversion > 30 
            AND minutes_to_conversion <= 1440
            
        UNION ALL
        
        SELECT 
            'View-through' AS window_name,
            '24h-7 days' AS time_range,
            COUNT(*) AS conversions,
            SUM(order_amount) AS revenue,
            AVG(minutes_to_conversion) AS avg_time
        FROM simple_conversions
        WHERE shop_domain = p_shop_domain
            AND purchased_at >= filter_date
            AND minutes_to_conversion > 1440
    ) window_stats
    ORDER BY window_stats.conversions DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION get_daily_conversion_stats(TEXT, INTEGER) IS 'Returns daily conversion statistics with recommendations, conversions, revenue and rates';
COMMENT ON FUNCTION get_top_converting_products(TEXT, TIMESTAMPTZ, INTEGER) IS 'Returns top performing products by conversion rate and revenue';
COMMENT ON FUNCTION get_conversion_funnel_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns conversion funnel metrics showing recommendation to conversion flow';
COMMENT ON FUNCTION get_conversion_trends(TEXT, TEXT, INTEGER) IS 'Returns conversion trends over time periods (daily/weekly/monthly)';
COMMENT ON FUNCTION get_recent_conversion_activity(TEXT, INTEGER) IS 'Returns recent recommendation and conversion activity for real-time dashboard';
COMMENT ON FUNCTION get_attribution_window_performance(TEXT, TIMESTAMPTZ) IS 'Returns performance metrics by attribution window (direct/assisted/view-through)';