-- Create How We Get There Plan table
CREATE TABLE IF NOT EXISTS public.hwgt_plan (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    howWeGetTherePlan JSONB NOT NULL DEFAULT '{
        "customerAcquisition": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""},
        "fulfillmentProduction": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""},
        "productsServices": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""},
        "teamOrganisation": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""},
        "customerAvatars": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""},
        "modelBrand": {"Q0": "", "Q4": "", "Q8": "", "Q12": ""}
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_hwgt_plan_user_id ON public.hwgt_plan (user_id);

-- Create trigger for automatically updating the 'updated_at' column
CREATE TRIGGER update_hwgt_plan_updated_at
BEFORE UPDATE ON public.hwgt_plan
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.hwgt_plan ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
CREATE POLICY "Users can read their own HWGT plan"
    ON public.hwgt_plan
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert their own HWGT plan"
    ON public.hwgt_plan
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update their own HWGT plan"
    ON public.hwgt_plan
    FOR UPDATE
    USING (auth.uid() = user_id); 