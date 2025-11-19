-- Create shopify_sessions table for modern authentication session tracking
CREATE TABLE IF NOT EXISTS shopify_sessions (
  session_id varchar(255) PRIMARY KEY,
  shop_domain varchar(255) NOT NULL,
  user_id varchar(255) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone DEFAULT now(),
  session_token_hash text,
  user_agent text,
  ip_address inet,
  is_active boolean DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_domain ON shopify_sessions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_user_id ON shopify_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_expires_at ON shopify_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_last_used ON shopify_sessions(last_used);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_active ON shopify_sessions(is_active);

-- Create composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_user ON shopify_sessions(shop_domain, user_id);

-- Add foreign key reference to stores table if it exists
ALTER TABLE shopify_sessions 
ADD CONSTRAINT fk_shopify_sessions_store 
FOREIGN KEY (shop_domain) 
REFERENCES stores(shop_domain) 
ON DELETE CASCADE;

-- Create RLS (Row Level Security) policies
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage sessions" ON shopify_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow authenticated users to read their own sessions
CREATE POLICY "Users can view their own sessions" ON shopify_sessions
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND user_id = auth.uid()::text
  );

-- Add comment to table
COMMENT ON TABLE shopify_sessions IS 'Session tracking for Shopify App Bridge authentication';

-- Add column comments
COMMENT ON COLUMN shopify_sessions.session_id IS 'Unique session identifier from Shopify';
COMMENT ON COLUMN shopify_sessions.shop_domain IS 'The Shopify shop domain for this session';
COMMENT ON COLUMN shopify_sessions.user_id IS 'Shopify user ID for this session';
COMMENT ON COLUMN shopify_sessions.expires_at IS 'When this session expires';
COMMENT ON COLUMN shopify_sessions.session_token_hash IS 'Hash of session token for tracking (header.payload only)';
COMMENT ON COLUMN shopify_sessions.user_agent IS 'User agent of the session';
COMMENT ON COLUMN shopify_sessions.ip_address IS 'IP address of the session';
COMMENT ON COLUMN shopify_sessions.is_active IS 'Whether this session is still active';

-- Create function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() 
RETURNS integer 
LANGUAGE plpgsql 
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM shopify_sessions 
  WHERE expires_at < now() 
  OR (last_used < now() - interval '7 days' AND is_active = false);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Create scheduled job to cleanup expired sessions (if pg_cron is available)
-- This will run daily at 2 AM
-- SELECT cron.schedule('cleanup-sessions', '0 2 * * *', 'SELECT cleanup_expired_sessions();');

-- Add trigger to automatically update last_used timestamp
CREATE OR REPLACE FUNCTION update_session_last_used()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_used = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_last_used
  BEFORE UPDATE ON shopify_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_used();