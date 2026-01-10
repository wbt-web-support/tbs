-- Update calculate_remaining_leave_days to include bank holidays in remaining calculation
-- Since Total Entitlement is now displayed as (total_entitlement + bank_holidays),
-- the remaining days should be calculated from the combined total
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
  v_team_id uuid;
BEGIN
  -- Get team_id for the user
  SELECT team_id INTO v_team_id
  FROM public.business_info
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Get total entitlement from leave_entitlements table
  IF v_team_id IS NOT NULL THEN
    SELECT COALESCE(le.total_entitlement_days::integer, 25) INTO v_total_entitlement
    FROM public.leave_entitlements le
    WHERE le.team_id = v_team_id
      AND le.year = p_year
    LIMIT 1;
  END IF;

  -- If no entitlement found, use default of 25
  IF v_total_entitlement IS NULL THEN
    v_total_entitlement := 25;
  END IF;

  -- Get used leave days (sum of approved and pending leaves)
  SELECT COALESCE(SUM(tl.duration_days)::integer, 0) INTO v_used_leave_days
  FROM public.team_leaves tl
  WHERE tl.user_id = p_user_id 
    AND EXTRACT(YEAR FROM tl.start_date)::integer = p_year
    AND LOWER(TRIM(tl.status)) IN ('approved', 'pending');

  -- Ensure used_leave_days is not null
  IF v_used_leave_days IS NULL THEN
    v_used_leave_days := 0;
  END IF;

  -- Get bank holidays count for the year and team
  -- Use the team_id we already fetched above to directly query bank_holidays
  IF v_team_id IS NOT NULL THEN
    SELECT COALESCE(COUNT(*)::integer, 0) INTO v_bank_holidays
    FROM public.bank_holidays bh
    WHERE bh.team_id = v_team_id
      AND bh.year = p_year 
      AND bh.is_active = true;
  END IF;

  -- Ensure bank_holidays is not null
  IF v_bank_holidays IS NULL THEN
    v_bank_holidays := 0;
  END IF;

  -- Calculate remaining days from combined total entitlement (total_entitlement + bank_holidays)
  -- This matches the display logic where Total Entitlement = total_entitlement + bank_holidays
  v_remaining_days := (v_total_entitlement + v_bank_holidays) - v_used_leave_days;

  -- Ensure remaining_days is not negative
  IF v_remaining_days < 0 THEN
    v_remaining_days := 0;
  END IF;

  -- Return the result (always returns exactly one row)
  RETURN QUERY SELECT 
    v_total_entitlement,
    v_used_leave_days,
    v_bank_holidays,
    v_remaining_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
