-- Migration: Update course progress to use team_id instead of user_id
-- Date: 2025-01-24

-- Step 1: Add team_id column to user_course_progress
ALTER TABLE public.user_course_progress 
ADD COLUMN team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add team_id column to user_module_progress 
ALTER TABLE public.user_module_progress 
ADD COLUMN team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Populate team_id from business_info table
UPDATE public.user_course_progress 
SET team_id = (
  SELECT COALESCE(bi.team_id, ucp.user_id) 
  FROM public.business_info bi 
  WHERE bi.user_id = user_course_progress.user_id
);

UPDATE public.user_module_progress 
SET team_id = (
  SELECT COALESCE(bi.team_id, ump.user_id) 
  FROM public.business_info bi 
  WHERE bi.user_id = user_module_progress.user_id
);

-- Step 4: Set team_id as NOT NULL (after populating data)
ALTER TABLE public.user_course_progress 
ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE public.user_module_progress 
ALTER COLUMN team_id SET NOT NULL;

-- Step 5: Update unique constraints to use team_id instead of user_id
ALTER TABLE public.user_course_progress 
DROP CONSTRAINT IF EXISTS user_course_progress_user_id_lesson_id_key;

ALTER TABLE public.user_course_progress 
ADD CONSTRAINT user_course_progress_team_id_lesson_id_key 
UNIQUE (team_id, lesson_id);

-- Step 6: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_progress_team_id 
ON public.user_course_progress USING btree (team_id);

CREATE INDEX IF NOT EXISTS idx_module_progress_team_id 
ON public.user_module_progress USING btree (team_id);

-- Step 7: Update the trigger function to use team_id
CREATE OR REPLACE FUNCTION update_module_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert module progress based on team_id
  INSERT INTO user_module_progress (
    user_id, -- Keep for backward compatibility
    team_id,
    module_id,
    is_completed,
    progress_percentage,
    completed_at,
    updated_at
  )
  SELECT 
    NEW.user_id,
    NEW.team_id,
    cl.module_id,
    (COUNT(CASE WHEN ucp.is_completed THEN 1 END) = COUNT(*)) as is_completed,
    ROUND((COUNT(CASE WHEN ucp.is_completed THEN 1 END) * 100.0) / COUNT(*), 2) as progress_percentage,
    CASE 
      WHEN COUNT(CASE WHEN ucp.is_completed THEN 1 END) = COUNT(*) 
      THEN NOW() 
      ELSE NULL 
    END as completed_at,
    NOW() as updated_at
  FROM course_lessons cl
  LEFT JOIN user_course_progress ucp ON cl.id = ucp.lesson_id AND ucp.team_id = NEW.team_id
  WHERE cl.module_id = (SELECT module_id FROM course_lessons WHERE id = NEW.lesson_id)
  GROUP BY cl.module_id
  ON CONFLICT (user_id, module_id) 
  DO UPDATE SET
    team_id = EXCLUDED.team_id,
    is_completed = EXCLUDED.is_completed,
    progress_percentage = EXCLUDED.progress_percentage,
    completed_at = EXCLUDED.completed_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create helper function to get team_id for a user
CREATE OR REPLACE FUNCTION get_user_team_id(input_user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT COALESCE(team_id, input_user_id)
    FROM business_info 
    WHERE user_id = input_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_team_id(uuid) TO authenticated;

-- Step 10: Add RLS policies for team-based access
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_course_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_course_progress;
DROP POLICY IF EXISTS "Users can view their own module progress" ON public.user_module_progress;
DROP POLICY IF EXISTS "Users can update their own module progress" ON public.user_module_progress;

-- Create new team-based policies for user_course_progress
CREATE POLICY "Team members can view team progress" ON public.user_course_progress
  FOR SELECT USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update team progress" ON public.user_course_progress
  FOR ALL USING (team_id = get_user_team_id(auth.uid()));

-- Create new team-based policies for user_module_progress  
CREATE POLICY "Team members can view team module progress" ON public.user_module_progress
  FOR SELECT USING (user_id = get_user_team_id(auth.uid()) OR team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update team module progress" ON public.user_module_progress
  FOR ALL USING (user_id = get_user_team_id(auth.uid()) OR team_id = get_user_team_id(auth.uid()));

-- Step 11: Create view for easy team progress access
CREATE OR REPLACE VIEW team_course_progress AS
SELECT 
  tcp.*,
  cl.title as lesson_title,
  cl.video_duration_seconds,
  cm.title as module_title,
  c.title as course_title
FROM user_course_progress tcp
JOIN course_lessons cl ON tcp.lesson_id = cl.id
JOIN course_modules cm ON cl.module_id = cm.id  
JOIN courses c ON cm.course_id = c.id
WHERE tcp.team_id = get_user_team_id(auth.uid());

-- Grant access to the view
GRANT SELECT ON team_course_progress TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.user_course_progress IS 'Course progress tracking - now uses team_id for shared team progress';
COMMENT ON TABLE public.user_module_progress IS 'Module progress tracking - now uses team_id for shared team progress';
COMMENT ON FUNCTION get_user_team_id(uuid) IS 'Helper function to get team_id for a user, falls back to user_id if no team'; 