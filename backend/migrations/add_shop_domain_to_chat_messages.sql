-- Migration to add shop_domain to chat_messages table
-- This allows us to query chat_messages directly without joining with chat_sessions

-- Add shop_domain column to chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS shop_domain VARCHAR(255);

-- Update existing records to populate shop_domain from chat_sessions
UPDATE chat_messages 
SET shop_domain = cs.shop_domain
FROM chat_sessions cs
WHERE chat_messages.session_id = cs.id
AND chat_messages.shop_domain IS NULL;

-- Add foreign key constraint for shop_domain
ALTER TABLE chat_messages 
ADD CONSTRAINT fk_chat_messages_shop_domain 
FOREIGN KEY (shop_domain) REFERENCES stores(shop_domain) ON DELETE CASCADE;

-- Add index for better performance on shop_domain queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_domain 
ON chat_messages(shop_domain);

-- Add composite index for shop_domain and session_id (for conversation queries)
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_session 
ON chat_messages(shop_domain, session_id, timestamp);

-- Add index for analytics queries (shop_domain + timestamp)
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_timestamp 
ON chat_messages(shop_domain, timestamp);

-- Update the table to make shop_domain NOT NULL for future records
-- (We'll keep it nullable for now to avoid breaking existing data)

COMMENT ON COLUMN chat_messages.shop_domain IS 'Shop domain copied from session for direct queries without joins';