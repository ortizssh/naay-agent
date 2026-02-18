-- Migration 020: Add monthly voice call limits to plans
-- Follows same pattern as monthly_messages for message counting

ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_voice_calls INTEGER DEFAULT 0;

-- Free and starter: no voice calls (feature disabled at plan level anyway)
UPDATE plans SET monthly_voice_calls = 0 WHERE slug IN ('free', 'starter');

-- Professional: 100 calls/month
UPDATE plans SET monthly_voice_calls = 100 WHERE slug = 'professional';

-- Enterprise: unlimited (-1)
UPDATE plans SET monthly_voice_calls = -1 WHERE slug = 'enterprise';
