-- =====================================================
-- Migration: Widget Design Settings
-- Description: Add advanced widget customization fields to client_stores
-- =====================================================

-- Add new widget design columns to client_stores
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS widget_secondary_color VARCHAR(20) DEFAULT '#212120',
ADD COLUMN IF NOT EXISTS widget_accent_color VARCHAR(20) DEFAULT '#cf795e',
ADD COLUMN IF NOT EXISTS widget_button_size INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS widget_button_style VARCHAR(20) DEFAULT 'circle',
ADD COLUMN IF NOT EXISTS widget_show_pulse BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS widget_chat_width INTEGER DEFAULT 420,
ADD COLUMN IF NOT EXISTS widget_chat_height INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS widget_subtitle TEXT DEFAULT 'Asistente de compras con IA',
ADD COLUMN IF NOT EXISTS widget_placeholder TEXT DEFAULT 'Escribe tu mensaje...',
ADD COLUMN IF NOT EXISTS widget_avatar VARCHAR(20) DEFAULT '🌿',
ADD COLUMN IF NOT EXISTS widget_show_promo_message BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS widget_show_cart BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS widget_enable_animations BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS widget_theme VARCHAR(20) DEFAULT 'light',
ADD COLUMN IF NOT EXISTS widget_brand_name VARCHAR(100) DEFAULT 'Kova';

-- Add constraint for button_style
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_button_style_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_button_style_check
        CHECK (widget_button_style IN ('circle', 'rounded', 'square'));
    END IF;
END $$;

-- Add constraint for widget_theme
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_theme_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_theme_check
        CHECK (widget_theme IN ('light', 'dark'));
    END IF;
END $$;

-- Add constraints for size ranges
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_button_size_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_button_size_check
        CHECK (widget_button_size >= 56 AND widget_button_size <= 80);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_chat_width_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_chat_width_check
        CHECK (widget_chat_width >= 320 AND widget_chat_width <= 500);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_stores_widget_chat_height_check'
    ) THEN
        ALTER TABLE client_stores
        ADD CONSTRAINT client_stores_widget_chat_height_check
        CHECK (widget_chat_height >= 400 AND widget_chat_height <= 700);
    END IF;
END $$;

-- =====================================================
-- IMPORTANT: Run this migration in Supabase SQL Editor
-- =====================================================
