-- Migration: Create shopify_sessions table for modern Session Token authentication
-- This table stores both online and offline sessions for Shopify apps

-- Create shopify_sessions table
CREATE TABLE IF NOT EXISTS shopify_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT false,
  user_id VARCHAR(255), -- For online sessions, stores the Shopify user ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_domain ON shopify_sessions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_session_id ON shopify_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_user_id ON shopify_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_is_online ON shopify_sessions(is_online);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_expires_at ON shopify_sessions(expires_at);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_online ON shopify_sessions(shop_domain, is_online);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_user ON shopify_sessions(shop_domain, user_id);

-- Add RLS (Row Level Security) if needed
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (adjust as needed for your security requirements)
CREATE POLICY "Service role can access shopify_sessions" ON shopify_sessions
  FOR ALL USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shopify_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_shopify_sessions_updated_at ON shopify_sessions;
CREATE TRIGGER trigger_update_shopify_sessions_updated_at
  BEFORE UPDATE ON shopify_sessions
  FOR EACH ROW EXECUTE FUNCTION update_shopify_sessions_updated_at();

-- Add foreign key constraint to stores table if it exists
-- This will help maintain data integrity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores') THEN
    -- Add foreign key constraint if stores table exists
    ALTER TABLE shopify_sessions 
    ADD CONSTRAINT fk_shopify_sessions_store 
    FOREIGN KEY (shop_domain) 
    REFERENCES stores(shop_domain) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shopify_sessions 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE shopify_sessions IS 'Stores Shopify app session information for modern Session Token authentication';
COMMENT ON COLUMN shopify_sessions.shop_domain IS 'Shopify shop domain (e.g., mystore.myshopify.com)';
COMMENT ON COLUMN shopify_sessions.session_id IS 'Unique session identifier from Shopify';
COMMENT ON COLUMN shopify_sessions.access_token IS 'Access token for making API requests';
COMMENT ON COLUMN shopify_sessions.scope IS 'Granted scopes for this session';
COMMENT ON COLUMN shopify_sessions.expires_at IS 'Session expiration time (NULL for offline sessions)';
COMMENT ON COLUMN shopify_sessions.is_online IS 'Whether this is an online (user-specific) or offline (store-level) session';
COMMENT ON COLUMN shopify_sessions.user_id IS 'Shopify user ID for online sessions';

-- Optional: Create a view for active sessions
CREATE OR REPLACE VIEW active_shopify_sessions AS
SELECT 
  id,
  shop_domain,
  session_id,
  scope,
  is_online,
  user_id,
  expires_at,
  created_at,
  updated_at
FROM shopify_sessions
WHERE 
  expires_at IS NULL OR expires_at > NOW();

COMMENT ON VIEW active_shopify_sessions IS 'View of non-expired Shopify sessions';