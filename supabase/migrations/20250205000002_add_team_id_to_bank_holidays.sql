-- Add team_id column to bank_holidays table to make holidays team-specific
ALTER TABLE public.bank_holidays 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_bank_holidays_team_id ON public.bank_holidays(team_id);

-- Update existing bank holidays to have a team_id (set to NULL for now, admins will need to reassign)
-- Note: This is a one-time migration. Existing holidays will need to be manually assigned to teams
-- or deleted and recreated by team admins.

-- Update RLS policies to be team-specific
DROP POLICY IF EXISTS "Authenticated users can view bank holidays" ON public.bank_holidays;
DROP POLICY IF EXISTS "Team admins can insert bank holidays" ON public.bank_holidays;
DROP POLICY IF EXISTS "Team admins can update bank holidays" ON public.bank_holidays;
DROP POLICY IF EXISTS "Team admins can delete bank holidays" ON public.bank_holidays;

-- Team members can view their team's bank holidays
CREATE POLICY "Team members can view their team bank holidays" ON public.bank_holidays
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.team_id = bank_holidays.team_id
    )
  );

-- Team admins can insert bank holidays for their team
CREATE POLICY "Team admins can insert bank holidays" ON public.bank_holidays
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.team_id = bank_holidays.team_id
      AND bi.role = 'admin'
    )
  );

-- Team admins can update their team's bank holidays
CREATE POLICY "Team admins can update bank holidays" ON public.bank_holidays
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.team_id = bank_holidays.team_id
      AND bi.role = 'admin'
    )
  );

-- Team admins can delete their team's bank holidays
CREATE POLICY "Team admins can delete bank holidays" ON public.bank_holidays
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.team_id = bank_holidays.team_id
      AND bi.role = 'admin'
    )
  );

