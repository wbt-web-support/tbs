-- Create prompts table for storing editable Gemini prompts
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL UNIQUE, -- e.g. 'company_overview', 'fulfillment_machine'
  description TEXT NOT NULL, -- Human-friendly description of the prompt
  prompt_text TEXT NOT NULL, -- The actual prompt template
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookup by key
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_key ON public.prompts(prompt_key);

-- Add RLS (Row Level Security)
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Only super admins can edit prompts
CREATE POLICY "Super admins can edit prompts" ON public.prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.business_info 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Create trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE
  ON public.prompts FOR EACH ROW EXECUTE PROCEDURE update_prompts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.prompts IS 'Stores editable prompt templates for Gemini-powered features.';
COMMENT ON COLUMN public.prompts.prompt_key IS 'Unique key for each prompt (e.g. company_overview, fulfillment_machine, etc.)';
COMMENT ON COLUMN public.prompts.prompt_text IS 'The actual prompt template, may include placeholders for dynamic data.';
COMMENT ON COLUMN public.prompts.description IS 'Human-friendly description of the prompt purpose.'; 