-- Add onboarding fields to machines table
-- These fields track the AI-assisted onboarding flow for growth machines

ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS welcome_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS questions JSONB NULL,
ADD COLUMN IF NOT EXISTS answers JSONB NULL,
ADD COLUMN IF NOT EXISTS questions_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_assisted BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.machines.welcome_completed IS 'Tracks if the welcome screen has been completed';
COMMENT ON COLUMN public.machines.questions IS 'Stores AI-generated questions with structure: {questions: [...], metadata: {...}}';
COMMENT ON COLUMN public.machines.answers IS 'Stores user answers to questions: {question_id: "answer", ...}';
COMMENT ON COLUMN public.machines.questions_completed IS 'Tracks if all questions have been answered';
COMMENT ON COLUMN public.machines.ai_assisted IS 'Tracks if AI was used to create this machine';
