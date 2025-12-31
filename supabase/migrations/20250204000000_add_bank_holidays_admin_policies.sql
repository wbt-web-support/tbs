-- Add RLS policies for bank_holidays to allow admins to manage holidays
-- This allows team admins to insert, update, and delete bank holidays

-- Drop existing read-only policy if it exists (we'll recreate it)
DROP POLICY IF EXISTS "Authenticated users can view bank holidays" ON bank_holidays;

-- Allow all authenticated users to view bank holidays
CREATE POLICY "Authenticated users can view bank holidays" ON bank_holidays
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow team admins to insert bank holidays
CREATE POLICY "Team admins can insert bank holidays" ON bank_holidays
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.role = 'admin'
    )
  );

-- Allow team admins to update bank holidays
CREATE POLICY "Team admins can update bank holidays" ON bank_holidays
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.role = 'admin'
    )
  );

-- Allow team admins to delete bank holidays
CREATE POLICY "Team admins can delete bank holidays" ON bank_holidays
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.business_info bi
      WHERE bi.user_id = auth.uid()
      AND bi.role = 'admin'
    )
  );

