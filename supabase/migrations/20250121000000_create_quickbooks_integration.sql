-- Create QuickBooks integration tables

-- QuickBooks connections table to store OAuth tokens and connection info
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

-- QuickBooks accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS qb_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    name text NOT NULL,
    fully_qualified_name text,
    account_type text,
    account_sub_type text,
    classification text,
    current_balance numeric(15,2) DEFAULT 0,
    current_balance_with_sub_accounts numeric(15,2) DEFAULT 0,
    currency_ref text,
    description text,
    active boolean DEFAULT true,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks customers
CREATE TABLE IF NOT EXISTS qb_customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    name text NOT NULL,
    display_name text,
    company_name text,
    given_name text,
    middle_name text,
    family_name text,
    suffix text,
    title text,
    print_on_check_name text,
    primary_phone text,
    alternate_phone text,
    mobile text,
    fax text,
    primary_email_addr text,
    website_addr text,
    billing_address jsonb,
    shipping_address jsonb,
    notes text,
    active boolean DEFAULT true,
    taxable boolean DEFAULT false,
    balance numeric(15,2) DEFAULT 0,
    currency_ref text,
    preferred_delivery_method text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks vendors
CREATE TABLE IF NOT EXISTS qb_vendors (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    name text NOT NULL,
    display_name text,
    company_name text,
    given_name text,
    middle_name text,
    family_name text,
    suffix text,
    title text,
    print_on_check_name text,
    primary_phone text,
    alternate_phone text,
    mobile text,
    fax text,
    primary_email_addr text,
    website_addr text,
    billing_address jsonb,
    shipping_address jsonb,
    notes text,
    active boolean DEFAULT true,
    vendor_1099 boolean DEFAULT false,
    currency_ref text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks items
CREATE TABLE IF NOT EXISTS qb_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    name text NOT NULL,
    fully_qualified_name text,
    description text,
    type text,
    sub_item boolean DEFAULT false,
    parent_ref text,
    level integer DEFAULT 0,
    unit_price numeric(15,2),
    income_account_ref text,
    expense_account_ref text,
    asset_account_ref text,
    sku text,
    active boolean DEFAULT true,
    taxable boolean DEFAULT false,
    sales_tax_included boolean DEFAULT false,
    unit_of_measure text,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks invoices
CREATE TABLE IF NOT EXISTS qb_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    doc_number text,
    customer_ref text,
    customer_name text,
    transaction_date date,
    due_date date,
    total_amount numeric(15,2) DEFAULT 0,
    balance numeric(15,2) DEFAULT 0,
    home_balance numeric(15,2) DEFAULT 0,
    currency_ref text,
    exchange_rate numeric(10,6) DEFAULT 1,
    private_note text,
    customer_memo text,
    email_status text,
    delivery_info jsonb,
    billing_address jsonb,
    shipping_address jsonb,
    line_items jsonb,
    apply_tax_after_discount boolean DEFAULT false,
    print_status text,
    deposit_to_account_ref text,
    allow_ipn_payment boolean DEFAULT false,
    allow_online_payment boolean DEFAULT false,
    allow_online_credit_card_payment boolean DEFAULT false,
    allow_online_ach_payment boolean DEFAULT false,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks bills
CREATE TABLE IF NOT EXISTS qb_bills (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    vendor_ref text,
    vendor_name text,
    transaction_date date,
    due_date date,
    total_amount numeric(15,2) DEFAULT 0,
    balance numeric(15,2) DEFAULT 0,
    home_balance numeric(15,2) DEFAULT 0,
    currency_ref text,
    exchange_rate numeric(10,6) DEFAULT 1,
    private_note text,
    memo text,
    line_items jsonb,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks payments
CREATE TABLE IF NOT EXISTS qb_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    customer_ref text,
    customer_name text,
    deposit_to_account_ref text,
    payment_method_ref text,
    payment_ref_num text,
    transaction_date date,
    total_amount numeric(15,2) DEFAULT 0,
    unapplied_amount numeric(15,2) DEFAULT 0,
    currency_ref text,
    exchange_rate numeric(10,6) DEFAULT 1,
    private_note text,
    line_items jsonb,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- QuickBooks employees
CREATE TABLE IF NOT EXISTS qb_employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qb_id text NOT NULL,
    name text NOT NULL,
    display_name text,
    given_name text,
    middle_name text,
    family_name text,
    suffix text,
    print_on_check_name text,
    primary_phone text,
    mobile text,
    primary_email_addr text,
    employee_number text,
    ssn text,
    primary_addr jsonb,
    billing_rate numeric(10,2),
    birth_date date,
    gender text,
    hire_date date,
    release_date date,
    active boolean DEFAULT true,
    sync_token text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    qb_created_at timestamp with time zone,
    qb_updated_at timestamp with time zone,
    UNIQUE(user_id, qb_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qb_connections_user_id ON quickbooks_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_connections_company_id ON quickbooks_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_qb_connections_status ON quickbooks_connections(status);

CREATE INDEX IF NOT EXISTS idx_qb_accounts_user_id ON qb_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_qb_id ON qb_accounts(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_name ON qb_accounts(name);

CREATE INDEX IF NOT EXISTS idx_qb_customers_user_id ON qb_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_customers_qb_id ON qb_customers(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_customers_name ON qb_customers(name);

CREATE INDEX IF NOT EXISTS idx_qb_vendors_user_id ON qb_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_vendors_qb_id ON qb_vendors(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_vendors_name ON qb_vendors(name);

CREATE INDEX IF NOT EXISTS idx_qb_items_user_id ON qb_items(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_items_qb_id ON qb_items(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_items_name ON qb_items(name);

CREATE INDEX IF NOT EXISTS idx_qb_invoices_user_id ON qb_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_invoices_qb_id ON qb_invoices(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_invoices_customer_ref ON qb_invoices(customer_ref);
CREATE INDEX IF NOT EXISTS idx_qb_invoices_transaction_date ON qb_invoices(transaction_date);

CREATE INDEX IF NOT EXISTS idx_qb_bills_user_id ON qb_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_bills_qb_id ON qb_bills(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_bills_vendor_ref ON qb_bills(vendor_ref);
CREATE INDEX IF NOT EXISTS idx_qb_bills_transaction_date ON qb_bills(transaction_date);

CREATE INDEX IF NOT EXISTS idx_qb_payments_user_id ON qb_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_payments_qb_id ON qb_payments(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_payments_customer_ref ON qb_payments(customer_ref);
CREATE INDEX IF NOT EXISTS idx_qb_payments_transaction_date ON qb_payments(transaction_date);

CREATE INDEX IF NOT EXISTS idx_qb_employees_user_id ON qb_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_qb_employees_qb_id ON qb_employees(qb_id);
CREATE INDEX IF NOT EXISTS idx_qb_employees_name ON qb_employees(name);

-- Enable Row Level Security (RLS)
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_employees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only access their own data
CREATE POLICY "Users can only access their own QB connections" ON quickbooks_connections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB accounts" ON qb_accounts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB customers" ON qb_customers
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB vendors" ON qb_vendors
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB items" ON qb_items
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB invoices" ON qb_invoices
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB bills" ON qb_bills
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB payments" ON qb_payments
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own QB employees" ON qb_employees
    FOR ALL USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_qb_connections_updated_at BEFORE UPDATE ON quickbooks_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_accounts_updated_at BEFORE UPDATE ON qb_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_customers_updated_at BEFORE UPDATE ON qb_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_vendors_updated_at BEFORE UPDATE ON qb_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_items_updated_at BEFORE UPDATE ON qb_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_invoices_updated_at BEFORE UPDATE ON qb_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_bills_updated_at BEFORE UPDATE ON qb_bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_payments_updated_at BEFORE UPDATE ON qb_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qb_employees_updated_at BEFORE UPDATE ON qb_employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();