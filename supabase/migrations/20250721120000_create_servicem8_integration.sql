-- Create ServiceM8 integration table
-- Follows exact pattern of quickbooks_data table

CREATE TABLE IF NOT EXISTS servicem8_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    api_key TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending',
    jobs JSONB DEFAULT '[]'::jsonb,
    staff JSONB DEFAULT '[]'::jsonb,
    companies JSONB DEFAULT '[]'::jsonb,
    job_activities JSONB DEFAULT '[]'::jsonb,
    job_materials JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_servicem8_data_user_id ON servicem8_data(user_id);
CREATE INDEX IF NOT EXISTS idx_servicem8_data_last_sync_at ON servicem8_data(last_sync_at);
CREATE INDEX IF NOT EXISTS idx_servicem8_data_sync_status ON servicem8_data(sync_status);
CREATE INDEX IF NOT EXISTS idx_servicem8_data_api_key ON servicem8_data(user_id, api_key) WHERE api_key IS NOT NULL;

-- Enable RLS
ALTER TABLE servicem8_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only view their own ServiceM8 data" ON servicem8_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own ServiceM8 data" ON servicem8_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own ServiceM8 data" ON servicem8_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own ServiceM8 data" ON servicem8_data
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_servicem8_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_servicem8_data_updated_at
    BEFORE UPDATE ON servicem8_data
    FOR EACH ROW
    EXECUTE FUNCTION update_servicem8_data_updated_at();