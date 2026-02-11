-- Migration: Add widget_show_contact toggle and retell_agent_id to client_stores
-- Enables/disables the phone contact button in the chat widget
-- Each client has their own Retell AI agent

ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS widget_show_contact BOOLEAN DEFAULT FALSE;
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS retell_agent_id TEXT DEFAULT NULL;
