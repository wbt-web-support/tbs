-- Fix the group_type constraint issue
-- First, drop the existing constraint if it exists
ALTER TABLE public.chat_history DROP CONSTRAINT IF EXISTS chat_history_group_type_check;

-- Update any NULL values to 'general'
UPDATE public.chat_history 
SET group_type = 'general' 
WHERE group_type IS NULL;

-- Add the constraint back
ALTER TABLE public.chat_history 
ADD CONSTRAINT chat_history_group_type_check CHECK (group_type IN ('general', 'innovation', 'operations', 'growth'));
