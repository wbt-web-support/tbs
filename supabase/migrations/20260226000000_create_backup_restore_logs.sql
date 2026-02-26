-- Logs for backup and restore actions (superadmin)
CREATE TABLE IF NOT EXISTS public.backup_restore_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('backup', 'restore')),
  scope text NOT NULL,
  backup_path text NOT NULL,
  triggered_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_restore_logs_created_at ON public.backup_restore_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_restore_logs_type ON public.backup_restore_logs(type);

COMMENT ON TABLE public.backup_restore_logs IS 'Audit log for superadmin database backup and restore actions';

ALTER TABLE public.backup_restore_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read logs (via service role in API; no direct client access needed)
DROP POLICY IF EXISTS "Service role or super_admin only" ON public.backup_restore_logs;
CREATE POLICY "Service role or super_admin only" ON public.backup_restore_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Inserts are done via service role in API (bypasses RLS)
-- Allow super_admin to insert for backup/restore (API uses service role, so this is for consistency)
DROP POLICY IF EXISTS "Super_admin can insert logs" ON public.backup_restore_logs;
CREATE POLICY "Super_admin can insert logs" ON public.backup_restore_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );
