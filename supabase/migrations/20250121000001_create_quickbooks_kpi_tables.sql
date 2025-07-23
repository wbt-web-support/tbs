-- KPI-Focused QuickBooks Integration Schema
-- Only the essential tables needed to calculate business KPIs

-- QuickBooks connections table (unchanged - needed for OAuth)
CREATE TABLE IF NOT EXISTS quickbooks_connections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id text NOT NULL,
    company_name text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    connected_at timestamp with time zone DEFAULT now(),
    last_sync timestamp with time zone,
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, company_id)
);

-- Revenue data from invoices and sales receipts
CREATE TABLE IF NOT EXISTS qb_revenue_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('invoice', 'sales_receipt', 'payment')),
    customer_id text,
    customer_name text,
    project_ref text, -- For job tracking
    amount numeric(15,2) NOT NULL DEFAULT 0,
    transaction_date date NOT NULL,
    due_date date,
    status text, -- Paid, Pending, Overdue, etc.
    payment_date date,
    job_name text, -- For job completion tracking
    description text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id, transaction_type)
);

-- Cost data from bills and expenses for profit calculations
CREATE TABLE IF NOT EXISTS qb_cost_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('bill', 'expense', 'purchase')),
    vendor_id text,
    vendor_name text,
    project_ref text, -- Link to revenue data for profit calculation
    amount numeric(15,2) NOT NULL DEFAULT 0,
    transaction_date date NOT NULL,
    due_date date,
    category text, -- Materials, Labor, Overhead
    cost_type text CHECK (cost_type IN ('materials', 'labor', 'overhead', 'other')),
    job_name text, -- For job cost tracking
    description text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id, transaction_type)
);

-- Estimates for quote-to-job conversion tracking
CREATE TABLE IF NOT EXISTS qb_estimates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    customer_id text,
    customer_name text,
    estimate_number text,
    amount numeric(15,2) NOT NULL DEFAULT 0,
    estimate_date date NOT NULL,
    expiry_date date,
    status text, -- Pending, Accepted, Rejected, Expired
    converted_to_invoice boolean DEFAULT false,
    converted_invoice_id text, -- QB ID of resulting invoice
    conversion_date date,
    job_name text,
    description text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- Pre-calculated KPI snapshots for fast dashboard loading
CREATE TABLE IF NOT EXISTS qb_kpi_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kpi_type text NOT NULL CHECK (kpi_type IN (
        'revenue', 
        'gross_profit', 
        'job_completion_rate', 
        'quote_conversion_rate', 
        'average_job_value',
        'customer_satisfaction'
    )),
    period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    current_value numeric(15,4) NOT NULL DEFAULT 0,
    previous_value numeric(15,4) DEFAULT 0, -- For period comparison
    change_percentage numeric(8,4) DEFAULT 0,
    data_points integer DEFAULT 0, -- Number of transactions used in calculation
    metadata jsonb, -- Additional context like breakdown by job type, etc.
    calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, kpi_type, period_type, period_start, period_end)
);

-- Create indexes for optimal KPI query performance
CREATE INDEX IF NOT EXISTS idx_qb_connections_user_id ON quickbooks_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_connections_status ON quickbooks_connections(status);

CREATE INDEX IF NOT EXISTS idx_qb_revenue_user_date ON qb_revenue_data(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_qb_revenue_project ON qb_revenue_data(user_id, project_ref);
CREATE INDEX IF NOT EXISTS idx_qb_revenue_customer ON qb_revenue_data(user_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_qb_revenue_status ON qb_revenue_data(status);

CREATE INDEX IF NOT EXISTS idx_qb_cost_user_date ON qb_cost_data(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_qb_cost_project ON qb_cost_data(user_id, project_ref);
CREATE INDEX IF NOT EXISTS idx_qb_cost_type ON qb_cost_data(user_id, cost_type);

CREATE INDEX IF NOT EXISTS idx_qb_estimates_user_date ON qb_estimates(user_id, estimate_date DESC);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_conversion ON qb_estimates(user_id, converted_to_invoice, status);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_customer ON qb_estimates(user_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_qb_kpi_user_type_period ON qb_kpi_snapshots(user_id, kpi_type, period_type, period_start DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_revenue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only access their own QB connections" ON quickbooks_connections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own revenue data" ON qb_revenue_data
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own cost data" ON qb_cost_data
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own estimates" ON qb_estimates
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own KPI snapshots" ON qb_kpi_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_qb_connections_updated_at BEFORE UPDATE ON quickbooks_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_revenue_data_updated_at BEFORE UPDATE ON qb_revenue_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_cost_data_updated_at BEFORE UPDATE ON qb_cost_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_estimates_updated_at BEFORE UPDATE ON qb_estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_kpi_snapshots_updated_at BEFORE UPDATE ON qb_kpi_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper view for quick KPI dashboard queries
CREATE OR REPLACE VIEW qb_current_kpis AS
SELECT 
    user_id,
    kpi_type,
    period_type,
    current_value,
    previous_value,
    change_percentage,
    data_points,
    calculated_at,
    period_start,
    period_end
FROM qb_kpi_snapshots
WHERE calculated_at = (
    SELECT MAX(calculated_at) 
    FROM qb_kpi_snapshots AS qs2 
    WHERE qs2.user_id = qb_kpi_snapshots.user_id 
    AND qs2.kpi_type = qb_kpi_snapshots.kpi_type 
    AND qs2.period_type = qb_kpi_snapshots.period_type
);

-- Grant access to the view
ALTER VIEW qb_current_kpis OWNER TO postgres;
GRANT SELECT ON qb_current_kpis TO authenticated;