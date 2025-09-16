-- Migration: Add last_accessed_lesson_id to user_course_enrollment table
-- Date: 2025-02-04

-- Add last_accessed_lesson_id column to user_course_enrollment table
ALTER TABLE public.user_course_enrollment 
ADD COLUMN IF NOT EXISTS last_accessed_lesson_id uuid REFERENCES public.course_lessons(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_user_course_enrollment_last_accessed_lesson 
ON public.user_course_enrollment USING btree (last_accessed_lesson_id);

-- Add comment
COMMENT ON COLUMN public.user_course_enrollment.last_accessed_lesson_id IS 'Tracks the last lesson accessed by the user for this course';
