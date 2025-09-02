-- Safe migration to update ai_onboarding_questions table structure
-- This migration safely transitions from the old structure to the new JSON-based structure

-- First, check if the old table exists and has data
DO $$
BEGIN
    -- Check if old table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_onboarding_questions') THEN
        -- Check if old table has the old structure (multiple columns)
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'ai_onboarding_questions' 
            AND column_name = 'question_text'
        ) THEN
            -- Old structure exists, migrate data to new structure
            RAISE NOTICE 'Migrating existing data from old structure to new JSON structure...';
            
            -- Create temporary table with new structure
            CREATE TABLE IF NOT EXISTS ai_onboarding_questions_new (
                id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
                user_id UUID NOT NULL,
                questions_data JSONB NOT NULL,
                is_completed BOOLEAN NOT NULL DEFAULT false,
                completed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                CONSTRAINT ai_onboarding_questions_new_pkey PRIMARY KEY (id),
                CONSTRAINT ai_onboarding_questions_new_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
                CONSTRAINT unique_user_ai_onboarding_new UNIQUE (user_id)
            );
            
            -- Migrate existing data to new structure
            INSERT INTO ai_onboarding_questions_new (user_id, questions_data, is_completed, completed_at, created_at, updated_at)
            SELECT 
                user_id,
                jsonb_build_object(
                    'questions', 
                    COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'id', id,
                                'question_text', question_text,
                                'question_category', COALESCE(question_category, 'General'),
                                'question_type', COALESCE(question_type, 'text'),
                                'options', options,
                                'is_required', COALESCE(is_required, false),
                                'question_order', COALESCE(question_order, 1),
                                'user_answer', user_answer,
                                'is_completed', COALESCE(is_completed, false)
                            ) ORDER BY question_order, id
                        ),
                        '[]'::jsonb
                    ),
                    'metadata', jsonb_build_object(
                        'total_questions', COUNT(*),
                        'completed_count', COUNT(*) FILTER (WHERE is_completed = true),
                        'generated_at', MIN(created_at)
                    )
                ) as questions_data,
                bool_and(COUNT(*) FILTER (WHERE is_completed = false) = 0) as is_completed,
                CASE 
                    WHEN bool_and(COUNT(*) FILTER (WHERE is_completed = false) = 0) THEN MAX(updated_at)
                    ELSE NULL
                END as completed_at,
                MIN(created_at) as created_at,
                MAX(updated_at) as updated_at
            FROM ai_onboarding_questions
            GROUP BY user_id;
            
            -- Drop old table and rename new one
            DROP TABLE ai_onboarding_questions;
            ALTER TABLE ai_onboarding_questions_new RENAME TO ai_onboarding_questions;
            
            RAISE NOTICE 'Migration completed successfully!';
            
        ELSE
            -- New structure already exists, just ensure it has the right structure
            RAISE NOTICE 'Table already has new structure, ensuring proper setup...';
        END IF;
    ELSE
        -- Table doesn't exist, create it with new structure
        RAISE NOTICE 'Creating new ai_onboarding_questions table...';
    END IF;
END $$;

-- Ensure the table exists with the correct structure
CREATE TABLE IF NOT EXISTS public.ai_onboarding_questions (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    questions_data JSONB NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ai_onboarding_questions_pkey PRIMARY KEY (id),
    CONSTRAINT ai_onboarding_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_ai_onboarding UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_user_id ON public.ai_onboarding_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_completed ON public.ai_onboarding_questions(is_completed);

-- Enable RLS
ALTER TABLE public.ai_onboarding_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI onboarding questions" ON public.ai_onboarding_questions;
DROP POLICY IF EXISTS "Users can insert their own AI onboarding questions" ON public.ai_onboarding_questions;
DROP POLICY IF EXISTS "Users can update their own AI onboarding questions" ON public.ai_onboarding_questions;

-- Create RLS policies
CREATE POLICY "Users can view their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_ai_onboarding_questions_updated_at ON public.ai_onboarding_questions;
CREATE TRIGGER update_ai_onboarding_questions_updated_at
    BEFORE UPDATE ON public.ai_onboarding_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.ai_onboarding_questions IS 'Stores AI-generated post-onboarding questions and user answers in JSON format';
