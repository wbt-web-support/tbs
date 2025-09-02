-- Complete the AI onboarding table setup with RLS policies
-- This migration adds the missing security components

-- Enable Row Level Security
ALTER TABLE public.ai_onboarding_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secure user access
CREATE POLICY "Users can view their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI onboarding questions" ON public.ai_onboarding_questions
    FOR UPDATE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.ai_onboarding_questions IS 'Stores AI-generated post-onboarding questions and user answers in JSON format';

-- Verify the setup
DO $$
BEGIN
    RAISE NOTICE 'AI onboarding table setup completed successfully!';
    RAISE NOTICE 'Table: %', (SELECT table_name FROM information_schema.tables WHERE table_name = 'ai_onboarding_questions');
    RAISE NOTICE 'RLS enabled: %', (SELECT row_security FROM information_schema.tables WHERE table_name = 'ai_onboarding_questions');
    RAISE NOTICE 'Policies created: %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'ai_onboarding_questions');
END $$;
