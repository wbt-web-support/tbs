-- Create business_owner_instructions table
CREATE TABLE IF NOT EXISTS public.business_owner_instructions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'pdf', 'doc', 'link', 'loom')),
    url TEXT,
    extraction_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_owner_instructions_user_id ON public.business_owner_instructions(user_id);
CREATE INDEX IF NOT EXISTS idx_business_owner_instructions_content_type ON public.business_owner_instructions(content_type);
CREATE INDEX IF NOT EXISTS idx_business_owner_instructions_created_at ON public.business_owner_instructions(created_at DESC);

-- Enable RLS
ALTER TABLE public.business_owner_instructions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view their own instructions
DROP POLICY IF EXISTS "Users can view their own instructions" ON public.business_owner_instructions;
CREATE POLICY "Users can view their own instructions" ON public.business_owner_instructions
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Super admins can view all instructions
DROP POLICY IF EXISTS "Super admins can view all instructions" ON public.business_owner_instructions;
CREATE POLICY "Super admins can view all instructions" ON public.business_owner_instructions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.business_info
            WHERE business_info.user_id = auth.uid()
            AND business_info.role = 'super_admin'
        )
    );

-- Policy: Users can insert their own instructions
DROP POLICY IF EXISTS "Users can insert their own instructions" ON public.business_owner_instructions;
CREATE POLICY "Users can insert their own instructions" ON public.business_owner_instructions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own instructions
DROP POLICY IF EXISTS "Users can update their own instructions" ON public.business_owner_instructions;
CREATE POLICY "Users can update their own instructions" ON public.business_owner_instructions
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy: Super admins can update all instructions
DROP POLICY IF EXISTS "Super admins can update all instructions" ON public.business_owner_instructions;
CREATE POLICY "Super admins can update all instructions" ON public.business_owner_instructions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_info
            WHERE business_info.user_id = auth.uid()
            AND business_info.role = 'super_admin'
        )
    );

-- Policy: Users can delete their own instructions
DROP POLICY IF EXISTS "Users can delete their own instructions" ON public.business_owner_instructions;
CREATE POLICY "Users can delete their own instructions" ON public.business_owner_instructions
    FOR DELETE
    USING (user_id = auth.uid());

-- Policy: Super admins can delete all instructions
DROP POLICY IF EXISTS "Super admins can delete all instructions" ON public.business_owner_instructions;
CREATE POLICY "Super admins can delete all instructions" ON public.business_owner_instructions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.business_info
            WHERE business_info.user_id = auth.uid()
            AND business_info.role = 'super_admin'
        )
    );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_business_owner_instructions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_business_owner_instructions_updated_at ON public.business_owner_instructions;
CREATE TRIGGER update_business_owner_instructions_updated_at
    BEFORE UPDATE ON public.business_owner_instructions
    FOR EACH ROW
    EXECUTE FUNCTION update_business_owner_instructions_updated_at();
