-- Create table for storing daily external API data
-- This table will store JSON data from Google Analytics, Xero, ServiceM8, and QuickBooks
-- Data is stored daily and can be used for historical analysis and reporting

CREATE TABLE IF NOT EXISTS external_api_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- API source identification
    api_source TEXT NOT NULL CHECK (api_source IN ('google_analytics', 'xero', 'servicem8', 'quickbooks')),
    account_identifier TEXT, -- Property ID, Tenant ID, Company ID, etc.
    account_name TEXT, -- Human-readable account name
    
    -- Date information
    data_date DATE NOT NULL, -- The date this data represents
    fetched_at TIMESTAMPTZ DEFAULT NOW(), -- When this data was fetched
    
    -- Raw API data stored as JSONB for efficient querying
    raw_data JSONB NOT NULL DEFAULT '{}',
    
    -- Processed metrics (optional, for quick access to common metrics)
    metrics JSONB DEFAULT '{}',
    
    -- Status and error handling
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per user per API source per date
    UNIQUE(user_id, api_source, account_identifier, data_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_external_api_data_user_id ON external_api_data(user_id);
CREATE INDEX IF NOT EXISTS idx_external_api_data_api_source ON external_api_data(api_source);
CREATE INDEX IF NOT EXISTS idx_external_api_data_data_date ON external_api_data(data_date);
CREATE INDEX IF NOT EXISTS idx_external_api_data_fetched_at ON external_api_data(fetched_at);
CREATE INDEX IF NOT EXISTS idx_external_api_data_status ON external_api_data(status);
CREATE INDEX IF NOT EXISTS idx_external_api_data_user_source_date ON external_api_data(user_id, api_source, data_date);

-- Enable Row Level Security
ALTER TABLE external_api_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own external API data" ON external_api_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external API data" ON external_api_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external API data" ON external_api_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external API data" ON external_api_data
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_external_api_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_external_api_data_updated_at
    BEFORE UPDATE ON external_api_data
    FOR EACH ROW
    EXECUTE FUNCTION update_external_api_data_updated_at();

-- Create a function to clean up old data (optional, for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_external_api_data(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM external_api_data 
    WHERE data_date < CURRENT_DATE - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of latest data per API source
CREATE OR REPLACE VIEW latest_external_api_data AS
SELECT DISTINCT ON (user_id, api_source, account_identifier)
    id,
    user_id,
    api_source,
    account_identifier,
    account_name,
    data_date,
    fetched_at,
    raw_data,
    metrics,
    status,
    error_message,
    created_at,
    updated_at
FROM external_api_data
ORDER BY user_id, api_source, account_identifier, data_date DESC, fetched_at DESC;

-- Grant permissions on the view
GRANT SELECT ON latest_external_api_data TO authenticated;
