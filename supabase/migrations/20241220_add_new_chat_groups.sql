-- Add new chat groups: financials, competitors, business-foundations
-- Remove the existing check constraint if it exists
ALTER TABLE public.chat_history
DROP CONSTRAINT IF EXISTS chat_history_group_type_check;

-- Add the check constraint with all valid group types
ALTER TABLE public.chat_history
ADD CONSTRAINT chat_history_group_type_check CHECK (group_type IN ('general', 'innovation', 'operations', 'growth', 'financials', 'competitors', 'business-foundations'));

-- Update any existing records that might have invalid group types to 'general'
UPDATE public.chat_history 
SET group_type = 'general' 
WHERE group_type NOT IN ('general', 'innovation', 'operations', 'growth', 'financials', 'competitors', 'business-foundations');
