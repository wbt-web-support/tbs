-- Fix RLS: allow insert when team_id = auth.uid() (solo/own team) or when user is in business_info for that team
DROP POLICY IF EXISTS "Team members can insert hierarchy design" ON public.team_hierarchy_design;
CREATE POLICY "Team members can insert hierarchy design" ON public.team_hierarchy_design
  FOR INSERT
  WITH CHECK (
    team_hierarchy_design.team_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.team_id = team_hierarchy_design.team_id
      AND business_info.user_id = auth.uid()
    )
  );

-- Allow SELECT for own team_id as well (solo user)
DROP POLICY IF EXISTS "Team members can view hierarchy design" ON public.team_hierarchy_design;
CREATE POLICY "Team members can view hierarchy design" ON public.team_hierarchy_design
  FOR SELECT
  USING (
    team_hierarchy_design.team_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.team_id = team_hierarchy_design.team_id
      AND business_info.user_id = auth.uid()
    )
  );

-- Allow UPDATE for own team_id as well (WITH CHECK so updated row is allowed)
DROP POLICY IF EXISTS "Team members can update hierarchy design" ON public.team_hierarchy_design;
CREATE POLICY "Team members can update hierarchy design" ON public.team_hierarchy_design
  FOR UPDATE
  USING (
    team_hierarchy_design.team_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.team_id = team_hierarchy_design.team_id
      AND business_info.user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_hierarchy_design.team_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.team_id = team_hierarchy_design.team_id
      AND business_info.user_id = auth.uid()
    )
  );

-- Allow DELETE for own team_id as well
DROP POLICY IF EXISTS "Team members can delete hierarchy design" ON public.team_hierarchy_design;
CREATE POLICY "Team members can delete hierarchy design" ON public.team_hierarchy_design
  FOR DELETE
  USING (
    team_hierarchy_design.team_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.team_id = team_hierarchy_design.team_id
      AND business_info.user_id = auth.uid()
    )
  );
