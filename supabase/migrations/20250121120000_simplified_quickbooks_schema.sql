-- Drop existing QuickBooks tables if they exist
DROP TABLE IF EXISTS qb_kpi_snapshots CASCADE;
DROP TABLE IF EXISTS qb_estimates CASCADE;
DROP TABLE IF EXISTS qb_cost_data CASCADE;
DROP TABLE IF EXISTS qb_revenue_data CASCADE;
DROP VIEW IF EXISTS qb_current_kpis CASCADE;

-- Create simplified QuickBooks data table with JSON storage
CREATE TABLE IF NOT EXISTS quickbooks_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Connection info
    company_id text NOT NULL,
    company_name text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    connected_at timestamp with time zone DEFAULT now(),
    last_sync timestamp with time zone,
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    
    -- All QuickBooks data in JSON
    qb_data jsonb DEFAULT '{}',
    
    -- Pre-calculated KPIs for fast access
    current_kpis jsonb DEFAULT '{}',
    
    -- Metadata
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, company_id)
);

-- Migrate existing connection data if quickbooks_connections table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quickbooks_connections') THEN
        INSERT INTO quickbooks_data (
            user_id, company_id, company_name, access_token, refresh_token,
            expires_at, connected_at, last_sync, status, created_at, updated_at
        )
        SELECT 
            user_id, company_id, company_name, access_token, refresh_token,
            expires_at, connected_at, last_sync, status, created_at, updated_at
        FROM quickbooks_connections
        ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;
END $$;

-- Drop old quickbooks_connections table
DROP TABLE IF EXISTS quickbooks_connections CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quickbooks_data_user_id ON quickbooks_data(user_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_data_status ON quickbooks_data(status);
CREATE INDEX IF NOT EXISTS idx_quickbooks_data_company ON quickbooks_data(user_id, company_id);

-- GIN indexes for JSON queries
CREATE INDEX IF NOT EXISTS idx_quickbooks_qb_data ON quickbooks_data USING GIN (qb_data);
CREATE INDEX IF NOT EXISTS idx_quickbooks_kpis ON quickbooks_data USING GIN (current_kpis);

-- Specific JSON path indexes for common KPI queries
CREATE INDEX IF NOT EXISTS idx_quickbooks_revenue_data 
    ON quickbooks_data USING GIN ((qb_data->'revenue_data'));
CREATE INDEX IF NOT EXISTS idx_quickbooks_cost_data 
    ON quickbooks_data USING GIN ((qb_data->'cost_data'));
CREATE INDEX IF NOT EXISTS idx_quickbooks_estimates 
    ON quickbooks_data USING GIN ((qb_data->'estimates'));

-- Enable Row Level Security
ALTER TABLE quickbooks_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own QuickBooks data" ON quickbooks_data
    FOR ALL USING (auth.uid() = user_id);

-- Update trigger function
CREATE OR REPLACE FUNCTION update_quickbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_quickbooks_data_updated_at 
    BEFORE UPDATE ON quickbooks_data
    FOR EACH ROW EXECUTE FUNCTION update_quickbooks_updated_at();

-- Helper function to get current KPIs for a user
CREATE OR REPLACE FUNCTION get_user_current_kpis(p_user_id uuid, p_period text DEFAULT 'monthly')
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT current_kpis->p_period INTO result
    FROM quickbooks_data
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to update KPIs
CREATE OR REPLACE FUNCTION update_user_kpis(
    p_user_id uuid, 
    p_period text, 
    p_kpis jsonb
)
RETURNS boolean AS $$
BEGIN
    UPDATE quickbooks_data 
    SET current_kpis = jsonb_set(
        COALESCE(current_kpis, '{}'::jsonb),
        ARRAY[p_period],
        p_kpis,
        true
    )
    WHERE user_id = p_user_id AND status = 'active';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_user_current_kpis(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_kpis(uuid, text, jsonb) TO authenticated;