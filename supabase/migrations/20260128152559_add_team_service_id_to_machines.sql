-- Add team_service_id column to machines table
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS team_service_id uuid;

-- Add foreign key constraint
ALTER TABLE public.machines
ADD CONSTRAINT machines_team_service_id_fkey 
FOREIGN KEY (team_service_id) 
REFERENCES public.team_services(id) 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_machines_team_service_id 
ON public.machines USING btree (team_service_id);

-- Add unique constraint to prevent duplicate machines per team_service + engine type
-- First, remove any existing duplicates (keep the most recent one)
WITH ranked_machines AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, enginetype, team_service_id 
      ORDER BY created_at DESC
    ) as rn
  FROM public.machines
  WHERE team_service_id IS NOT NULL
)
DELETE FROM public.machines
WHERE id IN (
  SELECT id FROM ranked_machines WHERE rn > 1
);

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_unique_team_service_engine
ON public.machines (team_service_id, enginetype)
WHERE team_service_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.machines.team_service_id IS 'Links machine to a specific team service assignment';
