-- Migration: Add widget_show_contact toggle to client_stores
-- Enables/disables the phone contact button in the chat widget

ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS widget_show_contact BOOLEAN DEFAULT FALSE;
