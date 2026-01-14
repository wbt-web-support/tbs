-- Rename threeyeartarget column to fiveyeartarget in battle_plan table
-- Step 1: Add the new column
ALTER TABLE public.battle_plan 
ADD COLUMN IF NOT EXISTS fiveyeartarget jsonb[] DEFAULT '{}'::jsonb[];

-- Step 2: Migrate existing data from threeyeartarget to fiveyeartarget
UPDATE public.battle_plan 
SET fiveyeartarget = threeyeartarget 
WHERE threeyeartarget IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE public.battle_plan 
DROP COLUMN IF EXISTS threeyeartarget;
