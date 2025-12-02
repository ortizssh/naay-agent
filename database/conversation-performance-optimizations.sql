-- ============================================================================
-- CONVERSATION PERFORMANCE OPTIMIZATIONS
-- Additional optimizations specifically for conversation loading performance
-- ============================================================================

-- ============================================================================
-- ENHANCED INDEXES FOR CONVERSATION QUERIES
-- ============================================================================

-- Covering index for conversation list queries (most important optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_conversations_covering 
ON chat_sessions(shop_domain, status, last_activity DESC) 
INCLUDE (id, started_at)
WHERE status = 'active';

-- Optimized index for message aggregation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_aggregation 
ON chat_messages(session_id, role) 
INCLUDE (content, timestamp);

-- Partial index for recent conversations (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_recent 
ON chat_sessions(shop_domain, last_activity DESC) 
WHERE last_activity >= (CURRENT_DATE - INTERVAL '30 days');

-- Index for conversation details modal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_details 
ON chat_messages(session_id, timestamp ASC) 
INCLUDE (role, content);

-- ============================================================================
-- MATERIALIZED VIEW FOR CONVERSATION STATISTICS
-- ============================================================================

-- Create materialized view for conversation statistics (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS conversation_stats AS
SELECT 
    cs.shop_domain,
    cs.id as session_id,
    cs.last_activity,
    cs.started_at,
    cs.status,
    COUNT(cm.id) as total_messages,
    COUNT(CASE WHEN cm.role = 'user' THEN 1 END) as user_messages,
    COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END) as ai_messages,
    MIN(CASE WHEN cm.role = 'user' THEN cm.content END) as first_user_message,
    MAX(cm.timestamp) as last_message_time
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
GROUP BY cs.shop_domain, cs.id, cs.last_activity, cs.started_at, cs.status;

-- Index on the materialized view
CREATE INDEX IF NOT EXISTS idx_conversation_stats_shop_activity 
ON conversation_stats(shop_domain, last_activity DESC)
WHERE status = 'active';

-- ============================================================================
-- OPTIMIZED FUNCTIONS WITH BETTER PERFORMANCE
-- ============================================================================

-- Ultra-fast conversation loading using materialized view
CREATE OR REPLACE FUNCTION get_conversations_fast(
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
    -- Try to use materialized view first (fastest)
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'conversation_stats') THEN
        RETURN QUERY
        SELECT 
            cs.session_id,
            cs.total_messages::INTEGER,
            cs.user_messages::INTEGER,
            cs.ai_messages::INTEGER,
            COALESCE(cs.first_user_message, 'Sin mensaje inicial') as first_message,
            cs.last_activity
        FROM conversation_stats cs
        WHERE cs.shop_domain = shop_domain_param
            AND cs.status = 'active'
        ORDER BY cs.last_activity DESC
        LIMIT limit_param OFFSET offset_param;
    ELSE
        -- Fallback to optimized direct query
        RETURN QUERY
        SELECT * FROM get_conversations_optimized(shop_domain_param, limit_param, offset_param);
    END IF;
END;
$$;

-- Function to refresh conversation stats (call this hourly)
CREATE OR REPLACE FUNCTION refresh_conversation_stats()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_stats;
    
    -- Log the refresh
    INSERT INTO analytics_events (shop_domain, event_type, event_data)
    VALUES ('system', 'materialized_view_refresh', jsonb_build_object(
        'view_name', 'conversation_stats',
        'refreshed_at', NOW()
    ));
END;
$$;

-- ============================================================================
-- CONVERSATION COUNT OPTIMIZATION
-- ============================================================================

-- Fast count function that uses table statistics for large datasets
CREATE OR REPLACE FUNCTION get_conversation_count_fast(
    shop_domain_param VARCHAR(255)
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    count_result INTEGER;
    estimated_count BIGINT;
BEGIN
    -- For small datasets, use exact count
    SELECT reltuples::BIGINT 
    FROM pg_class 
    WHERE relname = 'chat_sessions' 
    INTO estimated_count;
    
    IF estimated_count < 10000 THEN
        -- Use exact count for smaller tables
        SELECT COUNT(*)::INTEGER
        FROM chat_sessions 
        WHERE shop_domain = shop_domain_param AND status = 'active'
        INTO count_result;
    ELSE
        -- Use statistical estimation for larger tables
        SELECT (
            COUNT(*) * 
            (SELECT reltuples FROM pg_class WHERE relname = 'chat_sessions') / 
            (SELECT COUNT(*) FROM chat_sessions TABLESAMPLE SYSTEM(1))
        )::INTEGER
        FROM chat_sessions TABLESAMPLE SYSTEM(1)
        WHERE shop_domain = shop_domain_param AND status = 'active'
        INTO count_result;
    END IF;
    
    RETURN COALESCE(count_result, 0);
END;
$$;

-- ============================================================================
-- AUTOMATIC MAINTENANCE
-- ============================================================================

-- Function to analyze conversation table performance
CREATE OR REPLACE FUNCTION analyze_conversation_performance()
RETURNS TABLE (
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    table_size TEXT,
    unused_indexes TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'chat_sessions'::TEXT as table_name,
        i.indexname::TEXT as index_name,
        pg_size_pretty(pg_relation_size(i.indexname::regclass))::TEXT as index_size,
        pg_size_pretty(pg_relation_size('chat_sessions'::regclass))::TEXT as table_size,
        CASE 
            WHEN s.idx_scan < 10 THEN ARRAY[i.indexname]
            ELSE ARRAY[]::TEXT[]
        END as unused_indexes
    FROM pg_indexes i
    LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexname
    WHERE i.tablename = 'chat_sessions'
    
    UNION ALL
    
    SELECT 
        'chat_messages'::TEXT,
        i.indexname::TEXT,
        pg_size_pretty(pg_relation_size(i.indexname::regclass))::TEXT,
        pg_size_pretty(pg_relation_size('chat_messages'::regclass))::TEXT,
        CASE 
            WHEN s.idx_scan < 10 THEN ARRAY[i.indexname]
            ELSE ARRAY[]::TEXT[]
        END
    FROM pg_indexes i
    LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexname
    WHERE i.tablename = 'chat_messages';
END;
$$;

-- ============================================================================
-- MONITORING AND ALERTING
-- ============================================================================

-- Function to detect slow queries
CREATE OR REPLACE FUNCTION detect_slow_conversation_queries()
RETURNS TABLE (
    query_type TEXT,
    avg_duration_ms NUMERIC,
    call_count BIGINT,
    total_time_ms NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN query LIKE '%get_conversations%' THEN 'conversation_list'
            WHEN query LIKE '%chat_messages%session_id%' THEN 'conversation_details'
            WHEN query LIKE '%chat_sessions%count%' THEN 'conversation_count'
            ELSE 'other'
        END as query_type,
        mean_exec_time as avg_duration_ms,
        calls as call_count,
        total_exec_time as total_time_ms
    FROM pg_stat_statements 
    WHERE query LIKE '%chat_sessions%' OR query LIKE '%chat_messages%'
    ORDER BY mean_exec_time DESC
    LIMIT 10;
END;
$$;

-- ============================================================================
-- DEPLOYMENT COMMANDS
-- ============================================================================

-- Commands to run after deploying these optimizations:

-- 1. Refresh statistics
-- ANALYZE chat_sessions;
-- ANALYZE chat_messages;

-- 2. Create initial materialized view
-- REFRESH MATERIALIZED VIEW conversation_stats;

-- 3. Set up automatic refresh (run this as a scheduled job every hour)
-- SELECT refresh_conversation_stats();

-- 4. Check performance
-- SELECT * FROM analyze_conversation_performance();

-- 5. Monitor slow queries
-- SELECT * FROM detect_slow_conversation_queries();

-- ============================================================================
-- PERFORMANCE TARGETS
-- ============================================================================

COMMENT ON FUNCTION get_conversations_fast IS 'Target: <100ms for conversation list loading';
COMMENT ON FUNCTION get_conversation_count_fast IS 'Target: <50ms for count queries';
COMMENT ON MATERIALIZED VIEW conversation_stats IS 'Refreshed hourly, provides <50ms conversation queries';

-- Performance expectations:
-- - Conversation list: <100ms (down from 200-500ms)
-- - Conversation count: <50ms (down from 100-300ms)
-- - Page load: <2s total (down from 5-10s)
-- - Memory usage: Minimal increase due to materialized view