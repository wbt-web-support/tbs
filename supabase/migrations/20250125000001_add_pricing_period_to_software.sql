-- Add pricing_period column to software table
-- Supports: monthly, yearly, custom, n/a

ALTER TABLE public.software
ADD COLUMN IF NOT EXISTS pricing_period text DEFAULT 'monthly' CHECK (pricing_period IN ('monthly', 'yearly', 'custom', 'n/a'));

COMMENT ON COLUMN public.software.pricing_period IS 'Pricing period: monthly, yearly, custom (pay as you go), or n/a (no pricing)';

-- Update existing records to have default pricing_period
UPDATE public.software
SET pricing_period = 'monthly'
WHERE pricing_period IS NULL AND price_monthly IS NOT NULL;

UPDATE public.software
SET pricing_period = 'n/a'
WHERE pricing_period IS NULL AND price_monthly IS NULL;

