-- Create global services table - universal list of all available services
-- This table contains all possible services that teams can select from

CREATE TABLE IF NOT EXISTS public.global_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_services_name ON public.global_services(service_name);
CREATE INDEX IF NOT EXISTS idx_global_services_active ON public.global_services(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_global_services_updated_at BEFORE UPDATE ON public.global_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.global_services IS 'Universal list of all available services that teams can select from';
COMMENT ON COLUMN public.global_services.service_name IS 'Name of the service (e.g., Plumbing, Electrical, HVAC)';
COMMENT ON COLUMN public.global_services.category IS 'Service category for grouping';
COMMENT ON COLUMN public.global_services.is_active IS 'Whether this service is currently available for selection';

-- Insert some common services
INSERT INTO public.global_services (service_name, category) VALUES
  ('Plumbing', 'Construction'),
  ('Electrical', 'Construction'),
  ('HVAC', 'Construction'),
  ('Roofing', 'Construction'),
  ('Landscaping', 'Outdoor'),
  ('Painting', 'Construction'),
  ('Flooring', 'Construction'),
  ('Carpentry', 'Construction'),
  ('General Contracting', 'Construction'),
  ('Handyman Services', 'General')
ON CONFLICT (service_name) DO NOTHING;
