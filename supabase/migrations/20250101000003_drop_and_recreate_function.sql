-- Drop and recreate the calculate_remaining_leave_days function to ensure proper type handling
DROP FUNCTION IF EXISTS calculate_remaining_leave_days(uuid, integer);

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
DECLARE
  v_total_entitlement integer := 25;
  v_used_leave_days integer := 0;
  v_bank_holidays integer := 0;
  v_remaining_days integer := 25;
BEGIN
  -- Get total entitlement
  SELECT COALESCE(le.total_entitlement_days, 25) INTO v_total_entitlement
  FROM public.leave_entitlements le
  JOIN public.business_info bi ON le.team_id = bi.team_id
  WHERE bi.user_id = p_user_id AND le.year = p_year
  LIMIT 1;

  -- Get used leave days
  SELECT COALESCE(SUM(tl.duration_days), 0) INTO v_used_leave_days
  FROM public.team_leaves tl
  WHERE tl.user_id = p_user_id 
  AND EXTRACT(YEAR FROM tl.start_date) = p_year
  AND tl.status IN ('approved', 'pending');

  -- Get bank holidays count
  SELECT COALESCE(COUNT(*), 0) INTO v_bank_holidays
  FROM public.bank_holidays
  WHERE year = p_year AND is_active = true;

  -- Calculate remaining days
  v_remaining_days := v_total_entitlement - v_used_leave_days;

  -- Return the result
  RETURN QUERY SELECT 
    v_total_entitlement,
    v_used_leave_days,
    v_bank_holidays,
    v_remaining_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 