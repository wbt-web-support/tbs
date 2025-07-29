-- Create leave entitlements table
CREATE TABLE IF NOT EXISTS public.leave_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  total_entitlement_days integer NOT NULL DEFAULT 25,
  year integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leave_entitlements_pkey PRIMARY KEY (id),
  CONSTRAINT leave_entitlements_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT leave_entitlements_team_year_unique UNIQUE (team_id, year)
);

-- Create leave approvals table
CREATE TABLE IF NOT EXISTS public.leave_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leave_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  comments text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leave_approvals_pkey PRIMARY KEY (id),
  CONSTRAINT leave_approvals_leave_id_fkey FOREIGN KEY (leave_id) REFERENCES public.team_leaves(id) ON DELETE CASCADE,
  CONSTRAINT leave_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_team_id ON public.leave_entitlements(team_id);
CREATE INDEX IF NOT EXISTS idx_leave_entitlements_year ON public.leave_entitlements(year);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_leave_id ON public.leave_approvals(leave_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_approver_id ON public.leave_approvals(approver_id);

-- Enable RLS
ALTER TABLE public.leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_entitlements
CREATE POLICY "Team admins can manage leave entitlements" ON public.leave_entitlements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid() 
      AND bi.team_id = leave_entitlements.team_id
      AND bi.role = 'admin'
    )
  );

CREATE POLICY "Team members can view leave entitlements" ON public.leave_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid() 
      AND bi.team_id = leave_entitlements.team_id
    )
  );

-- RLS Policies for leave_approvals
CREATE POLICY "Team admins can manage leave approvals" ON public.leave_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid() 
      AND bi.team_id = (
        SELECT bi2.team_id FROM public.business_info bi2
        JOIN public.team_leaves tl ON bi2.user_id = tl.user_id
        WHERE tl.id = leave_approvals.leave_id
      )
      AND bi.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own leave approvals" ON public.leave_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_leaves tl
      WHERE tl.id = leave_approvals.leave_id
      AND tl.user_id = auth.uid()
    )
  );

-- Create function to calculate remaining leave days for a user
CREATE OR REPLACE FUNCTION calculate_remaining_leave_days(
  p_user_id uuid,
  p_year integer
)
RETURNS TABLE(
  total_entitlement integer,
  used_leave_days integer,
  bank_holidays integer,
  remaining_days integer
) AS $$
BEGIN
  RETURN QUERY
  WITH user_team AS (
    SELECT team_id FROM public.business_info WHERE user_id = p_user_id
  ),
  entitlement AS (
    SELECT total_entitlement_days 
    FROM public.leave_entitlements le
    JOIN user_team ut ON le.team_id = ut.team_id
    WHERE le.year = p_year
  ),
  used_leave AS (
    SELECT COALESCE(SUM(duration_days), 0) as used_days
    FROM public.team_leaves
    WHERE user_id = p_user_id 
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND status IN ('approved', 'pending')
  ),
  bank_holidays_count AS (
    SELECT COUNT(*)::integer as bank_holiday_count
    FROM public.bank_holidays
    WHERE year = p_year AND is_active = true
  )
  SELECT 
    COALESCE(e.total_entitlement_days, 25) as total_entitlement,
    COALESCE(ul.used_days, 0) as used_leave_days,
    COALESCE(bh.bank_holiday_count, 0) as bank_holidays,
    COALESCE(e.total_entitlement_days, 25) - COALESCE(ul.used_days, 0) as remaining_days
  FROM entitlement e
  CROSS JOIN used_leave ul
  CROSS JOIN bank_holidays_count bh;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leave_entitlements_updated_at
  BEFORE UPDATE ON public.leave_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 