-- Fix webhook_events table by adding missing columns
-- This script handles cases where the table already exists but is missing some columns

-- First, let's add the missing columns if they don't exist
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Ensure the table has the correct structure
-- If the table exists but doesn't have the id column as uuid, we need to handle it differently
DO $$
BEGIN
    -- Check if id column exists and is the right type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        -- If id doesn't exist or is wrong type, add it
        ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
        
        -- If there's no primary key on id, add it (but only if the column exists and has no nulls)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'webhook_events' 
            AND constraint_type = 'PRIMARY KEY'
        ) THEN
            -- Update any null ids first
            UPDATE webhook_events SET id = gen_random_uuid() WHERE id IS NULL;
            -- Add primary key constraint
            ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);
        END IF;
    END IF;
    
    -- Ensure other required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'shop_domain'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN shop_domain varchar(255) NOT NULL DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'topic'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN topic varchar(100) NOT NULL DEFAULT '';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'payload'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'verified'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN verified boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'processed'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN processed boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_events' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE webhook_events ADD COLUMN created_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_webhook_events_shop_domain ON webhook_events(shop_domain);
CREATE INDEX IF NOT EXISTS idx_webhook_events_topic ON webhook_events(topic);
CREATE INDEX IF NOT EXISTS idx_webhook_events_verified ON webhook_events(verified);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Add widget_enabled column to stores table if it doesn't exist
ALTER TABLE stores ADD COLUMN IF NOT EXISTS widget_enabled boolean DEFAULT true;

-- Create RLS (Row Level Security) policies only if they don't exist
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
    
    -- Create policies only if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'webhook_events' 
        AND policyname = 'Service role can manage webhook events'
    ) THEN
        CREATE POLICY "Service role can manage webhook events" ON webhook_events
          FOR ALL USING (auth.role() = 'service_role');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'webhook_events' 
        AND policyname = 'Users can view their store''s webhook events'
    ) THEN
        CREATE POLICY "Users can view their store's webhook events" ON webhook_events
          FOR SELECT USING (
            auth.role() = 'authenticated' 
            AND shop_domain IN (
              SELECT shop_domain FROM stores 
              WHERE auth.uid()::text = ANY(string_to_array(access_token, '.'))
            )
          );
    END IF;
EXCEPTION
    WHEN others THEN
        -- If RLS policies fail (maybe auth schema doesn't exist), just continue
        RAISE NOTICE 'Could not create RLS policies: %', SQLERRM;
END $$;

-- Add comments to table and columns
COMMENT ON TABLE webhook_events IS 'Log of all webhook events received from Shopify';

-- Add column comments (these are safe to run multiple times)
DO $$
BEGIN
    COMMENT ON COLUMN webhook_events.shop_domain IS 'The Shopify shop domain that sent the webhook';
    COMMENT ON COLUMN webhook_events.topic IS 'The webhook topic/event type';
    COMMENT ON COLUMN webhook_events.payload IS 'The full webhook payload as JSON';
    COMMENT ON COLUMN webhook_events.verified IS 'Whether the webhook signature was verified';
    COMMENT ON COLUMN webhook_events.processed IS 'Whether the webhook was successfully processed';
    COMMENT ON COLUMN webhook_events.error_message IS 'Any error message if processing failed';
    COMMENT ON COLUMN webhook_events.retry_count IS 'Number of times processing was retried';
EXCEPTION
    WHEN others THEN
        -- Comments might fail if columns don't exist yet, that's OK
        NULL;
END $$;