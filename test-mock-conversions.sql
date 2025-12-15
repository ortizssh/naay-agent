-- Mock Conversion Data for Testing Visualization
-- Execute this in Supabase SQL Editor to create test conversion data

-- First, check the structure of simple_conversions table
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'simple_conversions';

-- Insert mock conversions including the required 'confidence' column
INSERT INTO simple_conversions (
    shop_domain,
    session_id,
    product_id,
    order_id,
    minutes_to_conversion,
    purchased_at,
    recommended_at,
    order_quantity,
    order_amount,
    total_order_amount,
    confidence
) VALUES 
-- Direct conversions (0-30 min)
('naay.cl', 'mock_session_1', '1391335309410', 'mock_order_1', 15, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' - INTERVAL '15 minutes', 1, 45.99, 45.99, 0.95),
('naay.cl', 'mock_session_2', '2234461519970', 'mock_order_2', 25, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' - INTERVAL '25 minutes', 1, 32.50, 32.50, 0.88),
('naay.cl', 'mock_session_3', '8843538563295', 'mock_order_3', 20, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' - INTERVAL '20 minutes', 1, 78.25, 78.25, 0.92),

-- Assisted conversions (30min-24h)
('naay.cl', 'mock_session_4', '1391335309410', 'mock_order_4', 240, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' - INTERVAL '240 minutes', 1, 45.99, 45.99, 0.75),
('naay.cl', 'mock_session_5', '7460599988447', 'mock_order_5', 480, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' - INTERVAL '480 minutes', 2, 89.50, 179.00, 0.68),
('naay.cl', 'mock_session_6', '1391318696034', 'mock_order_6', 720, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' - INTERVAL '720 minutes', 1, 25.99, 25.99, 0.72),

-- View-through conversions (24h-7d)
('naay.cl', 'mock_session_7', '2234461519970', 'mock_order_7', 2880, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' - INTERVAL '2880 minutes', 1, 32.50, 32.50, 0.45),
('naay.cl', 'mock_session_8', '8843538563295', 'mock_order_8', 4320, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days' - INTERVAL '4320 minutes', 1, 78.25, 78.25, 0.38),

-- Recent conversions for timeline
('naay.cl', 'mock_session_9', '1391335309410', 'mock_order_9', 30, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours' - INTERVAL '30 minutes', 1, 45.99, 45.99, 0.89),
('naay.cl', 'mock_session_10', '2234461519970', 'mock_order_10', 60, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' - INTERVAL '60 minutes', 1, 32.50, 32.50, 0.82);

-- Display summary
SELECT 
    'Mock conversions inserted successfully!' as message,
    COUNT(*) as total_conversions,
    SUM(order_amount) as total_revenue,
    ROUND(AVG(order_amount), 2) as avg_order_value,
    ROUND(AVG(minutes_to_conversion), 2) as avg_time_to_conversion
FROM simple_conversions 
WHERE shop_domain = 'naay.cl' 
AND session_id LIKE 'mock_%';