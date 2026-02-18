-- 019: Voice Agent (Retell AI integration)
-- Adds voice agent config columns to client_stores and creates voice_call_logs table

-- New columns in client_stores for voice agent configuration
-- (retell_agent_id and retell_from_number already exist from migration 017)
ALTER TABLE client_stores
  ADD COLUMN IF NOT EXISTS retell_llm_id TEXT,
  ADD COLUMN IF NOT EXISTS retell_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS voice_agent_enabled BOOLEAN DEFAULT FALSE,
  -- Voice settings
  ADD COLUMN IF NOT EXISTS voice_agent_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_agent_language TEXT DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS voice_agent_voice_speed NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS voice_agent_voice_temperature NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS voice_agent_responsiveness NUMERIC DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS voice_agent_interruption_sensitivity NUMERIC DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS voice_agent_enable_backchannel BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS voice_agent_ambient_sound TEXT,
  ADD COLUMN IF NOT EXISTS voice_agent_max_call_duration_ms INTEGER DEFAULT 1800000,
  ADD COLUMN IF NOT EXISTS voice_agent_end_call_after_silence_ms INTEGER DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS voice_agent_boosted_keywords TEXT[],
  -- Prompt settings
  ADD COLUMN IF NOT EXISTS voice_agent_prompt TEXT,
  ADD COLUMN IF NOT EXISTS voice_agent_begin_message TEXT,
  ADD COLUMN IF NOT EXISTS voice_agent_model TEXT DEFAULT 'gpt-4.1-mini',
  ADD COLUMN IF NOT EXISTS voice_agent_model_temperature NUMERIC;

-- Voice call logs table
CREATE TABLE IF NOT EXISTS voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain TEXT NOT NULL,
  retell_call_id TEXT UNIQUE,
  agent_id TEXT,
  from_number TEXT,
  to_number TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT CHECK (status IN ('started', 'ended', 'error')) DEFAULT 'started',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  disconnection_reason TEXT,
  transcript TEXT,
  call_summary TEXT,
  user_sentiment TEXT,
  call_successful BOOLEAN,
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice_call_logs
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_shop_domain ON voice_call_logs(shop_domain);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_retell_call_id ON voice_call_logs(retell_call_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_started_at ON voice_call_logs(started_at);

-- Update plans features to include voice_agents flag
UPDATE plans SET features = features || '{"voice_agents": false}'::jsonb
  WHERE slug IN ('free', 'starter') AND NOT (features ? 'voice_agents');

UPDATE plans SET features = features || '{"voice_agents": true}'::jsonb
  WHERE slug IN ('professional', 'enterprise') AND NOT (features ? 'voice_agents');
