-- Migration: Create admin impersonation audit log table
-- Purpose: Track all superadmin user impersonation activities for security and compliance
-- Created: 2025-02-09

-- Create the audit log table
CREATE TABLE IF NOT EXISTS public.admin_impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  impersonated_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('start', 'end')),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_impersonation_logs_superadmin ON public.admin_impersonation_logs(superadmin_id, created_at DESC);
CREATE INDEX idx_impersonation_logs_impersonated ON public.admin_impersonation_logs(impersonated_user_id, created_at DESC);
CREATE INDEX idx_impersonation_logs_active ON public.admin_impersonation_logs(superadmin_id, action, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Superadmins can view their own impersonation logs
CREATE POLICY "Superadmins can view their own impersonation logs"
  ON public.admin_impersonation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Policy: Only service role can insert logs (prevents user manipulation)
CREATE POLICY "Service role can insert impersonation logs"
  ON public.admin_impersonation_logs
  FOR INSERT
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.admin_impersonation_logs IS 'Audit trail for superadmin user impersonation activities';
COMMENT ON COLUMN public.admin_impersonation_logs.action IS 'Either "start" or "end" to track impersonation lifecycle';
COMMENT ON COLUMN public.admin_impersonation_logs.ip_address IS 'IP address of the superadmin at time of action';
COMMENT ON COLUMN public.admin_impersonation_logs.user_agent IS 'Browser user agent string for forensic tracking';
