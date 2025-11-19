-- Create webhook_events table for logging webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain varchar(255) NOT NULL,
  topic varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  verified boolean DEFAULT false,
  processed boolean DEFAULT false,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_shop_domain ON webhook_events(shop_domain);
CREATE INDEX IF NOT EXISTS idx_webhook_events_topic ON webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_events_verified ON webhook_events(verified);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Add widget_enabled column to stores table if it doesn't exist
ALTER TABLE stores ADD COLUMN IF NOT EXISTS widget_enabled boolean DEFAULT true;

-- Create RLS (Row Level Security) policies
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage webhook events" ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow authenticated users to read their own store's webhooks
CREATE POLICY "Users can view their store's webhook events" ON webhook_events
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND shop_domain IN (
      SELECT shop_domain FROM stores 
      WHERE auth.uid()::text = ANY(string_to_array(access_token, '.'))
    )
  );

-- Add comment to table
COMMENT ON TABLE webhook_events IS 'Log of all webhook events received from Shopify';

-- Add column comments
COMMENT ON COLUMN webhook_events.shop_domain IS 'The Shopify shop domain that sent the webhook';
COMMENT ON COLUMN webhook_events.topic IS 'The webhook topic/event type';
COMMENT ON COLUMN webhook_events.payload IS 'The full webhook payload as JSON';
COMMENT ON COLUMN webhook_events.verified IS 'Whether the webhook signature was verified';
COMMENT ON COLUMN webhook_events.processed IS 'Whether the webhook was successfully processed';
COMMENT ON COLUMN webhook_events.error_message IS 'Any error message if processing failed';
COMMENT ON COLUMN webhook_events.retry_count IS 'Number of times processing was retried';