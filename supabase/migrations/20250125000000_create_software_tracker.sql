-- Software Tracker Migration
-- Creates a table to track software subscriptions and tools used by departments

CREATE TABLE IF NOT EXISTS public.software (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  software text NOT NULL,
  url text,
  description text,
  price_monthly numeric(10, 2),
  department_id uuid,
  team_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT software_pkey PRIMARY KEY (id),
  CONSTRAINT software_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL,
  CONSTRAINT software_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.software IS 'Tracks software subscriptions and tools used by departments with monthly pricing.';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_software_team_id ON public.software(team_id);
CREATE INDEX IF NOT EXISTS idx_software_department_id ON public.software(department_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_software_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_software_updated_at
  BEFORE UPDATE ON public.software
  FOR EACH ROW
  EXECUTE FUNCTION update_software_updated_at();

