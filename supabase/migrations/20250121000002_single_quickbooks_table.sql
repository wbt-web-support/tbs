-- Single QuickBooks data table with JSON storage
-- Replaces the previous 4-table approach with a simpler single-table design

-- Drop existing tables if they exist
DROP TABLE IF EXISTS qb_kpi_snapshots;
DROP TABLE IF EXISTS qb_estimates;
DROP TABLE IF EXISTS qb_cost_data;
DROP TABLE IF EXISTS qb_revenue_data;
DROP TABLE IF EXISTS quickbooks_connections;

-- Single table for all QuickBooks data
CREATE TABLE quickbooks_data (
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
    
    -- All QuickBooks data in JSON format
    -- Structure: { "revenue_data": [...], "cost_data": [...], "estimates": [...] }
    qb_data jsonb DEFAULT '{}',
    
    -- Pre-calculated KPIs for fast dashboard access
    -- Structure: { "monthly": { "revenue": {...}, "gross_profit": {...} }, "quarterly": {...} }
    current_kpis jsonb DEFAULT '{}',
    
    -- Metadata
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, company_id)
);

-- Indexes for optimal performance
CREATE INDEX idx_quickbooks_data_user_id ON quickbooks_data(user_id);
CREATE INDEX idx_quickbooks_data_status ON quickbooks_data(status);
CREATE INDEX idx_quickbooks_data_company ON quickbooks_data(company_id);

-- GIN indexes for efficient JSON queries
CREATE INDEX idx_quickbooks_qb_data ON quickbooks_data USING GIN (qb_data);
CREATE INDEX idx_quickbooks_kpis ON quickbooks_data USING GIN (current_kpis);

-- Specific JSON path indexes for common KPI queries
CREATE INDEX idx_quickbooks_revenue_data ON quickbooks_data USING GIN ((qb_data->'revenue_data'));
CREATE INDEX idx_quickbooks_cost_data ON quickbooks_data USING GIN ((qb_data->'cost_data'));
CREATE INDEX idx_quickbooks_estimates ON quickbooks_data USING GIN ((qb_data->'estimates'));

-- Enable Row Level Security
ALTER TABLE quickbooks_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can only access their own data
CREATE POLICY "Users can only access their own QuickBooks data" ON quickbooks_data
    FOR ALL USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_quickbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function on updates
CREATE TRIGGER update_quickbooks_data_updated_at 
    BEFORE UPDATE ON quickbooks_data
    FOR EACH ROW 
    EXECUTE FUNCTION update_quickbooks_updated_at();

-- Helper function to get current KPIs for a user
CREATE OR REPLACE FUNCTION get_user_kpis(target_user_id uuid, period_type text DEFAULT 'monthly')
RETURNS jsonb AS $$
BEGIN
    RETURN (
        SELECT current_kpis->period_type
        FROM quickbooks_data 
        WHERE user_id = target_user_id 
        AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to update KPIs for a user
CREATE OR REPLACE FUNCTION update_user_kpis(
    target_user_id uuid, 
    period_type text, 
    kpi_data jsonb
)
RETURNS boolean AS $$
BEGIN
    UPDATE quickbooks_data 
    SET current_kpis = jsonb_set(
        COALESCE(current_kpis, '{}'), 
        ARRAY[period_type], 
        kpi_data
    )
    WHERE user_id = target_user_id 
    AND status = 'active';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get QB data for a user
CREATE OR REPLACE FUNCTION get_user_qb_data(target_user_id uuid, data_type text DEFAULT NULL)
RETURNS jsonb AS $$
BEGIN
    IF data_type IS NULL THEN
        RETURN (
            SELECT qb_data
            FROM quickbooks_data 
            WHERE user_id = target_user_id 
            AND status = 'active'
            LIMIT 1
        );
    ELSE
        RETURN (
            SELECT qb_data->data_type
            FROM quickbooks_data 
            WHERE user_id = target_user_id 
            AND status = 'active'
            LIMIT 1
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON quickbooks_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_kpis(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_kpis(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_qb_data(uuid, text) TO authenticated;