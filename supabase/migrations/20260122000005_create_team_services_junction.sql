-- Create junction table to connect teams to global services
-- This replaces the team-specific services table

CREATE TABLE IF NOT EXISTS public.team_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.global_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT team_services_unique UNIQUE (team_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_team_services_team_id ON public.team_services(team_id);
CREATE INDEX IF NOT EXISTS idx_team_services_service_id ON public.team_services(service_id);

-- Create trigger for updated_at
CREATE TRIGGER update_team_services_updated_at BEFORE UPDATE ON public.team_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.team_services IS 'Junction table connecting teams to global services';
COMMENT ON COLUMN public.team_services.team_id IS 'References the team (auth.users.id)';
COMMENT ON COLUMN public.team_services.service_id IS 'References the global service';

-- Migrate existing services to global services and create team_services entries
-- First, ensure "Default Service" exists in global_services
INSERT INTO public.global_services (service_name, category)
VALUES ('Default Service', 'General')
ON CONFLICT (service_name) DO NOTHING;

-- If old services table exists, migrate data from it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
    -- Insert unique service names from existing services table into global_services
    INSERT INTO public.global_services (service_name, category)
    SELECT DISTINCT service_name, 'General' as category
    FROM public.services
    WHERE service_name NOT IN (SELECT service_name FROM public.global_services)
    ON CONFLICT (service_name) DO NOTHING;

    -- Create team_services entries from existing services
    INSERT INTO public.team_services (team_id, service_id)
    SELECT s.team_id, gs.id
    FROM public.services s
    JOIN public.global_services gs ON s.service_name = gs.service_name
    ON CONFLICT (team_id, service_id) DO NOTHING;

    -- Update machines table to reference global_services instead of services
    -- Update service_id in machines to point to global_services
    UPDATE public.machines m
    SET service_id = gs.id
    FROM public.services s
    JOIN public.global_services gs ON s.service_name = gs.service_name
    WHERE m.service_id = s.id;
  END IF;
END $$;

-- For machines without service_id, link them to "Default Service"
UPDATE public.machines m
SET service_id = gs.id
FROM public.global_services gs
WHERE m.service_id IS NULL
  AND gs.service_name = 'Default Service';
