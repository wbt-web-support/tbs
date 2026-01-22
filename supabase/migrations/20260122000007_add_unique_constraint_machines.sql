-- Add unique constraint to prevent duplicate machines for same user+service+enginetype
-- This ensures only one machine per service per engine type per user

-- Step 1: Clean up duplicate machines - keep the most recent one with data, or just the most recent
DO $$ 
DECLARE
  duplicate_record RECORD;
BEGIN
  -- Find and remove duplicates, keeping the best one for each group
  FOR duplicate_record IN 
    SELECT user_id, service_id, enginetype, COUNT(*) as count
    FROM public.machines
    WHERE service_id IS NOT NULL
    GROUP BY user_id, service_id, enginetype
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent machine with the most data for this combination
    DELETE FROM public.machines
    WHERE id NOT IN (
      SELECT id FROM public.machines
      WHERE user_id = duplicate_record.user_id 
        AND service_id = duplicate_record.service_id 
        AND enginetype = duplicate_record.enginetype
      ORDER BY 
        -- Prioritize machines with questions
        (CASE WHEN questions IS NOT NULL THEN 1 ELSE 0 END) DESC,
        -- Then by most recent update
        updated_at DESC,
        -- Then by most recent creation
        created_at DESC
      LIMIT 1
    )
    AND user_id = duplicate_record.user_id 
    AND service_id = duplicate_record.service_id 
    AND enginetype = duplicate_record.enginetype;
    
    RAISE NOTICE 'Cleaned up duplicates for user: %, service: %, engine: %', 
      duplicate_record.user_id, duplicate_record.service_id, duplicate_record.enginetype;
  END LOOP;
END $$;

-- Step 2: Add unique constraint now that duplicates are removed
DO $$ 
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'machines_user_service_engine_unique'
  ) THEN
    -- Add unique constraint
    ALTER TABLE public.machines
    ADD CONSTRAINT machines_user_service_engine_unique 
    UNIQUE (user_id, service_id, enginetype);
    
    RAISE NOTICE 'Added unique constraint machines_user_service_engine_unique';
  END IF;
END $$;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_user_service_engine 
ON public.machines (user_id, service_id, enginetype);
