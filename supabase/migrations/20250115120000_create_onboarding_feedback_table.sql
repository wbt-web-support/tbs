-- Create onboarding_feedback table for user feedback on the onboarding process
CREATE TABLE IF NOT EXISTS public.onboarding_feedback (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    feedback_text TEXT NOT NULL,
    rating INTEGER, -- Optional rating from 1-5
    feedback_type TEXT DEFAULT 'general', -- general, positive, negative, suggestion
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT onboarding_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT onboarding_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT feedback_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_user_id ON public.onboarding_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_created_at ON public.onboarding_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_type ON public.onboarding_feedback(feedback_type);

-- Enable RLS
ALTER TABLE public.onboarding_feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own feedback
CREATE POLICY "Users can view their own onboarding feedback" ON public.onboarding_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert their own onboarding feedback" ON public.onboarding_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update their own onboarding feedback" ON public.onboarding_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete their own onboarding feedback" ON public.onboarding_feedback
    FOR DELETE USING (auth.uid() = user_id);

-- Super admins can view all feedback
CREATE POLICY "Super admins can view all onboarding feedback" ON public.onboarding_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM business_info 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_feedback_updated_at
    BEFORE UPDATE ON public.onboarding_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.onboarding_feedback IS 'Stores user feedback about the onboarding process on the thank-you page';
