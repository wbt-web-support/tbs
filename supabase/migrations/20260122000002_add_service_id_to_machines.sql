-- Add service_id column to machines table
-- This links machines to specific services, allowing multiple machines per service type
-- Initially nullable and without foreign key (will be added later after global_services is created)

ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS service_id UUID;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_machines_service_id ON public.machines(service_id);

-- Add comment for documentation
COMMENT ON COLUMN public.machines.service_id IS 'Links machine to a specific service. NULL for backward compatibility with existing machines.';
