-- This migration adds completion tracking fields to CHQ timeline tables
-- Run this in the Supabase SQL editor

-- Add completion tracking to the chq_timeline table
ALTER TABLE public.chq_timeline 
ADD COLUMN is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN completion_date TIMESTAMPTZ;

-- Add completed status and user_id to chq_checklist 
ALTER TABLE public.chq_checklist
ADD COLUMN completed BOOLEAN DEFAULT FALSE,
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Add claimed status and user_id to chq_benefits
ALTER TABLE public.chq_benefits
ADD COLUMN claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_timeline_user_id ON public.chq_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_user_id ON public.chq_checklist(user_id);
CREATE INDEX IF NOT EXISTS idx_benefits_user_id ON public.chq_benefits(user_id);

CREATE INDEX IF NOT EXISTS idx_timeline_completed ON public.chq_timeline(is_completed);
CREATE INDEX IF NOT EXISTS idx_checklist_completed ON public.chq_checklist(completed);
CREATE INDEX IF NOT EXISTS idx_benefits_claimed ON public.chq_benefits(claimed); 