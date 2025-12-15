-- Script para crear datos de demostración para análisis de productos

-- Insertar recomendaciones de prueba
INSERT INTO simple_recommendations (session_id, shop_domain, product_id, product_title, recommended_at, expires_at)
VALUES 
  -- Emulsión Recuperadora (más recomendado)
  ('demo-session-001', 'naaycl', '7849807528193', 'Emulsión Recuperadora Premium', '2025-12-10 10:15:00', '2025-12-10 10:25:00'),
  ('demo-session-002', 'naaycl', '7849807528193', 'Emulsión Recuperadora Premium', '2025-12-10 09:30:00', '2025-12-10 09:40:00'),
  ('demo-session-003', 'naaycl', '7849807528193', 'Emulsión Recuperadora Premium', '2025-12-10 08:45:00', '2025-12-10 08:55:00'),
  ('demo-session-004', 'naaycl', '7849807528193', 'Emulsión Recuperadora Premium', '2025-12-10 11:20:00', '2025-12-10 11:30:00'),
  ('demo-session-005', 'naaycl', '7849807528193', 'Emulsión Recuperadora Premium', '2025-12-10 12:10:00', '2025-12-10 12:20:00'),
  
  -- Gel Aloe Vera (segundo más recomendado)
  ('demo-session-006', 'naaycl', '7849807331585', 'Gel de Aloe Vera Enriquecido', '2025-12-10 10:30:00', '2025-12-10 10:40:00'),
  ('demo-session-007', 'naaycl', '7849807331585', 'Gel de Aloe Vera Enriquecido', '2025-12-10 11:15:00', '2025-12-10 11:25:00'),
  ('demo-session-008', 'naaycl', '7849807331585', 'Gel de Aloe Vera Enriquecido', '2025-12-10 09:20:00', '2025-12-10 09:30:00'),
  
  -- Crema Facial Bardana
  ('demo-session-009', 'naaycl', '7849806938369', 'Crema Facial de Bardana para Cutis Graso', '2025-12-10 10:00:00', '2025-12-10 10:10:00'),
  ('demo-session-010', 'naaycl', '7849806938369', 'Crema Facial de Bardana para Cutis Graso', '2025-12-10 11:45:00', '2025-12-10 11:55:00'),
  
  -- Otros productos
  ('demo-session-011', 'naaycl', '7849807299841', 'Delicate Splendor | Crema Facial Antimanchas', '2025-12-10 09:50:00', '2025-12-10 10:00:00'),
  ('demo-session-012', 'naaycl', '7849807168769', 'Bálsamo Multiusos Árnica', '2025-12-10 10:40:00', '2025-12-10 10:50:00');

-- Insertar conversiones de prueba (algunas recomendaciones que resultaron en ventas)
INSERT INTO simple_conversions (
  session_id, order_id, product_id, shop_domain, recommended_at, purchased_at, 
  minutes_to_conversion, confidence, order_quantity, order_amount, total_order_amount
)
VALUES 
  -- Conversiones de Emulsión Recuperadora (3 de 5 = 60% conversión)
  ('demo-session-001', 'DEMO-ORDER-001', '7849807528193', 'naaycl', '2025-12-10 10:15:00', '2025-12-10 10:22:00', 7, 0.85, 1, 25990, 25990),
  ('demo-session-003', 'DEMO-ORDER-003', '7849807528193', 'naaycl', '2025-12-10 08:45:00', '2025-12-10 08:52:00', 7, 0.85, 2, 51980, 51980),
  ('demo-session-005', 'DEMO-ORDER-005', '7849807528193', 'naaycl', '2025-12-10 12:10:00', '2025-12-10 12:15:00', 5, 0.90, 1, 25990, 35990),
  
  -- Conversiones de Gel Aloe Vera (1 de 3 = 33% conversión)
  ('demo-session-007', 'DEMO-ORDER-007', '7849807331585', 'naaycl', '2025-12-10 11:15:00', '2025-12-10 11:23:00', 8, 0.80, 1, 18990, 18990),
  
  -- Conversión de Crema Facial Bardana (1 de 2 = 50% conversión)  
  ('demo-session-010', 'DEMO-ORDER-010', '7849806938369', 'naaycl', '2025-12-10 11:45:00', '2025-12-10 11:50:00', 5, 0.90, 1, 22990, 22990);