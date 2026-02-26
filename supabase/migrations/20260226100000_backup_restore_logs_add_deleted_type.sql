-- Allow backup_deleted in backup_restore_logs
ALTER TABLE public.backup_restore_logs
  DROP CONSTRAINT IF EXISTS backup_restore_logs_type_check;

ALTER TABLE public.backup_restore_logs
  ADD CONSTRAINT backup_restore_logs_type_check
  CHECK (type IN ('backup', 'restore', 'backup_deleted'));
