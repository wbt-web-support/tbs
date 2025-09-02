-- Create ai_onboarding_questions table
CREATE TABLE IF NOT EXISTS public.ai_onboarding_questions (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(100) NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, textarea, select, multi-select
    options JSONB, -- For select/multi-select questions
    user_answer TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    question_order INTEGER NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ai_onboarding_questions_pkey PRIMARY KEY (id),
    CONSTRAINT ai_onboarding_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_question_order UNIQUE (user_id, question_order)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_user_id ON public.ai_onboarding_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_onboarding_questions_completed ON public.ai_onboarding_questions(user_id, is_completed);

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
COMMENT ON TABLE public.ai_onboarding_questions IS 'Stores AI-generated post-onboarding questions and user answers';
