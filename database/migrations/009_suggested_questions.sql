-- Migration: Add suggested questions and promo badge type fields
-- Date: 2026-02-06
-- Description: Adds fields for customizable suggested questions and promo badge type

-- Add promo badge type (discount or notice)
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS promo_badge_type TEXT DEFAULT 'discount';

COMMENT ON COLUMN client_stores.promo_badge_type IS 'Type of promo badge: discount (shows percentage) or notice (shows custom text)';

-- Add suggested questions fields
ALTER TABLE client_stores
ADD COLUMN IF NOT EXISTS suggested_question_1_text TEXT DEFAULT 'Recomendaciones personalizadas',
ADD COLUMN IF NOT EXISTS suggested_question_1_message TEXT DEFAULT '¿Qué productos recomiendas para mí?',
ADD COLUMN IF NOT EXISTS suggested_question_2_text TEXT DEFAULT 'Ayuda con mi compra',
ADD COLUMN IF NOT EXISTS suggested_question_2_message TEXT DEFAULT '¿Puedes ayudarme a elegir productos?',
ADD COLUMN IF NOT EXISTS suggested_question_3_text TEXT DEFAULT 'Información de envío',
ADD COLUMN IF NOT EXISTS suggested_question_3_message TEXT DEFAULT '¿Cuáles son las opciones de envío?';

-- Add comment for documentation
COMMENT ON COLUMN client_stores.suggested_question_1_text IS 'Display text for first suggested question chip';
COMMENT ON COLUMN client_stores.suggested_question_1_message IS 'Message sent to AI when first chip is clicked';
COMMENT ON COLUMN client_stores.suggested_question_2_text IS 'Display text for second suggested question chip';
COMMENT ON COLUMN client_stores.suggested_question_2_message IS 'Message sent to AI when second chip is clicked';
COMMENT ON COLUMN client_stores.suggested_question_3_text IS 'Display text for third suggested question chip';
COMMENT ON COLUMN client_stores.suggested_question_3_message IS 'Message sent to AI when third chip is clicked';
