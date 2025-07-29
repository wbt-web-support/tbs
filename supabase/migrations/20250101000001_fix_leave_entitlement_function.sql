-- Fix the calculate_remaining_leave_days function to handle bigint to integer conversion
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