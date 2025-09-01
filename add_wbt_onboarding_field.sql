-- Add wbt_onboarding field to business_info table
-- This field will store extracted text content from PDF files for AI training

ALTER TABLE public.business_info 
ADD COLUMN IF NOT EXISTS wbt_onboarding TEXT DEFAULT '';

-- Add comment to document the field purpose
COMMENT ON COLUMN public.business_info.wbt_onboarding IS 'Extracted text content from WBT onboarding PDF for AI training purposes';

-- Update existing records to have empty string instead of NULL
UPDATE public.business_info 
SET wbt_onboarding = '' 
WHERE wbt_onboarding IS NULL;
