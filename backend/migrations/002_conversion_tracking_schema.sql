-- Migration: Conversion Tracking Schema
-- Creates comprehensive tracking tables for AI recommendation → cart → purchase funnel

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Recommendation Events Table
-- Tracks every product recommendation made by the AI assistant
CREATE TABLE ai_recommendation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    
    -- Recommendation details
    recommended_product_id VARCHAR(255) NOT NULL,
    recommended_variant_id VARCHAR(255),
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
        'search_result', 'related_product', 'complementary', 'upsell', 'popular', 'semantic_match'
    )),
    recommendation_context JSONB DEFAULT '{}', -- Contains query, intent, etc.
    recommendation_position INTEGER, -- Position in the recommendation list
    recommendation_score DECIMAL(5,4), -- AI confidence/relevance score
    
    -- Attribution tracking
    customer_id VARCHAR(255), -- Shopify customer ID if available
    cart_id VARCHAR(255), -- Current cart ID at time of recommendation
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart Addition Events Table
-- Tracks when products are added to cart (via widget or directly)
CREATE TABLE cart_addition_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    
    -- Cart details
    cart_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    
    -- Product details
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2),
    
    -- Attribution tracking
    source VARCHAR(50) DEFAULT 'unknown' CHECK (source IN (
        'ai_recommendation', 'direct_add', 'search', 'browse', 'unknown'
    )),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    recommendation_event_id UUID REFERENCES ai_recommendation_events(id) ON DELETE SET NULL,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Completion Events Table
-- Tracks completed purchases and line items
CREATE TABLE order_completion_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    
    -- Order details
    order_id VARCHAR(255) NOT NULL,
    order_number VARCHAR(50),
    customer_id VARCHAR(255),
    
    -- Financial details
    total_amount DECIMAL(12,2) NOT NULL,
    subtotal_amount DECIMAL(12,2),
    tax_amount DECIMAL(12,2),
    currency_code CHAR(3) DEFAULT 'USD',
    
    -- Order metadata
    order_created_at TIMESTAMP WITH TIME ZONE,
    financial_status VARCHAR(50),
    fulfillment_status VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shop_domain, order_id)
);

-- Order Line Items Table
-- Individual products within orders for granular attribution
CREATE TABLE order_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_event_id UUID REFERENCES order_completion_events(id) ON DELETE CASCADE,
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    
    -- Line item details
    line_item_id VARCHAR(255),
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Product info at purchase time
    product_title VARCHAR(500),
    variant_title VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attribution Events Table
-- Links recommendations to cart additions and purchases with attribution windows
CREATE TABLE attribution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    
    -- Event chain tracking
    recommendation_event_id UUID REFERENCES ai_recommendation_events(id) ON DELETE CASCADE,
    cart_addition_event_id UUID REFERENCES cart_addition_events(id) ON DELETE SET NULL,
    order_line_item_id UUID REFERENCES order_line_items(id) ON DELETE SET NULL,
    
    -- Attribution details
    attribution_type VARCHAR(50) NOT NULL CHECK (attribution_type IN (
        'direct', 'assisted', 'view_through'
    )),
    attribution_window_hours INTEGER DEFAULT 720, -- 30 days default
    time_to_cart_minutes INTEGER, -- Time from recommendation to cart add
    time_to_purchase_minutes INTEGER, -- Time from recommendation to purchase
    
    -- Revenue attribution
    attributed_revenue DECIMAL(12,2), -- Portion of revenue attributed to this recommendation
    attribution_weight DECIMAL(5,4) DEFAULT 1.0, -- Attribution weight (for multi-touch attribution)
    
    -- Product match details
    exact_product_match BOOLEAN DEFAULT false,
    exact_variant_match BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion Analytics View
-- Aggregated conversion data for analytics and reporting
CREATE TABLE conversion_analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) REFERENCES stores(shop_domain) ON DELETE CASCADE,
    
    -- Snapshot period
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('daily', 'weekly', 'monthly')),
    
    -- Metrics
    total_recommendations INTEGER DEFAULT 0,
    total_cart_additions INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    attributed_cart_additions INTEGER DEFAULT 0,
    attributed_orders INTEGER DEFAULT 0,
    attributed_revenue DECIMAL(12,2) DEFAULT 0,
    
    -- Conversion rates
    recommendation_to_cart_rate DECIMAL(5,4) DEFAULT 0,
    recommendation_to_purchase_rate DECIMAL(5,4) DEFAULT 0,
    cart_to_purchase_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Performance by type
    metrics_by_type JSONB DEFAULT '{}', -- Breakdown by recommendation type
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shop_domain, date_from, date_to, snapshot_type)
);

-- Indexes for performance
CREATE INDEX idx_ai_recommendations_session ON ai_recommendation_events(session_id);
CREATE INDEX idx_ai_recommendations_shop ON ai_recommendation_events(shop_domain);
CREATE INDEX idx_ai_recommendations_product ON ai_recommendation_events(recommended_product_id);
CREATE INDEX idx_ai_recommendations_created_at ON ai_recommendation_events(created_at);

CREATE INDEX idx_cart_additions_shop ON cart_addition_events(shop_domain);
CREATE INDEX idx_cart_additions_cart ON cart_addition_events(cart_id);
CREATE INDEX idx_cart_additions_product ON cart_addition_events(product_id);
CREATE INDEX idx_cart_additions_source ON cart_addition_events(source);
CREATE INDEX idx_cart_additions_created_at ON cart_addition_events(created_at);
CREATE INDEX idx_cart_additions_recommendation ON cart_addition_events(recommendation_event_id);

CREATE INDEX idx_order_completion_shop ON order_completion_events(shop_domain);
CREATE INDEX idx_order_completion_order ON order_completion_events(order_id);
CREATE INDEX idx_order_completion_customer ON order_completion_events(customer_id);
CREATE INDEX idx_order_completion_created_at ON order_completion_events(created_at);

CREATE INDEX idx_order_line_items_order ON order_line_items(order_event_id);
CREATE INDEX idx_order_line_items_product ON order_line_items(product_id);
CREATE INDEX idx_order_line_items_variant ON order_line_items(variant_id);

CREATE INDEX idx_attribution_recommendation ON attribution_events(recommendation_event_id);
CREATE INDEX idx_attribution_cart ON attribution_events(cart_addition_event_id);
CREATE INDEX idx_attribution_order ON attribution_events(order_line_item_id);
CREATE INDEX idx_attribution_shop ON attribution_events(shop_domain);
CREATE INDEX idx_attribution_type ON attribution_events(attribution_type);

CREATE INDEX idx_conversion_snapshots_shop_date ON conversion_analytics_snapshots(shop_domain, date_from, date_to);
CREATE INDEX idx_conversion_snapshots_type ON conversion_analytics_snapshots(snapshot_type);

-- Update triggers for timestamps
CREATE TRIGGER update_ai_recommendations_updated_at 
BEFORE UPDATE ON ai_recommendation_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_additions_updated_at 
BEFORE UPDATE ON cart_addition_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_completion_updated_at 
BEFORE UPDATE ON order_completion_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stored procedure to calculate attribution
CREATE OR REPLACE FUNCTION calculate_attribution(
    p_shop_domain VARCHAR(255),
    p_attribution_window_hours INTEGER DEFAULT 720,
    p_lookback_days INTEGER DEFAULT 30
)
RETURNS void AS $$
DECLARE
    rec RECORD;
    cart_event_id UUID;
    order_item_id UUID;
    time_diff_minutes INTEGER;
    attr_weight DECIMAL(5,4);
BEGIN
    -- Clean up old attribution events for the shop
    DELETE FROM attribution_events 
    WHERE shop_domain = p_shop_domain 
    AND created_at < NOW() - INTERVAL '1 day';
    
    -- Process recommendation events within lookback period
    FOR rec IN 
        SELECT * FROM ai_recommendation_events 
        WHERE shop_domain = p_shop_domain 
        AND created_at >= NOW() - (p_lookback_days || ' days')::INTERVAL
        ORDER BY created_at DESC
    LOOP
        -- Look for cart additions of the recommended product
        SELECT id, EXTRACT(EPOCH FROM (created_at - rec.created_at))/60 INTO cart_event_id, time_diff_minutes
        FROM cart_addition_events
        WHERE shop_domain = p_shop_domain
        AND product_id = rec.recommended_product_id
        AND (rec.recommended_variant_id IS NULL OR variant_id = rec.recommended_variant_id)
        AND created_at >= rec.created_at
        AND created_at <= rec.created_at + (p_attribution_window_hours || ' hours')::INTERVAL
        AND (
            session_id = rec.session_id 
            OR customer_id IS NOT NULL AND customer_id = rec.customer_id
            OR cart_id = rec.cart_id
        )
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF cart_event_id IS NOT NULL THEN
            -- Look for order completion of this cart addition
            SELECT oli.id INTO order_item_id
            FROM order_line_items oli
            JOIN order_completion_events oce ON oli.order_event_id = oce.id
            WHERE oli.shop_domain = p_shop_domain
            AND oli.product_id = rec.recommended_product_id
            AND (rec.recommended_variant_id IS NULL OR oli.variant_id = rec.recommended_variant_id)
            AND oce.order_created_at >= rec.created_at
            AND oce.order_created_at <= rec.created_at + (p_attribution_window_hours || ' hours')::INTERVAL
            ORDER BY oce.order_created_at ASC
            LIMIT 1;
            
            -- Calculate attribution weight (simple last-touch for now)
            attr_weight := 1.0;
            
            -- Insert attribution event
            INSERT INTO attribution_events (
                shop_domain,
                recommendation_event_id,
                cart_addition_event_id,
                order_line_item_id,
                attribution_type,
                attribution_window_hours,
                time_to_cart_minutes,
                time_to_purchase_minutes,
                attributed_revenue,
                attribution_weight,
                exact_product_match,
                exact_variant_match
            ) VALUES (
                p_shop_domain,
                rec.id,
                cart_event_id,
                order_item_id,
                CASE WHEN order_item_id IS NOT NULL THEN 'direct' ELSE 'assisted' END,
                p_attribution_window_hours,
                time_diff_minutes::INTEGER,
                CASE WHEN order_item_id IS NOT NULL THEN 
                    (SELECT EXTRACT(EPOCH FROM (oce.order_created_at - rec.created_at))/60
                     FROM order_completion_events oce 
                     JOIN order_line_items oli ON oce.id = oli.order_event_id 
                     WHERE oli.id = order_item_id)::INTEGER
                ELSE NULL END,
                CASE WHEN order_item_id IS NOT NULL THEN
                    (SELECT oli.total_price * attr_weight
                     FROM order_line_items oli 
                     WHERE oli.id = order_item_id)
                ELSE 0 END,
                attr_weight,
                true,
                (rec.recommended_variant_id IS NOT NULL)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate conversion analytics snapshots
CREATE OR REPLACE FUNCTION generate_conversion_snapshot(
    p_shop_domain VARCHAR(255),
    p_date_from DATE,
    p_date_to DATE,
    p_snapshot_type VARCHAR(20)
)
RETURNS void AS $$
DECLARE
    v_total_recommendations INTEGER;
    v_total_cart_additions INTEGER;
    v_total_orders INTEGER;
    v_total_revenue DECIMAL(12,2);
    v_attributed_cart_additions INTEGER;
    v_attributed_orders INTEGER;
    v_attributed_revenue DECIMAL(12,2);
    v_recommendation_to_cart_rate DECIMAL(5,4);
    v_recommendation_to_purchase_rate DECIMAL(5,4);
    v_cart_to_purchase_rate DECIMAL(5,4);
BEGIN
    -- Calculate total recommendations
    SELECT COUNT(*) INTO v_total_recommendations
    FROM ai_recommendation_events
    WHERE shop_domain = p_shop_domain
    AND DATE(created_at) BETWEEN p_date_from AND p_date_to;
    
    -- Calculate total cart additions
    SELECT COUNT(*) INTO v_total_cart_additions
    FROM cart_addition_events
    WHERE shop_domain = p_shop_domain
    AND DATE(created_at) BETWEEN p_date_from AND p_date_to;
    
    -- Calculate total orders and revenue
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO v_total_orders, v_total_revenue
    FROM order_completion_events
    WHERE shop_domain = p_shop_domain
    AND DATE(order_created_at) BETWEEN p_date_from AND p_date_to;
    
    -- Calculate attributed conversions
    SELECT 
        COUNT(DISTINCT ae.cart_addition_event_id),
        COUNT(DISTINCT ae.order_line_item_id),
        COALESCE(SUM(ae.attributed_revenue), 0)
    INTO v_attributed_cart_additions, v_attributed_orders, v_attributed_revenue
    FROM attribution_events ae
    JOIN ai_recommendation_events are ON ae.recommendation_event_id = are.id
    WHERE ae.shop_domain = p_shop_domain
    AND DATE(are.created_at) BETWEEN p_date_from AND p_date_to;
    
    -- Calculate conversion rates
    v_recommendation_to_cart_rate := CASE 
        WHEN v_total_recommendations > 0 THEN v_attributed_cart_additions::DECIMAL / v_total_recommendations 
        ELSE 0 
    END;
    
    v_recommendation_to_purchase_rate := CASE 
        WHEN v_total_recommendations > 0 THEN v_attributed_orders::DECIMAL / v_total_recommendations 
        ELSE 0 
    END;
    
    v_cart_to_purchase_rate := CASE 
        WHEN v_attributed_cart_additions > 0 THEN v_attributed_orders::DECIMAL / v_attributed_cart_additions 
        ELSE 0 
    END;
    
    -- Insert or update snapshot
    INSERT INTO conversion_analytics_snapshots (
        shop_domain,
        date_from,
        date_to,
        snapshot_type,
        total_recommendations,
        total_cart_additions,
        total_orders,
        total_revenue,
        attributed_cart_additions,
        attributed_orders,
        attributed_revenue,
        recommendation_to_cart_rate,
        recommendation_to_purchase_rate,
        cart_to_purchase_rate
    ) VALUES (
        p_shop_domain,
        p_date_from,
        p_date_to,
        p_snapshot_type,
        v_total_recommendations,
        v_total_cart_additions,
        v_total_orders,
        v_total_revenue,
        v_attributed_cart_additions,
        v_attributed_orders,
        v_attributed_revenue,
        v_recommendation_to_cart_rate,
        v_recommendation_to_purchase_rate,
        v_cart_to_purchase_rate
    )
    ON CONFLICT (shop_domain, date_from, date_to, snapshot_type)
    DO UPDATE SET
        total_recommendations = EXCLUDED.total_recommendations,
        total_cart_additions = EXCLUDED.total_cart_additions,
        total_orders = EXCLUDED.total_orders,
        total_revenue = EXCLUDED.total_revenue,
        attributed_cart_additions = EXCLUDED.attributed_cart_additions,
        attributed_orders = EXCLUDED.attributed_orders,
        attributed_revenue = EXCLUDED.attributed_revenue,
        recommendation_to_cart_rate = EXCLUDED.recommendation_to_cart_rate,
        recommendation_to_purchase_rate = EXCLUDED.recommendation_to_purchase_rate,
        cart_to_purchase_rate = EXCLUDED.cart_to_purchase_rate;
END;
$$ LANGUAGE plpgsql;