-- Add widget_avatar_url column to client_stores for custom avatar image uploads
ALTER TABLE client_stores ADD COLUMN IF NOT EXISTS widget_avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN client_stores.widget_avatar_url IS 'URL of uploaded avatar image for the widget header. When set, overrides widget_avatar emoji.';
