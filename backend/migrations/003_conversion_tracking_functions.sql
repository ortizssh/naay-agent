-- Additional stored functions for conversion tracking analytics

-- Function to get basic conversion metrics
CREATE OR REPLACE FUNCTION get_conversion_metrics(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE (
    attributed_cart_additions BIGINT,
    attributed_orders BIGINT,
    attributed_revenue DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ae.cart_addition_event_id) as attributed_cart_additions,
        COUNT(DISTINCT ae.order_line_item_id) as attributed_orders,
        COALESCE(SUM(ae.attributed_revenue), 0) as attributed_revenue
    FROM attribution_events ae
    JOIN ai_recommendation_events are ON ae.recommendation_event_id = are.id
    WHERE ae.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to;
END;
$$ LANGUAGE plpgsql;

-- Function to get top converting products
CREATE OR REPLACE FUNCTION get_top_converting_products(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    product_id VARCHAR(255),
    product_title VARCHAR(500),
    recommendations BIGINT,
    conversions BIGINT,
    revenue DECIMAL(12,2),
    conversion_rate DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        are.recommended_product_id as product_id,
        COALESCE(p.title, 'Unknown Product') as product_title,
        COUNT(are.id) as recommendations,
        COUNT(ae.order_line_item_id) as conversions,
        COALESCE(SUM(ae.attributed_revenue), 0) as revenue,
        CASE 
            WHEN COUNT(are.id) > 0 THEN COUNT(ae.order_line_item_id)::DECIMAL / COUNT(are.id)
            ELSE 0 
        END as conversion_rate
    FROM ai_recommendation_events are
    LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
    LEFT JOIN products p ON p.id = are.recommended_product_id AND p.shop_domain = are.shop_domain
    WHERE are.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    GROUP BY are.recommended_product_id, p.title
    HAVING COUNT(are.id) > 0
    ORDER BY conversions DESC, revenue DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get performance by recommendation type
CREATE OR REPLACE FUNCTION get_recommendation_type_performance(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE (
    recommendation_type VARCHAR(50),
    recommendations BIGINT,
    conversions BIGINT,
    revenue DECIMAL(12,2),
    conversion_rate DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        are.recommendation_type,
        COUNT(are.id) as recommendations,
        COUNT(ae.order_line_item_id) as conversions,
        COALESCE(SUM(ae.attributed_revenue), 0) as revenue,
        CASE 
            WHEN COUNT(are.id) > 0 THEN COUNT(ae.order_line_item_id)::DECIMAL / COUNT(are.id)
            ELSE 0 
        END as conversion_rate
    FROM ai_recommendation_events are
    LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
    WHERE are.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    GROUP BY are.recommendation_type
    ORDER BY conversions DESC, revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get funnel metrics for a specific session
CREATE OR REPLACE FUNCTION get_session_funnel_metrics(
    p_session_id UUID,
    p_shop_domain VARCHAR(255)
)
RETURNS TABLE (
    session_id UUID,
    total_recommendations INTEGER,
    unique_products_recommended INTEGER,
    cart_additions INTEGER,
    orders INTEGER,
    session_revenue DECIMAL(12,2),
    session_start TIMESTAMP WITH TIME ZONE,
    session_last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id as session_id,
        COUNT(DISTINCT are.id)::INTEGER as total_recommendations,
        COUNT(DISTINCT are.recommended_product_id)::INTEGER as unique_products_recommended,
        COUNT(DISTINCT ae.cart_addition_event_id)::INTEGER as cart_additions,
        COUNT(DISTINCT ae.order_line_item_id)::INTEGER as orders,
        COALESCE(SUM(ae.attributed_revenue), 0) as session_revenue,
        cs.started_at as session_start,
        cs.last_activity as session_last_activity
    FROM chat_sessions cs
    LEFT JOIN ai_recommendation_events are ON are.session_id = cs.id
    LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
    WHERE cs.id = p_session_id
    AND cs.shop_domain = p_shop_domain
    GROUP BY cs.id, cs.started_at, cs.last_activity;
END;
$$ LANGUAGE plpgsql;

-- Function to get time-to-conversion metrics
CREATE OR REPLACE FUNCTION get_time_to_conversion_metrics(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE (
    avg_time_to_cart_hours DECIMAL(8,2),
    avg_time_to_purchase_hours DECIMAL(8,2),
    median_time_to_cart_hours DECIMAL(8,2),
    median_time_to_purchase_hours DECIMAL(8,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(ae.time_to_cart_minutes / 60.0) as avg_time_to_cart_hours,
        AVG(ae.time_to_purchase_minutes / 60.0) as avg_time_to_purchase_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ae.time_to_cart_minutes / 60.0) as median_time_to_cart_hours,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ae.time_to_purchase_minutes / 60.0) as median_time_to_purchase_hours
    FROM attribution_events ae
    JOIN ai_recommendation_events are ON ae.recommendation_event_id = are.id
    WHERE ae.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    AND ae.time_to_cart_minutes IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get cohort analysis data
CREATE OR REPLACE FUNCTION get_conversion_cohort_analysis(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE,
    p_cohort_period VARCHAR(20) DEFAULT 'daily' -- 'daily', 'weekly', 'monthly'
)
RETURNS TABLE (
    cohort_period DATE,
    total_recommendations INTEGER,
    day_0_conversions INTEGER,
    day_1_conversions INTEGER,
    day_7_conversions INTEGER,
    day_30_conversions INTEGER,
    total_conversions INTEGER
) AS $$
DECLARE
    date_format VARCHAR(20);
BEGIN
    -- Determine date truncation based on cohort period
    date_format := CASE 
        WHEN p_cohort_period = 'weekly' THEN 'week'
        WHEN p_cohort_period = 'monthly' THEN 'month'
        ELSE 'day'
    END;

    RETURN QUERY
    SELECT 
        DATE_TRUNC(date_format, are.created_at)::DATE as cohort_period,
        COUNT(DISTINCT are.id)::INTEGER as total_recommendations,
        COUNT(DISTINCT CASE 
            WHEN ae.time_to_purchase_minutes <= 0 THEN ae.order_line_item_id 
            ELSE NULL 
        END)::INTEGER as day_0_conversions,
        COUNT(DISTINCT CASE 
            WHEN ae.time_to_purchase_minutes <= 1440 THEN ae.order_line_item_id 
            ELSE NULL 
        END)::INTEGER as day_1_conversions,
        COUNT(DISTINCT CASE 
            WHEN ae.time_to_purchase_minutes <= 10080 THEN ae.order_line_item_id 
            ELSE NULL 
        END)::INTEGER as day_7_conversions,
        COUNT(DISTINCT CASE 
            WHEN ae.time_to_purchase_minutes <= 43200 THEN ae.order_line_item_id 
            ELSE NULL 
        END)::INTEGER as day_30_conversions,
        COUNT(DISTINCT ae.order_line_item_id)::INTEGER as total_conversions
    FROM ai_recommendation_events are
    LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
    WHERE are.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    GROUP BY DATE_TRUNC(date_format, are.created_at)
    ORDER BY cohort_period;
END;
$$ LANGUAGE plpgsql;

-- Function to get recommendation effectiveness by position
CREATE OR REPLACE FUNCTION get_position_effectiveness(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE (
    recommendation_position INTEGER,
    recommendations BIGINT,
    conversions BIGINT,
    conversion_rate DECIMAL(5,4),
    avg_revenue_per_recommendation DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        are.recommendation_position,
        COUNT(are.id) as recommendations,
        COUNT(ae.order_line_item_id) as conversions,
        CASE 
            WHEN COUNT(are.id) > 0 THEN COUNT(ae.order_line_item_id)::DECIMAL / COUNT(are.id)
            ELSE 0 
        END as conversion_rate,
        CASE 
            WHEN COUNT(are.id) > 0 THEN COALESCE(SUM(ae.attributed_revenue), 0) / COUNT(are.id)
            ELSE 0 
        END as avg_revenue_per_recommendation
    FROM ai_recommendation_events are
    LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
    WHERE are.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    AND are.recommendation_position IS NOT NULL
    GROUP BY are.recommendation_position
    ORDER BY are.recommendation_position;
END;
$$ LANGUAGE plpgsql;

-- Function to detect potential attribution conflicts
CREATE OR REPLACE FUNCTION detect_attribution_conflicts(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE (
    order_line_item_id UUID,
    product_id VARCHAR(255),
    conflicting_recommendations INTEGER,
    total_attributed_revenue DECIMAL(12,2),
    actual_line_item_revenue DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.order_line_item_id,
        oli.product_id,
        COUNT(DISTINCT ae.recommendation_event_id)::INTEGER as conflicting_recommendations,
        SUM(ae.attributed_revenue) as total_attributed_revenue,
        oli.total_price as actual_line_item_revenue
    FROM attribution_events ae
    JOIN order_line_items oli ON ae.order_line_item_id = oli.id
    JOIN ai_recommendation_events are ON ae.recommendation_event_id = are.id
    WHERE ae.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to
    AND ae.order_line_item_id IS NOT NULL
    GROUP BY ae.order_line_item_id, oli.product_id, oli.total_price
    HAVING COUNT(DISTINCT ae.recommendation_event_id) > 1
    OR SUM(ae.attributed_revenue) > oli.total_price
    ORDER BY conflicting_recommendations DESC, total_attributed_revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up and normalize attribution weights
CREATE OR REPLACE FUNCTION normalize_attribution_weights(
    p_shop_domain VARCHAR(255)
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    conflict_record RECORD;
    total_weight DECIMAL(10,4);
    normalized_weight DECIMAL(5,4);
BEGIN
    -- Find order line items with over-attribution
    FOR conflict_record IN
        SELECT 
            ae.order_line_item_id,
            oli.total_price,
            SUM(ae.attributed_revenue) as total_attributed,
            COUNT(*) as attribution_count
        FROM attribution_events ae
        JOIN order_line_items oli ON ae.order_line_item_id = oli.id
        WHERE ae.shop_domain = p_shop_domain
        AND ae.order_line_item_id IS NOT NULL
        GROUP BY ae.order_line_item_id, oli.total_price
        HAVING SUM(ae.attributed_revenue) > oli.total_price
    LOOP
        -- Calculate normalized weights
        SELECT SUM(attribution_weight) INTO total_weight
        FROM attribution_events
        WHERE order_line_item_id = conflict_record.order_line_item_id;
        
        -- Update attribution weights and revenue
        UPDATE attribution_events
        SET 
            attribution_weight = (attribution_weight / total_weight),
            attributed_revenue = (conflict_record.total_price * (attribution_weight / total_weight))
        WHERE order_line_item_id = conflict_record.order_line_item_id;
        
        updated_count := updated_count + conflict_record.attribution_count;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for the new functions
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_date ON ai_recommendation_events(shop_domain, date(created_at));
CREATE INDEX IF NOT EXISTS idx_attribution_events_shop_date ON attribution_events(shop_domain, date(created_at));
CREATE INDEX IF NOT EXISTS idx_order_completion_shop_order_date ON order_completion_events(shop_domain, date(order_created_at));

-- Create a view for easy conversion funnel analysis
CREATE OR REPLACE VIEW conversion_funnel_daily AS
SELECT 
    are.shop_domain,
    DATE(are.created_at) as recommendation_date,
    are.recommendation_type,
    COUNT(DISTINCT are.id) as total_recommendations,
    COUNT(DISTINCT ae.cart_addition_event_id) as cart_conversions,
    COUNT(DISTINCT ae.order_line_item_id) as purchase_conversions,
    COALESCE(SUM(ae.attributed_revenue), 0) as attributed_revenue,
    CASE 
        WHEN COUNT(DISTINCT are.id) > 0 THEN COUNT(DISTINCT ae.cart_addition_event_id)::DECIMAL / COUNT(DISTINCT are.id)
        ELSE 0 
    END as cart_conversion_rate,
    CASE 
        WHEN COUNT(DISTINCT are.id) > 0 THEN COUNT(DISTINCT ae.order_line_item_id)::DECIMAL / COUNT(DISTINCT are.id)
        ELSE 0 
    END as purchase_conversion_rate
FROM ai_recommendation_events are
LEFT JOIN attribution_events ae ON ae.recommendation_event_id = are.id
GROUP BY are.shop_domain, DATE(are.created_at), are.recommendation_type
ORDER BY recommendation_date DESC, total_recommendations DESC;