-- Simple shopify_sessions table for modern authentication
CREATE TABLE IF NOT EXISTS shopify_sessions (
  session_id varchar(255) PRIMARY KEY,
  shop_domain varchar(255) NOT NULL,
  user_id varchar(255) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone DEFAULT now(),
  session_token_hash text,
  is_active boolean DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_domain ON shopify_sessions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_expires_at ON shopify_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop_user ON shopify_sessions(shop_domain, user_id);

-- Add comment to table
COMMENT ON TABLE shopify_sessions IS 'Session tracking for Shopify App Bridge authentication';