-- Migration: Create Comprehensive GHL Schema
-- Description: Adds tables for contacts cache, calendar settings, appointments, and field mappings for GHL integration.

-- 1. Table for GHL Field Mappings (Mapping TBS data to GHL custom fields and pipelines)
CREATE TABLE IF NOT EXISTS public.ghl_field_mappings (
  mapping_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  mapping_name text NOT NULL,
  pipeline_id text,
  opportunity_stage text,
  field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ghl_field_mappings_pkey PRIMARY KEY (mapping_id),
  CONSTRAINT ghl_field_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 2. Table for GHL Contacts Cache (Local storage for GHL contacts)
CREATE TABLE IF NOT EXISTS public.ghl_contacts_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  ghl_contact_id text NOT NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  contact_name text,
  type text DEFAULT 'lead',
  source text,
  address1 text,
  city text,
  state text,
  country text,
  postal_code text,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  assigned_to text,
  date_added timestamp with time zone,
  last_synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ghl_contacts_cache_pkey PRIMARY KEY (id),
  CONSTRAINT ghl_contacts_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT ghl_contacts_cache_unique_contact UNIQUE (user_id, ghl_contact_id)
);

-- 3. Table for GHL Calendar Settings (Configuration for created calendars)
CREATE TABLE IF NOT EXISTS public.ghl_calendar_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  ghl_calendar_id text NOT NULL,
  name text NOT NULL,
  description text,
  purpose text, -- e.g., 'primary', 'sales', 'support'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ghl_calendar_settings_pkey PRIMARY KEY (id),
  CONSTRAINT ghl_calendar_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 4. Table for GHL Appointments Cache (2-way sync local storage)
CREATE TABLE IF NOT EXISTS public.ghl_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid,
  ghl_appointment_id text NOT NULL,
  ghl_calendar_id text NOT NULL,
  ghl_contact_id text,
  title text,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status text, -- e.g., 'confirmed', 'cancelled', 'rescheduled'
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ghl_appointments_pkey PRIMARY KEY (id),
  CONSTRAINT ghl_appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT ghl_appointments_unique_id UNIQUE (ghl_appointment_id)
);

-- Enable RLS for all tables
ALTER TABLE public.ghl_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_contacts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_appointments ENABLE ROW LEVEL SECURITY;

-- Indexing for better performance
CREATE INDEX IF NOT EXISTS idx_ghl_field_mappings_user_id ON public.ghl_field_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_field_mappings_team_id ON public.ghl_field_mappings(team_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_cache_user_id ON public.ghl_contacts_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_cache_email ON public.ghl_contacts_cache(email);
CREATE INDEX IF NOT EXISTS idx_ghl_calendar_settings_user_id ON public.ghl_calendar_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_appointments_user_id ON public.ghl_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_ghl_appointments_start_time ON public.ghl_appointments(start_time);

-- RLS Policies (Standard pattern: user/team ownership)
DO $$
BEGIN
    -- Field Mappings
    CREATE POLICY "Users can view GHL field mappings" ON public.ghl_field_mappings FOR SELECT USING (auth.uid() = user_id OR (team_id IS NOT NULL AND team_id IN (SELECT team_id FROM business_info WHERE user_id = auth.uid())));
    CREATE POLICY "Users can manage their GHL field mappings" ON public.ghl_field_mappings FOR ALL USING (auth.uid() = user_id);

    -- Contacts Cache
    CREATE POLICY "Users can view GHL contacts cache" ON public.ghl_contacts_cache FOR SELECT USING (auth.uid() = user_id OR (team_id IS NOT NULL AND team_id IN (SELECT team_id FROM business_info WHERE user_id = auth.uid())));
    CREATE POLICY "Users can manage GHL contacts cache" ON public.ghl_contacts_cache FOR ALL USING (auth.uid() = user_id);

    -- Calendar Settings
    CREATE POLICY "Users can view GHL calendar settings" ON public.ghl_calendar_settings FOR SELECT USING (auth.uid() = user_id OR (team_id IS NOT NULL AND team_id IN (SELECT team_id FROM business_info WHERE user_id = auth.uid())));
    CREATE POLICY "Users can manage GHL calendar settings" ON public.ghl_calendar_settings FOR ALL USING (auth.uid() = user_id);

    -- Appointments
    CREATE POLICY "Users can view GHL appointments" ON public.ghl_appointments FOR SELECT USING (auth.uid() = user_id OR (team_id IS NOT NULL AND team_id IN (SELECT team_id FROM business_info WHERE user_id = auth.uid())));
    CREATE POLICY "Users can manage GHL appointments" ON public.ghl_appointments FOR ALL USING (auth.uid() = user_id);
END
$$;

-- Trigger Function for updated_at
CREATE OR REPLACE FUNCTION update_ghl_table_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
CREATE TRIGGER update_ghl_field_mappings_timestamp BEFORE UPDATE ON public.ghl_field_mappings FOR EACH ROW EXECUTE FUNCTION update_ghl_table_timestamp();
CREATE TRIGGER update_ghl_contacts_cache_timestamp BEFORE UPDATE ON public.ghl_contacts_cache FOR EACH ROW EXECUTE FUNCTION update_ghl_table_timestamp();
CREATE TRIGGER update_ghl_calendar_settings_timestamp BEFORE UPDATE ON public.ghl_calendar_settings FOR EACH ROW EXECUTE FUNCTION update_ghl_table_timestamp();
CREATE TRIGGER update_ghl_appointments_timestamp BEFORE UPDATE ON public.ghl_appointments FOR EACH ROW EXECUTE FUNCTION update_ghl_table_timestamp();
