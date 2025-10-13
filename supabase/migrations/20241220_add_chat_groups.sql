-- Add group field to chat_history table
ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS group_type text DEFAULT 'general';

-- Add check constraint after column is created
ALTER TABLE public.chat_history 
ADD CONSTRAINT chat_history_group_type_check CHECK (group_type IN ('general', 'innovation', 'operations', 'growth'));

-- Add index for better performance when filtering by group
CREATE INDEX IF NOT EXISTS idx_chat_history_group_type ON public.chat_history(group_type);

-- Add index for user_id and group_type combination
CREATE INDEX IF NOT EXISTS idx_chat_history_user_group ON public.chat_history(user_id, group_type);

-- Update existing records to have default group
UPDATE public.chat_history 
SET group_type = 'general' 
WHERE group_type IS NULL;
