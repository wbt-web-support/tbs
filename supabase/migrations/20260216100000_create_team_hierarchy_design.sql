-- Team hierarchy design: one row per team (image + Figma embed/link), same pattern as machine design
CREATE TABLE IF NOT EXISTS public.team_hierarchy_design (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text,
  figma_link text,
  figma_embed text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT team_hierarchy_design_team_id_key UNIQUE (team_id)
);
ai_onboarding_questions
CREATE INDEX IF NOT EXISTS idx_team_hierarchy_design_team_id ON public.team_hierarchy_design(team_id);

COMMENT ON TABLE public.team_hierarchy_design IS 'Stores custom image or Figma design for team org chart / hierarchy (one per team).';

ALTER TABLE public.team_hierarchy_design ENABLE ROW LEVEL SECURITY;

-- Team members can view their team's hierarchy design (own team_id or in business_info for that team)
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

-- Team members can insert (own team_id or in business_info for that team)
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

-- Team members can update their team's design
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
  );

-- Team members can delete their team's design
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

CREATE OR REPLACE FUNCTION update_team_hierarchy_design_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_hierarchy_design_updated_at ON public.team_hierarchy_design;
CREATE TRIGGER update_team_hierarchy_design_updated_at
  BEFORE UPDATE ON public.team_hierarchy_design
  FOR EACH ROW
  EXECUTE FUNCTION update_team_hierarchy_design_updated_at();
