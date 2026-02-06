-- =====================================================
-- Migration 009: Store Chatbot Endpoint
-- =====================================================
-- Adds a configurable chatbot endpoint per store
-- Replaces hardcoded n8n.dustkey.com endpoint

-- Add chatbot_endpoint column to client_stores table
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS chatbot_endpoint TEXT DEFAULT 'https://n8n.dustkey.com/webhook/kova-chat';

-- Add comment for documentation
COMMENT ON COLUMN client_stores.chatbot_endpoint IS 'Custom chatbot/AI endpoint URL for this store. Defaults to n8n.dustkey.com';
