-- Add order field to global_services table
-- First add as nullable with default
ALTER TABLE public.global_services 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing rows with sequential order based on created_at
UPDATE public.global_services
SET display_order = sub.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(created_at, '1970-01-01'::timestamp)) as row_num
  FROM public.global_services
) sub
WHERE global_services.id = sub.id;

-- Now set NOT NULL constraint
ALTER TABLE public.global_services 
ALTER COLUMN display_order SET NOT NULL;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_global_services_order ON public.global_services(display_order);
