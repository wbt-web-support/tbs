-- Add payments column to servicem8_data table
-- This allows us to track revenue and payment status for the Rollup Dashboard

ALTER TABLE servicem8_data 
ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- Comment on the column for documentation
COMMENT ON COLUMN servicem8_data.payments IS 'List of job payments synced from ServiceM8 (/jobpayment.json)';
