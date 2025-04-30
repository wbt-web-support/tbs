-- Remove completion and user_id fields from main tables since we're using claim tables

-- Remove fields from chq_timeline
ALTER TABLE public.chq_timeline
DROP COLUMN IF EXISTS is_completed,
DROP COLUMN IF EXISTS completion_date,
DROP COLUMN IF EXISTS user_id;

-- Remove fields from chq_checklist
ALTER TABLE public.chq_checklist
DROP COLUMN IF EXISTS completed,
DROP COLUMN IF EXISTS completion_date,
DROP COLUMN IF EXISTS user_id;

-- Remove fields from chq_benefits
ALTER TABLE public.chq_benefits
DROP COLUMN IF EXISTS claimed,
DROP COLUMN IF EXISTS claimed_date,
DROP COLUMN IF EXISTS user_id;

-- Drop old indices that are no longer needed
DROP INDEX IF EXISTS idx_timeline_user_id;
DROP INDEX IF EXISTS idx_checklist_user_id;
DROP INDEX IF EXISTS idx_benefits_user_id;
DROP INDEX IF EXISTS idx_timeline_completed;
DROP INDEX IF EXISTS idx_checklist_completed;
DROP INDEX IF EXISTS idx_benefits_claimed; 