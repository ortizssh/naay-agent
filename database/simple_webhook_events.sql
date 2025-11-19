-- Simple webhook_events table creation that avoids conflicts
-- This creates the table with just the essential columns we're actually using

-- Drop and recreate the table if it exists (be careful with this in production)
-- DROP TABLE IF EXISTS webhook_events;

-- Create the table with only the columns we actually use
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain varchar(255) NOT NULL,
  topic varchar(100) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean DEFAULT false,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_shop_domain ON webhook_events(shop_domain);
CREATE INDEX IF NOT EXISTS idx_webhook_events_topic ON webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Add the widget_enabled column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS widget_enabled boolean DEFAULT true;

-- Add basic comments
COMMENT ON TABLE webhook_events IS 'Log of all webhook events received from Shopify';