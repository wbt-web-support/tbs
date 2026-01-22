-- Update machines table foreign key to reference global_services instead of services
-- Drop old foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'machines_service_id_fkey'
  ) THEN
    ALTER TABLE public.machines DROP CONSTRAINT machines_service_id_fkey;
  END IF;
END $$;

-- Ensure service_id column exists
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS service_id UUID;

-- Add new foreign key constraint to global_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'machines_service_id_fkey'
  ) THEN
    ALTER TABLE public.machines 
    ADD CONSTRAINT machines_service_id_fkey 
    FOREIGN KEY (service_id) REFERENCES public.global_services(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the old services table (after migration is complete)
-- Note: This should be done carefully in production
-- Uncomment the line below only after verifying all data has been migrated
-- DROP TABLE IF EXISTS public.services CASCADE;
