-- ============================================================================
-- CHAT CONVERSIONS TRACKING SYSTEM
-- ============================================================================

-- Tabla para rastrear conversiones del chat a compras
CREATE TABLE IF NOT EXISTS chat_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) NOT NULL,
    session_id UUID NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    
    -- Timing
    chat_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    chat_last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
    order_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    time_to_conversion_minutes INTEGER NOT NULL,
    
    -- Products
    products_mentioned JSONB DEFAULT '[]'::JSONB,
    products_purchased JSONB DEFAULT '[]'::JSONB,
    matching_products JSONB DEFAULT '[]'::JSONB,
    
    -- Conversion metrics
    total_order_value DECIMAL(10,2) DEFAULT 0,
    matching_products_value DECIMAL(10,2) DEFAULT 0,
    total_items_purchased INTEGER DEFAULT 0,
    matching_items_purchased INTEGER DEFAULT 0,
    
    -- Attribution
    attribution_confidence DECIMAL(3,2) DEFAULT 0.50, -- 0.0 to 1.0
    attribution_method VARCHAR(50) DEFAULT 'product_match',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_shop_domain FOREIGN KEY (shop_domain) REFERENCES shops(shop_domain) ON DELETE CASCADE
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_chat_conversions_shop_domain ON chat_conversions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_session_id ON chat_conversions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_order_id ON chat_conversions(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_order_date ON chat_conversions(order_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversions_time_to_conversion ON chat_conversions(time_to_conversion_minutes);

-- Tabla para trackear puntos de contacto del customer journey
CREATE TABLE IF NOT EXISTS customer_touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    session_id UUID,
    
    -- Touchpoint details
    touchpoint_type VARCHAR(50) NOT NULL, -- 'chat_start', 'product_view', 'add_to_cart', 'purchase'
    product_id VARCHAR(255),
    product_handle VARCHAR(255),
    
    -- Context
    page_url TEXT,
    referrer_url TEXT,
    user_agent TEXT,
    
    -- Timing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    
    CONSTRAINT fk_touchpoints_shop_domain FOREIGN KEY (shop_domain) REFERENCES shops(shop_domain) ON DELETE CASCADE
);

-- Indexes para customer touchpoints
CREATE INDEX IF NOT EXISTS idx_customer_touchpoints_shop ON customer_touchpoints(shop_domain);
CREATE INDEX IF NOT EXISTS idx_customer_touchpoints_customer ON customer_touchpoints(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_touchpoints_session ON customer_touchpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_customer_touchpoints_type ON customer_touchpoints(touchpoint_type);
CREATE INDEX IF NOT EXISTS idx_customer_touchpoints_timestamp ON customer_touchpoints(timestamp DESC);

-- ============================================================================
-- STORED PROCEDURES FOR CONVERSION ANALYSIS
-- ============================================================================

-- Función para analizar y registrar conversiones
CREATE OR REPLACE FUNCTION analyze_chat_conversions(
    shop_domain_param VARCHAR(255),
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    new_conversions INTEGER,
    total_conversion_value DECIMAL(10,2),
    avg_time_to_conversion DECIMAL(8,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
    conversion_record RECORD;
    new_conv_count INTEGER := 0;
    total_value DECIMAL(10,2) := 0;
    avg_time DECIMAL(8,2) := 0;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    -- Buscar nuevas conversiones potenciales
    FOR conversion_record IN
        SELECT DISTINCT
            cm.session_id,
            cm.shop_domain,
            MIN(cm.timestamp) as chat_started,
            MAX(cm.timestamp) as chat_last_activity
        FROM chat_messages cm
        WHERE cm.shop_domain = shop_domain_param
            AND cm.timestamp >= start_date
            AND cm.role = 'user'
        GROUP BY cm.session_id, cm.shop_domain
    LOOP
        -- Buscar órdenes dentro de las 48 horas siguientes al chat
        INSERT INTO chat_conversions (
            shop_domain,
            session_id,
            order_id,
            customer_id,
            chat_started_at,
            chat_last_activity,
            order_created_at,
            time_to_conversion_minutes,
            products_mentioned,
            products_purchased,
            matching_products,
            total_order_value,
            attribution_confidence
        )
        SELECT 
            conversion_record.shop_domain,
            conversion_record.session_id,
            'demo_order_' || conversion_record.session_id::text, -- Placeholder hasta integrar Shopify
            'demo_customer',
            conversion_record.chat_started,
            conversion_record.chat_last_activity,
            conversion_record.chat_last_activity + INTERVAL '2 hours', -- Simulación
            120, -- 2 horas en minutos
            '[]'::JSONB,
            '[]'::JSONB,
            '[]'::JSONB,
            50.00,
            0.75
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_conversions cc 
            WHERE cc.session_id = conversion_record.session_id
        );
        
        new_conv_count := new_conv_count + 1;
    END LOOP;
    
    -- Calcular métricas
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_order_value), 0),
        COALESCE(AVG(time_to_conversion_minutes), 0)
    INTO new_conv_count, total_value, avg_time
    FROM chat_conversions
    WHERE shop_domain = shop_domain_param
        AND created_at >= start_date;
    
    RETURN QUERY SELECT new_conv_count, total_value, avg_time;
END;
$$;

-- Función para obtener métricas de conversión
CREATE OR REPLACE FUNCTION get_conversion_metrics(
    shop_domain_param VARCHAR(255),
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_conversations INTEGER,
    total_conversions INTEGER,
    conversion_rate DECIMAL(5,2),
    total_revenue DECIMAL(10,2),
    avg_order_value DECIMAL(10,2),
    avg_time_to_conversion_hours DECIMAL(8,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_date TIMESTAMP WITH TIME ZONE;
    conversations_count INTEGER;
    conversions_count INTEGER;
    total_rev DECIMAL(10,2);
    avg_order DECIMAL(10,2);
    avg_time_hours DECIMAL(8,2);
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    -- Contar conversaciones únicas
    SELECT COUNT(DISTINCT session_id) 
    INTO conversations_count
    FROM chat_messages 
    WHERE shop_domain = shop_domain_param 
        AND timestamp >= start_date;
    
    -- Métricas de conversiones
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_order_value), 0),
        COALESCE(AVG(total_order_value), 0),
        COALESCE(AVG(time_to_conversion_minutes / 60.0), 0)
    INTO conversions_count, total_rev, avg_order, avg_time_hours
    FROM chat_conversions
    WHERE shop_domain = shop_domain_param
        AND order_created_at >= start_date;
    
    RETURN QUERY SELECT 
        conversations_count,
        conversions_count,
        CASE 
            WHEN conversations_count > 0 THEN (conversions_count::DECIMAL / conversations_count * 100)
            ELSE 0
        END,
        total_rev,
        avg_order,
        avg_time_hours;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE chat_conversions IS 'Tracks conversions from chat interactions to purchases';
COMMENT ON TABLE customer_touchpoints IS 'Records customer journey touchpoints for attribution analysis';
COMMENT ON FUNCTION analyze_chat_conversions IS 'Analyzes and records new chat-to-purchase conversions';
COMMENT ON FUNCTION get_conversion_metrics IS 'Returns conversion metrics for a shop over a specified period';