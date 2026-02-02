-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ensure app schema and settings table exist
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert or update edge function URL setting
-- Note: Update this URL if your Supabase project URL is different
INSERT INTO app.settings (key, value, description)
VALUES ('edge_function_url', 'https://npeajhtemjbcpnhsqknf.supabase.co/functions/v1', 'Base URL for Edge Functions')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- Insert or update service role key setting
-- IMPORTANT: You must update this value manually after migration with your actual service role key
-- You can do this by running:
-- UPDATE app.settings SET value = 'YOUR_SERVICE_ROLE_KEY' WHERE key = 'service_role_key';
INSERT INTO app.settings (key, value, description)
VALUES ('service_role_key', '', 'Service role key for Edge Function authentication')
ON CONFLICT (key) DO NOTHING;

-- Create trigger function to call edge function for embedding generation
CREATE OR REPLACE FUNCTION generate_business_owner_instruction_embedding()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  function_url text;
BEGIN
  -- Only process if content is not null/empty
  IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, only process if content actually changed
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.content = NEW.content) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get edge function URL and service role key from settings
  SELECT value INTO edge_function_url
  FROM app.settings
  WHERE key = 'edge_function_url';

  SELECT value INTO service_role_key
  FROM app.settings
  WHERE key = 'service_role_key';

  -- Skip if settings are not configured
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    RAISE WARNING 'edge_function_url not configured in app.settings';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'service_role_key not configured in app.settings';
    RETURN NEW;
  END IF;

  -- Construct full function URL
  function_url := edge_function_url || '/business-owner-instruction-embeddings';

  -- Call the Edge Function asynchronously via HTTP
  -- This is fire-and-forget, so errors won't block the INSERT/UPDATE
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'record_id', NEW.id,
        'content', NEW.content
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS business_owner_instructions_embedding_trigger ON business_owner_instructions;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER business_owner_instructions_embedding_trigger
AFTER INSERT OR UPDATE ON business_owner_instructions
FOR EACH ROW
EXECUTE FUNCTION generate_business_owner_instruction_embedding();
