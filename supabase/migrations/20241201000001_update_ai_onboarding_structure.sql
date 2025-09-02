-- Update ai_onboarding_questions table to use single entry with JSON structure
-- First, drop the old table
DROP TABLE IF EXISTS public.ai_onboarding_questions;

-- Create new simplified table structure
CREATE TABLE IF NOT EXISTS public.ai_onboarding_questions (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    questions_data JSONB NOT NULL, -- Stores array of questions with their answers
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ai_onboarding_questions_pkey PRIMARY KEY (id),
    CONSTRAINT ai_onboarding_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_ai_onboarding UNIQUE (user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_user_id ON public.ai_onboarding_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_completed ON public.ai_onboarding_questions(is_completed);

-- Enable RLS
ALTER TABLE public.ai_onboarding_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_onboarding_questions_updated_at
    BEFORE UPDATE ON public.ai_onboarding_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.ai_onboarding_questions IS 'Stores AI-generated post-onboarding questions and user answers in JSON format';

-- Example of the JSON structure that will be stored:
-- {
--   "questions": [
--     {
--       "id": "uuid-1",
--       "question_text": "What is your primary business goal?",
--       "question_category": "Strategic Planning",
--       "question_type": "text",
--       "options": null,
--       "is_required": true,
--       "question_order": 1,
--       "user_answer": "To increase market share by 25%",
--       "is_completed": true
--     }
--   ],
--   "metadata": {
--     "total_questions": 8,
--     "completed_count": 5,
--     "generated_at": "2024-12-01T00:00:00Z"
--   }
-- }
