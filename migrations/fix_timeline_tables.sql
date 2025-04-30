-- SQL script to add missing columns to the timeline tables
-- Run this script in the Supabase SQL editor

-- Add is_completed column to chq_timeline if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'chq_timeline'
                  AND column_name = 'is_completed') THEN
        ALTER TABLE public.chq_timeline ADD COLUMN is_completed BOOLEAN DEFAULT FALSE;
    END IF;
END
$$;

-- Add completed column to chq_checklist if it doesn't exist  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'chq_checklist'
                  AND column_name = 'completed') THEN
        ALTER TABLE public.chq_checklist ADD COLUMN completed BOOLEAN DEFAULT FALSE;
    END IF;
END
$$;

-- Add claimed column to chq_benefits if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'chq_benefits'
                  AND column_name = 'claimed') THEN
        ALTER TABLE public.chq_benefits ADD COLUMN claimed BOOLEAN DEFAULT FALSE;
    END IF;
END
$$; 