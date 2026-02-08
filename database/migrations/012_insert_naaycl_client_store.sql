-- Recreate client_stores entry for naaycl.myshopify.com
-- This row was accidentally deleted. Re-inserting with defaults for Shopify platform.

INSERT INTO client_stores (
  user_id,
  shop_domain,
  platform,
  status,
  is_active,
  widget_enabled,
  chatbot_endpoint,
  widget_brand_name,
  products_synced
) VALUES (
  '14312737-b0be-49f9-b975-c7c1a7e2731b',   -- Ignacio Ortiz (i.ortiz.nar@gmail.com)
  'naaycl.myshopify.com',
  'shopify',
  'active',
  true,
  true,
  'https://n8n.dustkey.com/webhook/kova-chat',
  'Naay',
  0
)
ON CONFLICT (user_id, shop_domain) DO NOTHING;
