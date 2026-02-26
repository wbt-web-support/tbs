-- Fix contradictory NOT NULL + ON DELETE SET NULL on triggered_by_user_id.
-- Audit logs should be preserved even if the triggering user is deleted.
ALTER TABLE public.backup_restore_logs
  ALTER COLUMN triggered_by_user_id DROP NOT NULL;
