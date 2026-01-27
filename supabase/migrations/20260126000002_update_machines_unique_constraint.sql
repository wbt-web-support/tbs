-- Update machines table unique constraint to use subcategory_id instead of service_id
-- This migration handles the transition from service-based to subcategory-based machines

-- Step 1: Drop the old unique constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'machines_user_service_engine_unique'
  ) THEN
    ALTER TABLE public.machines
    DROP CONSTRAINT machines_user_service_engine_unique;
    
    RAISE NOTICE 'Dropped old unique constraint machines_user_service_engine_unique';
  END IF;
END $$;

-- Step 2: Drop the old index if it exists
DROP INDEX IF EXISTS idx_machines_user_service_engine;

-- Step 3: Add new unique constraint for subcategory-based machines
-- This ensures only one machine per subcategory per engine type per user
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'machines_user_subcategory_engine_unique'
  ) THEN
    -- Add unique constraint for machines with subcategory_id
    ALTER TABLE public.machines
    ADD CONSTRAINT machines_user_subcategory_engine_unique 
    UNIQUE (user_id, subcategory_id, enginetype);
    
    RAISE NOTICE 'Added new unique constraint machines_user_subcategory_engine_unique';
  END IF;
END $$;

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_user_subcategory_engine 
ON public.machines (user_id, subcategory_id, enginetype) 
WHERE subcategory_id IS NOT NULL;

-- Step 5: For backward compatibility, also create index for service_id-based machines
CREATE INDEX IF NOT EXISTS idx_machines_user_service_engine_legacy 
ON public.machines (user_id, service_id, enginetype) 
WHERE service_id IS NOT NULL AND subcategory_id IS NULL;

-- Note: Machines with service_id but no subcategory_id are legacy machines
-- They will be migrated in a separate migration script
