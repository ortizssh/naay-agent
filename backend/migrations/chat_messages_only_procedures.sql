-- ============================================================================
-- CHAT MESSAGES ONLY STORED PROCEDURES
-- Updated procedures that work only with chat_messages table
-- No references to chat_sessions table
-- ============================================================================

-- Drop old procedures that reference chat_sessions
DROP FUNCTION IF EXISTS get_conversations_fast(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_conversations_optimized(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_conversation_count_fast(VARCHAR);
DROP FUNCTION IF EXISTS get_daily_conversation_stats(VARCHAR, DATE, DATE);
DROP FUNCTION IF EXISTS get_conversation_analytics_summary(VARCHAR, INTEGER);

-- ============================================================================
-- NEW CHAT MESSAGES ONLY PROCEDURES
-- ============================================================================

-- Get conversations derived from chat_messages only
CREATE OR REPLACE FUNCTION get_conversations_from_messages(
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
            cm.session_id,
            COUNT(cm.id) as total_messages,
            COUNT(CASE WHEN cm.role = 'user' THEN 1 END)::INTEGER as user_messages,
            COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END)::INTEGER as ai_messages,
            MAX(cm.timestamp) as last_activity,
            (
                SELECT content 
                FROM chat_messages cm2 
                WHERE cm2.session_id = cm.session_id 
                    AND cm2.role = 'user'
                    AND cm2.shop_domain = shop_domain_param
                ORDER BY cm2.timestamp ASC 
                LIMIT 1
            ) as first_user_message
        FROM chat_messages cm
        WHERE cm.shop_domain = shop_domain_param
        GROUP BY cm.session_id
        ORDER BY last_activity DESC
        LIMIT limit_param OFFSET offset_param
    )
    SELECT 
        ss.session_id,
        ss.total_messages,
        ss.user_messages,
        ss.ai_messages,
        COALESCE(ss.first_user_message, 'Sin mensaje inicial') as first_message,
        ss.last_activity
    FROM session_stats ss;
END;
$$;

-- Count conversations (distinct session_ids) from messages
CREATE OR REPLACE FUNCTION get_conversation_count_from_messages(
    shop_domain_param VARCHAR(255)
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(DISTINCT session_id)::INTEGER
    FROM chat_messages 
    WHERE shop_domain = shop_domain_param
    INTO count_result;
    
    RETURN COALESCE(count_result, 0);
END;
$$;

-- Get daily conversation stats from messages only
CREATE OR REPLACE FUNCTION get_daily_conversation_stats_from_messages(
    shop_domain_param VARCHAR(255),
    start_date_param DATE,
    end_date_param DATE
)
RETURNS TABLE (
    date DATE,
    conversations INTEGER,
    messages INTEGER,
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
    daily_stats AS (
        SELECT 
            DATE(cm.timestamp) as conversation_date,
            COUNT(DISTINCT cm.session_id) as conversation_count,
            COUNT(cm.id) as message_count
        FROM chat_messages cm
        WHERE cm.shop_domain = shop_domain_param
            AND DATE(cm.timestamp) BETWEEN start_date_param AND end_date_param
        GROUP BY DATE(cm.timestamp)
    )
    SELECT 
        ds.date,
        COALESCE(daily_stats.conversation_count, 0)::INTEGER as conversations,
        COALESCE(daily_stats.message_count, 0)::INTEGER as messages,
        0.00::DECIMAL(10,2) as sales, -- Placeholder for Shopify integration
        0::INTEGER as orders_count -- Placeholder for Shopify integration
    FROM date_series ds
    LEFT JOIN daily_stats ON ds.date = daily_stats.conversation_date
    ORDER BY ds.date;
END;
$$;

-- Get conversation analytics summary from messages
CREATE OR REPLACE FUNCTION get_conversation_analytics_summary_from_messages(
    shop_domain_param VARCHAR(255),
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_conversations INTEGER,
    total_messages INTEGER,
    avg_messages_per_conversation NUMERIC(10,2),
    user_messages INTEGER,
    assistant_messages INTEGER,
    system_messages INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT cm.session_id)::INTEGER as total_conversations,
        COUNT(cm.id)::INTEGER as total_messages,
        CASE 
            WHEN COUNT(DISTINCT cm.session_id) > 0 
            THEN (COUNT(cm.id)::NUMERIC / COUNT(DISTINCT cm.session_id))::NUMERIC(10,2)
            ELSE 0::NUMERIC(10,2)
        END as avg_messages_per_conversation,
        COUNT(CASE WHEN cm.role = 'user' THEN 1 END)::INTEGER as user_messages,
        COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END)::INTEGER as assistant_messages,
        COUNT(CASE WHEN cm.role = 'system' THEN 1 END)::INTEGER as system_messages
    FROM chat_messages cm
    WHERE cm.shop_domain = shop_domain_param
        AND cm.timestamp >= start_date;
END;
$$;

-- Get conversation details (unchanged as it already works with chat_messages)
CREATE OR REPLACE FUNCTION get_conversation_details_from_messages(
    session_id_param UUID,
    shop_domain_param VARCHAR(255)
)
RETURNS TABLE (
    id UUID,
    role VARCHAR(20),
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.role,
        cm.content,
        cm.timestamp,
        cm.metadata
    FROM chat_messages cm
    WHERE cm.session_id = session_id_param
        AND cm.shop_domain = shop_domain_param
    ORDER BY cm.timestamp ASC;
END;
$$;

-- Performance analysis for chat messages
CREATE OR REPLACE FUNCTION analyze_chat_performance_from_messages(
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
        'total_conversations'::TEXT as metric_name,
        COUNT(DISTINCT session_id)::BIGINT as metric_value,
        'Total number of conversations (unique session_ids)'::TEXT as description
    FROM chat_messages 
    WHERE shop_domain = shop_domain_param
    
    UNION ALL
    
    SELECT 
        'total_messages'::TEXT,
        COUNT(*)::BIGINT,
        'Total number of chat messages'::TEXT
    FROM chat_messages
    WHERE shop_domain = shop_domain_param
    
    UNION ALL
    
    SELECT 
        'avg_messages_per_conversation'::TEXT,
        CASE 
            WHEN COUNT(DISTINCT session_id) > 0 
            THEN (COUNT(*)::BIGINT / COUNT(DISTINCT session_id))
            ELSE 0
        END,
        'Average number of messages per conversation'::TEXT
    FROM chat_messages
    WHERE shop_domain = shop_domain_param
    
    UNION ALL
    
    SELECT 
        'conversations_last_7_days'::TEXT,
        COUNT(DISTINCT session_id)::BIGINT,
        'Conversations in the last 7 days'::TEXT
    FROM chat_messages
    WHERE shop_domain = shop_domain_param
        AND timestamp >= NOW() - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
        'messages_last_7_days'::TEXT,
        COUNT(*)::BIGINT,
        'Messages in the last 7 days'::TEXT
    FROM chat_messages
    WHERE shop_domain = shop_domain_param
        AND timestamp >= NOW() - INTERVAL '7 days';
END;
$$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Ensure all necessary indexes exist for the new procedures
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_session_timestamp 
ON chat_messages(shop_domain, session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_timestamp_desc 
ON chat_messages(shop_domain, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_role_timestamp 
ON chat_messages(session_id, role, timestamp);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_conversations_from_messages IS 'Get paginated conversations derived only from chat_messages table';
COMMENT ON FUNCTION get_conversation_count_from_messages IS 'Count conversations by counting distinct session_ids in chat_messages';
COMMENT ON FUNCTION get_daily_conversation_stats_from_messages IS 'Get daily conversation statistics from chat_messages only';
COMMENT ON FUNCTION get_conversation_analytics_summary_from_messages IS 'Get conversation analytics summary from chat_messages only';
COMMENT ON FUNCTION get_conversation_details_from_messages IS 'Get conversation details from chat_messages for a specific session';
COMMENT ON FUNCTION analyze_chat_performance_from_messages IS 'Analyze chat performance metrics from chat_messages only';