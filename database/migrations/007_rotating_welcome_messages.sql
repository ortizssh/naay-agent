-- =====================================================
-- Migration: Rotating Welcome Messages
-- Description: Add support for multiple rotating welcome messages in widget
-- =====================================================

-- Add new rotating welcome message columns to client_stores
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS widget_rotating_messages_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS widget_welcome_message_2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS widget_subtitle_2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS widget_welcome_message_3 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS widget_subtitle_3 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS widget_rotating_messages_interval INTEGER DEFAULT 5;

-- Add constraint for interval range (2 to 15 seconds)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_rotating_messages_interval_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_rotating_messages_interval_check
        CHECK (widget_rotating_messages_interval >= 2 AND widget_rotating_messages_interval <= 15);
    END IF;
END $$;

-- =====================================================
-- IMPORTANT: Run this migration in Supabase SQL Editor
-- =====================================================
