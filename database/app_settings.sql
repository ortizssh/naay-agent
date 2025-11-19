-- Create app_settings table for storing app configuration per shop
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain varchar(255) NOT NULL UNIQUE,
  
  -- Chat Configuration
  chat_enabled boolean DEFAULT true,
  welcome_message text DEFAULT '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
  chat_position varchar(20) DEFAULT 'bottom-right', -- bottom-right, bottom-left, top-right, top-left
  chat_color varchar(7) DEFAULT '#008060', -- Hex color code
  auto_open_chat boolean DEFAULT false,
  show_agent_avatar boolean DEFAULT true,
  
  -- Business Hours
  business_hours_enabled boolean DEFAULT false,
  business_hours_start time DEFAULT '09:00',
  business_hours_end time DEFAULT '18:00',
  business_timezone varchar(50) DEFAULT 'America/Mexico_City',
  
  -- AI Configuration
  fallback_message text DEFAULT 'Lo siento, en este momento no puedo ayudarte. Por favor, intenta más tarde.',
  max_conversation_history integer DEFAULT 50,
  
  -- Feature Toggles
  enable_product_recommendations boolean DEFAULT true,
  enable_order_tracking boolean DEFAULT true,
  enable_analytics boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_settings_shop_domain ON app_settings(shop_domain);
CREATE INDEX IF NOT EXISTS idx_app_settings_chat_enabled ON app_settings(chat_enabled);

-- Add foreign key reference to stores table
ALTER TABLE app_settings 
ADD CONSTRAINT fk_app_settings_store 
FOREIGN KEY (shop_domain) 
REFERENCES stores(shop_domain) 
ON DELETE CASCADE;

-- Create RLS (Row Level Security) policies
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage app settings" ON app_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow authenticated users to manage their own store settings
CREATE POLICY "Users can manage their store settings" ON app_settings
  FOR ALL USING (
    auth.role() = 'authenticated' 
    AND shop_domain IN (
      SELECT shop_domain FROM stores 
      WHERE auth.uid()::text = ANY(string_to_array(access_token, '.'))
    )
  );

-- Add comment to table
COMMENT ON TABLE app_settings IS 'Configuration settings for the Naay Agent app per shop';

-- Add column comments
COMMENT ON COLUMN app_settings.shop_domain IS 'The Shopify shop domain these settings belong to';
COMMENT ON COLUMN app_settings.chat_enabled IS 'Whether the chat widget is enabled on the storefront';
COMMENT ON COLUMN app_settings.welcome_message IS 'The welcome message shown when chat opens';
COMMENT ON COLUMN app_settings.chat_position IS 'Position of chat widget on page (bottom-right, bottom-left, etc.)';
COMMENT ON COLUMN app_settings.chat_color IS 'Primary color for the chat widget (hex color code)';
COMMENT ON COLUMN app_settings.auto_open_chat IS 'Whether to automatically open chat on page load';
COMMENT ON COLUMN app_settings.show_agent_avatar IS 'Whether to show the AI agent avatar in chat';
COMMENT ON COLUMN app_settings.business_hours_enabled IS 'Whether to enable business hours restrictions';
COMMENT ON COLUMN app_settings.business_hours_start IS 'Start time for business hours';
COMMENT ON COLUMN app_settings.business_hours_end IS 'End time for business hours';
COMMENT ON COLUMN app_settings.business_timezone IS 'Timezone for business hours';
COMMENT ON COLUMN app_settings.fallback_message IS 'Message shown when AI cannot respond';
COMMENT ON COLUMN app_settings.max_conversation_history IS 'Maximum number of messages to keep in conversation history';
COMMENT ON COLUMN app_settings.enable_product_recommendations IS 'Whether to enable AI product recommendations';
COMMENT ON COLUMN app_settings.enable_order_tracking IS 'Whether to enable order tracking features';
COMMENT ON COLUMN app_settings.enable_analytics IS 'Whether to enable analytics tracking';

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();