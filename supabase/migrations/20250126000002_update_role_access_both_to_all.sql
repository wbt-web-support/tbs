-- Update any existing records that use 'both' to 'all' for role_access
-- This migration ensures data consistency after changing the enum value
UPDATE ai_instructions
SET role_access = 'all'
WHERE role_access = 'both';

-- Note: If you have existing data, you may want to verify this update
-- The constraint will prevent new 'both' values from being inserted

