-- Fix any existing records that have invalid role_access values
-- The constraint only allows 'admin', 'user', or 'all'
-- This migration fixes existing data and ensures data integrity

-- Step 1: Temporarily disable the constraint to allow fixing data
ALTER TABLE ai_instructions DROP CONSTRAINT IF EXISTS ai_instructions_role_access_check;

-- Step 2: Fix all invalid role_access values
-- Handle case sensitivity, whitespace, and null values
UPDATE ai_instructions
SET role_access = 'all'
WHERE role_access IS NULL
   OR TRIM(LOWER(role_access)) NOT IN ('admin', 'user', 'all');

-- Step 3: Normalize all role_access values (trim and lowercase)
UPDATE ai_instructions
SET role_access = LOWER(TRIM(role_access))
WHERE role_access IS NOT NULL;

-- Step 4: Recreate the constraint with the correct definition
ALTER TABLE ai_instructions
ADD CONSTRAINT ai_instructions_role_access_check
CHECK (role_access IN ('admin', 'user', 'all'));

-- Step 5: Verify the fix
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM ai_instructions
    WHERE role_access IS NULL OR role_access NOT IN ('admin', 'user', 'all');
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: Still found % rows with invalid role_access values', invalid_count;
    ELSE
        RAISE NOTICE 'Migration successful: All role_access values are now valid';
    END IF;
END $$;

