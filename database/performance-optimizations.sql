-- Performance Optimizations for Admin Analytics
-- This file contains indexes and stored procedures to optimize analytics queries

-- ============================================================================
-- MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index for chat_sessions filtering and sorting
CREATE INDEX IF NOT EXISTS idx_chat_sessions_shop_status_activity 
ON chat_sessions(shop_domain, status, last_activity DESC);

-- Composite index for chat_messages session and timestamp queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp 
ON chat_messages(session_id, timestamp ASC);

-- Index for chat_messages role filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_role 
ON chat_messages(role);

-- Composite index for analytics date range queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_shop_started_at 
ON chat_sessions(shop_domain, started_at);

-- ============================================================================
-- OPTIMIZED STORED PROCEDURES
-- ============================================================================

-- Optimized conversation retrieval with proper aggregation
CREATE OR REPLACE FUNCTION get_conversations_optimized(
    shop_domain_param VARCHAR(255),
    limit_param INTEGER DEFAULT 10,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
    session_id UUID,
    total_messages INTEGER,
    user_messages INTEGER,
    ai_messages INTEGER,
    first_message TEXT,
    last_activity TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH session_stats AS (
        SELECT 
            cs.id as session_id,
            cs.last_activity,
            COUNT(cm.id) as total_messages,
            COUNT(CASE WHEN cm.role = 'user' THEN 1 END)::INTEGER as user_messages,
            COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END)::INTEGER as ai_messages,
            (
                SELECT content 
                FROM chat_messages cm2 
                WHERE cm2.session_id = cs.id 
                ORDER BY cm2.timestamp ASC 
                LIMIT 1
            ) as first_message
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cs.id = cm.session_id
        WHERE cs.shop_domain = shop_domain_param
            AND cs.status = 'active'
        GROUP BY cs.id, cs.last_activity
        ORDER BY cs.last_activity DESC
        LIMIT limit_param OFFSET offset_param
    )
    SELECT 
        ss.session_id,
        ss.total_messages,
        ss.user_messages,
        ss.ai_messages,
        COALESCE(ss.first_message, 'Sin mensaje inicial') as first_message,
        ss.last_activity
    FROM session_stats ss;
END;
$$;

-- Optimized daily conversation statistics
CREATE OR REPLACE FUNCTION get_daily_conversation_stats(
    shop_domain_param VARCHAR(255),
    start_date_param DATE,
    end_date_param DATE
)
RETURNS TABLE (
    date DATE,
    conversations INTEGER,
    sales DECIMAL(10,2),
    orders_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            start_date_param::DATE,
            end_date_param::DATE,
            '1 day'::INTERVAL
        )::DATE as date
    ),
    daily_conversations AS (
        SELECT 
            DATE(cs.started_at) as conversation_date,
            COUNT(DISTINCT cs.id) as conversation_count
        FROM chat_sessions cs
        WHERE cs.shop_domain = shop_domain_param
            AND DATE(cs.started_at) BETWEEN start_date_param AND end_date_param
        GROUP BY DATE(cs.started_at)
    )
    SELECT 
        ds.date,
        COALESCE(dc.conversation_count, 0)::INTEGER as conversations,
        0.00::DECIMAL(10,2) as sales, -- Placeholder for future Shopify integration
        0::INTEGER as orders_count -- Placeholder for future Shopify integration
    FROM date_series ds
    LEFT JOIN daily_conversations dc ON ds.date = dc.conversation_date
    ORDER BY ds.date;
END;
$$;

-- Function to get conversation analytics summary
CREATE OR REPLACE FUNCTION get_conversation_analytics_summary(
    shop_domain_param VARCHAR(255),
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_conversations INTEGER,
    total_messages INTEGER,
    avg_messages_per_conversation NUMERIC(10,2),
    active_conversations INTEGER,
    completed_conversations INTEGER,
    abandoned_conversations INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT cs.id)::INTEGER as total_conversations,
        COUNT(cm.id)::INTEGER as total_messages,
        CASE 
            WHEN COUNT(DISTINCT cs.id) > 0 
            THEN (COUNT(cm.id)::NUMERIC / COUNT(DISTINCT cs.id))::NUMERIC(10,2)
            ELSE 0::NUMERIC(10,2)
        END as avg_messages_per_conversation,
        COUNT(CASE WHEN cs.status = 'active' THEN 1 END)::INTEGER as active_conversations,
        COUNT(CASE WHEN cs.status = 'completed' THEN 1 END)::INTEGER as completed_conversations,
        COUNT(CASE WHEN cs.status = 'abandoned' THEN 1 END)::INTEGER as abandoned_conversations
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cs.id = cm.session_id
    WHERE cs.shop_domain = shop_domain_param
        AND cs.started_at >= start_date;
END;
$$;

-- ============================================================================
-- QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Function to analyze query performance (for debugging)
CREATE OR REPLACE FUNCTION analyze_chat_performance(
    shop_domain_param VARCHAR(255)
)
RETURNS TABLE (
    metric_name TEXT,
    metric_value BIGINT,
    description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'total_chat_sessions'::TEXT as metric_name,
        COUNT(*)::BIGINT as metric_value,
        'Total number of chat sessions for this shop'::TEXT as description
    FROM chat_sessions 
    WHERE shop_domain = shop_domain_param
    
    UNION ALL
    
    SELECT 
        'total_chat_messages'::TEXT,
        COUNT(*)::BIGINT,
        'Total number of chat messages for this shop'::TEXT
    FROM chat_messages cm
    JOIN chat_sessions cs ON cm.session_id = cs.id
    WHERE cs.shop_domain = shop_domain_param
    
    UNION ALL
    
    SELECT 
        'avg_messages_per_session'::TEXT,
        (
            SELECT COUNT(*)::BIGINT
            FROM chat_messages cm
            JOIN chat_sessions cs ON cm.session_id = cs.id
            WHERE cs.shop_domain = shop_domain_param
        ) / GREATEST(1, (
            SELECT COUNT(*)::BIGINT
            FROM chat_sessions 
            WHERE shop_domain = shop_domain_param
        )),
        'Average number of messages per session'::TEXT
    
    UNION ALL
    
    SELECT 
        'sessions_last_7_days'::TEXT,
        COUNT(*)::BIGINT,
        'Chat sessions in the last 7 days'::TEXT
    FROM chat_sessions
    WHERE shop_domain = shop_domain_param
        AND started_at >= NOW() - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
        'messages_last_7_days'::TEXT,
        COUNT(*)::BIGINT,
        'Chat messages in the last 7 days'::TEXT
    FROM chat_messages cm
    JOIN chat_sessions cs ON cm.session_id = cs.id
    WHERE cs.shop_domain = shop_domain_param
        AND cm.timestamp >= NOW() - INTERVAL '7 days';
END;
$$;

-- ============================================================================
-- VACUUM AND ANALYZE RECOMMENDATIONS
-- ============================================================================

-- Add comments for maintenance
COMMENT ON FUNCTION get_conversations_optimized IS 'Optimized function to retrieve paginated conversations with aggregated message stats';
COMMENT ON FUNCTION get_daily_conversation_stats IS 'Optimized function to get daily conversation statistics for chart analytics';
COMMENT ON FUNCTION get_conversation_analytics_summary IS 'Function to get conversation analytics summary for dashboard';
COMMENT ON FUNCTION analyze_chat_performance IS 'Function to analyze chat performance metrics for debugging';

-- Recommend running these for optimal performance:
-- VACUUM ANALYZE chat_sessions;
-- VACUUM ANALYZE chat_messages;
-- ANALYZE chat_sessions;
-- ANALYZE chat_messages;