-- Create GoHighLevel (GHL) integration table
-- Adapted from nu-home-main/supabase/migrations/20250120_add_ghl_integration_tables.sql

-- Table for storing GHL OAuth integration data
CREATE TABLE IF NOT EXISTS public.ghl_integrations (
  integration_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- The user who connected it
  team_id uuid, -- Optional: Scope to a team (using business_info team_id pattern)
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  company_id text NOT NULL,
  location_id text NULL, -- For sub-account tokens
  user_type text NOT NULL CHECK (user_type IN ('Company', 'Location')),
  scope text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ghl_integrations_pkey PRIMARY KEY (integration_id),
  CONSTRAINT ghl_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_user_id ON public.ghl_integrations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_team_id ON public.ghl_integrations USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_active ON public.ghl_integrations USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_company_id ON public.ghl_integrations USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_ghl_integrations_location_id ON public.ghl_integrations USING btree (location_id);

-- Enable RLS
ALTER TABLE public.ghl_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- 1. View: Users can view if they own it OR if they are in the same team
CREATE POLICY "Users can view their own or team GHL integrations" ON public.ghl_integrations
    FOR SELECT USING (
      auth.uid() = user_id OR 
      (team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM business_info WHERE user_id = auth.uid()
      ))
    );

-- 2. Insert: Users can insert for themselves (and optionally set team_id)
CREATE POLICY "Users can insert their own GHL integrations" ON public.ghl_integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Update: Users can update if they own it OR if they are team admins in the same team
-- (Assuming business_info has role column based on previous context, but strictly owner logic is safer for now, keeping it extensible)
CREATE POLICY "Users can update their own or team GHL integrations" ON public.ghl_integrations
    FOR UPDATE USING (
       auth.uid() = user_id OR 
       (team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM business_info WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'super_admin')
      ))
    );

-- 4. Delete: Only owner or team admin
CREATE POLICY "Users can delete their own or team GHL integrations" ON public.ghl_integrations
    FOR DELETE USING (
       auth.uid() = user_id OR 
       (team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM business_info WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'super_admin')
      ))
    );

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_ghl_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_ghl_integrations_timestamp ON public.ghl_integrations;
CREATE TRIGGER update_ghl_integrations_timestamp
  BEFORE UPDATE ON public.ghl_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_integration_timestamp();
