-- Create services table for multi-service machine support
-- Each team can have multiple services (e.g., Plumbing, Electrical, HVAC)
-- Each service can have both Growth and Fulfillment machines

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'services_team_id_fkey'
  ) THEN
    ALTER TABLE public.services
    ADD CONSTRAINT services_team_id_fkey 
    FOREIGN KEY (team_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_services_team_id ON public.services(team_id);

-- Create trigger for updated_at
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.services IS 'Stores business services for each team (e.g., Plumbing, Electrical, HVAC)';
COMMENT ON COLUMN public.services.team_id IS 'References the team owner (auth.users.id)';
COMMENT ON COLUMN public.services.service_name IS 'Name of the service offering';
