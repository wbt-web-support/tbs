-- Create Xero integration table
CREATE TABLE xero_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL, -- Xero tenant/organization ID
    organization_name TEXT,
    
    -- OAuth tokens
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Connection status
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')),
    error_message TEXT,
    
    -- Cached data (JSONB for efficient querying)
    invoices JSONB DEFAULT '[]',
    contacts JSONB DEFAULT '[]',
    accounts JSONB DEFAULT '[]',
    bank_transactions JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one connection per user per tenant
    UNIQUE(user_id, tenant_id)
);

-- Create indexes for performance
CREATE INDEX idx_xero_data_user_id ON xero_data(user_id);
CREATE INDEX idx_xero_data_tenant_id ON xero_data(tenant_id);
CREATE INDEX idx_xero_data_sync_status ON xero_data(sync_status);
CREATE INDEX idx_xero_data_last_sync ON xero_data(last_sync_at);

-- Enable Row Level Security
ALTER TABLE xero_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own Xero data" ON xero_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Xero data" ON xero_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Xero data" ON xero_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Xero data" ON xero_data
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_xero_data_updated_at BEFORE UPDATE ON xero_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create KPIs table for Xero
CREATE TABLE xero_kpis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- KPI data
    kpis JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per user, tenant, and period
    UNIQUE(user_id, tenant_id, period, period_start, period_end)
);

-- Create indexes for KPIs table
CREATE INDEX idx_xero_kpis_user_id ON xero_kpis(user_id);
CREATE INDEX idx_xero_kpis_tenant_id ON xero_kpis(tenant_id);
CREATE INDEX idx_xero_kpis_period ON xero_kpis(period);
CREATE INDEX idx_xero_kpis_period_dates ON xero_kpis(period_start, period_end);

-- Enable RLS on KPIs table
ALTER TABLE xero_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for KPIs
CREATE POLICY "Users can view their own Xero KPIs" ON xero_kpis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Xero KPIs" ON xero_kpis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Xero KPIs" ON xero_kpis
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Xero KPIs" ON xero_kpis
    FOR DELETE USING (auth.uid() = user_id);