-- =====================================================
-- ServiceM8 Complete Database Schema - CLEAN VERSION
-- Drop all existing tables and recreate from scratch
-- ⚠️ WARNING: This will DELETE all existing data!
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING TABLES
-- =====================================================

DROP TABLE IF EXISTS public.servicem8_job_payments CASCADE;
DROP TABLE IF EXISTS public.servicem8_job_activities CASCADE;
DROP TABLE IF EXISTS public.servicem8_job_contacts CASCADE;
DROP TABLE IF EXISTS public.servicem8_contacts CASCADE;
DROP TABLE IF EXISTS public.servicem8_jobs CASCADE;
DROP TABLE IF EXISTS public.servicem8_categories CASCADE;
DROP TABLE IF EXISTS public.servicem8_staff CASCADE;
DROP TABLE IF EXISTS public.servicem8_companies CASCADE;

-- Drop the view if exists
DROP VIEW IF EXISTS public.servicem8_dashboard_view CASCADE;

-- =====================================================
-- STEP 2: CREATE ALL TABLES
-- =====================================================

-- 1. COMPANIES TABLE (Clients) - Main table
CREATE TABLE public.servicem8_companies (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    billing_address TEXT,
    email TEXT,
    phone TEXT,
    abn_number TEXT,
    is_individual TEXT,
    website TEXT,
    fax_number TEXT,
    badges TEXT,
    payment_terms TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CATEGORIES TABLE (Job Categories)
CREATE TABLE public.servicem8_categories (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. STAFF TABLE (Employees)
CREATE TABLE public.servicem8_staff (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    mobile TEXT,
    job_title TEXT,
    color TEXT,
    status_message TEXT,
    hide_from_schedule TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. JOBS TABLE (Main Jobs/Work Orders)
CREATE TABLE public.servicem8_jobs (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_number TEXT,
    generated_job_id TEXT,
    status TEXT,
    date TIMESTAMP WITH TIME ZONE,
    completion_date TIMESTAMP WITH TIME ZONE,
    total_invoice_amount DECIMAL(12,2) DEFAULT 0,
    payment_amount DECIMAL(12,2),
    payment_method TEXT,
    payment_received TEXT,
    payment_processed TEXT,
    payment_received_stamp TIMESTAMP WITH TIME ZONE,
    payment_processed_stamp TIMESTAMP WITH TIME ZONE,
    invoice_sent TEXT,
    invoice_sent_stamp TIMESTAMP WITH TIME ZONE,
    ready_to_invoice TEXT,
    ready_to_invoice_stamp TIMESTAMP WITH TIME ZONE,
    quote_date TIMESTAMP WITH TIME ZONE,
    quote_sent TEXT,
    quote_sent_stamp TIMESTAMP WITH TIME ZONE,
    work_order_date TIMESTAMP WITH TIME ZONE,
    company_uuid UUID,
    category_uuid UUID,
    created_by_staff_uuid UUID,
    job_address TEXT,
    billing_address TEXT,
    job_description TEXT,
    work_done_description TEXT,
    purchase_order_number TEXT,
    badges TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. COMPANY CONTACTS TABLE (Contact Persons)
CREATE TABLE public.servicem8_contacts (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_uuid UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    type TEXT,
    is_primary_contact TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. JOB CONTACTS TABLE (Job-specific Contacts)
CREATE TABLE public.servicem8_job_contacts (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    type TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. JOB ACTIVITIES TABLE (Staff Time Tracking)
CREATE TABLE public.servicem8_job_activities (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    staff_uuid UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    travel_time_in_seconds INTEGER DEFAULT 0,
    travel_distance_in_meters INTEGER,
    activity_was_scheduled TEXT,
    activity_was_recorded TEXT,
    activity_was_automated TEXT,
    has_been_opened TEXT,
    has_been_opened_timestamp TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. JOB PAYMENTS TABLE (Payment Tracking)
CREATE TABLE public.servicem8_job_payments (
    uuid UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    amount DECIMAL(12,2) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE,
    method TEXT,
    note TEXT,
    actioned_by_uuid UUID,
    is_deposit TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 3: ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Jobs table foreign keys
ALTER TABLE public.servicem8_jobs 
    ADD CONSTRAINT fk_job_company 
    FOREIGN KEY (company_uuid) 
    REFERENCES public.servicem8_companies(uuid) 
    ON DELETE SET NULL;

ALTER TABLE public.servicem8_jobs 
    ADD CONSTRAINT fk_job_category 
    FOREIGN KEY (category_uuid) 
    REFERENCES public.servicem8_categories(uuid) 
    ON DELETE SET NULL;

ALTER TABLE public.servicem8_jobs 
    ADD CONSTRAINT fk_job_staff 
    FOREIGN KEY (created_by_staff_uuid) 
    REFERENCES public.servicem8_staff(uuid) 
    ON DELETE SET NULL;

-- Contacts table foreign keys
ALTER TABLE public.servicem8_contacts 
    ADD CONSTRAINT fk_contact_company 
    FOREIGN KEY (company_uuid) 
    REFERENCES public.servicem8_companies(uuid) 
    ON DELETE CASCADE;

-- Job contacts table foreign keys
ALTER TABLE public.servicem8_job_contacts 
    ADD CONSTRAINT fk_job_contact_job 
    FOREIGN KEY (job_uuid) 
    REFERENCES public.servicem8_jobs(uuid) 
    ON DELETE CASCADE;

-- Job activities table foreign keys
ALTER TABLE public.servicem8_job_activities 
    ADD CONSTRAINT fk_activity_job 
    FOREIGN KEY (job_uuid) 
    REFERENCES public.servicem8_jobs(uuid) 
    ON DELETE CASCADE;

ALTER TABLE public.servicem8_job_activities 
    ADD CONSTRAINT fk_activity_staff 
    FOREIGN KEY (staff_uuid) 
    REFERENCES public.servicem8_staff(uuid) 
    ON DELETE SET NULL;

-- Job payments table foreign keys
ALTER TABLE public.servicem8_job_payments 
    ADD CONSTRAINT fk_payment_job 
    FOREIGN KEY (job_uuid) 
    REFERENCES public.servicem8_jobs(uuid) 
    ON DELETE CASCADE;

-- =====================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Companies indexes
CREATE INDEX idx_servicem8_companies_user_id ON public.servicem8_companies(user_id);
CREATE INDEX idx_servicem8_companies_active ON public.servicem8_companies(active);
CREATE INDEX idx_servicem8_companies_name ON public.servicem8_companies(name);

-- Categories indexes
CREATE INDEX idx_servicem8_categories_user_id ON public.servicem8_categories(user_id);
CREATE INDEX idx_servicem8_categories_active ON public.servicem8_categories(active);

-- Staff indexes
CREATE INDEX idx_servicem8_staff_user_id ON public.servicem8_staff(user_id);
CREATE INDEX idx_servicem8_staff_active ON public.servicem8_staff(active);
CREATE INDEX idx_servicem8_staff_email ON public.servicem8_staff(email);

-- Jobs indexes
CREATE INDEX idx_servicem8_jobs_user_id ON public.servicem8_jobs(user_id);
CREATE INDEX idx_servicem8_jobs_company_uuid ON public.servicem8_jobs(company_uuid);
CREATE INDEX idx_servicem8_jobs_category_uuid ON public.servicem8_jobs(category_uuid);
CREATE INDEX idx_servicem8_jobs_created_by_staff_uuid ON public.servicem8_jobs(created_by_staff_uuid);
CREATE INDEX idx_servicem8_jobs_date ON public.servicem8_jobs(date);
CREATE INDEX idx_servicem8_jobs_status ON public.servicem8_jobs(status);
CREATE INDEX idx_servicem8_jobs_active ON public.servicem8_jobs(active);
CREATE INDEX idx_servicem8_jobs_generated_job_id ON public.servicem8_jobs(generated_job_id);

-- Contacts indexes
CREATE INDEX idx_servicem8_contacts_user_id ON public.servicem8_contacts(user_id);
CREATE INDEX idx_servicem8_contacts_company_uuid ON public.servicem8_contacts(company_uuid);
CREATE INDEX idx_servicem8_contacts_is_primary ON public.servicem8_contacts(is_primary_contact);
CREATE INDEX idx_servicem8_contacts_active ON public.servicem8_contacts(active);

-- Job contacts indexes
CREATE INDEX idx_servicem8_job_contacts_user_id ON public.servicem8_job_contacts(user_id);
CREATE INDEX idx_servicem8_job_contacts_job_uuid ON public.servicem8_job_contacts(job_uuid);
CREATE INDEX idx_servicem8_job_contacts_active ON public.servicem8_job_contacts(active);

-- Job activities indexes
CREATE INDEX idx_servicem8_job_activities_user_id ON public.servicem8_job_activities(user_id);
CREATE INDEX idx_servicem8_job_activities_job_uuid ON public.servicem8_job_activities(job_uuid);
CREATE INDEX idx_servicem8_job_activities_staff_uuid ON public.servicem8_job_activities(staff_uuid);
CREATE INDEX idx_servicem8_job_activities_start_date ON public.servicem8_job_activities(start_date);
CREATE INDEX idx_servicem8_job_activities_active ON public.servicem8_job_activities(active);

-- Job payments indexes
CREATE INDEX idx_servicem8_job_payments_user_id ON public.servicem8_job_payments(user_id);
CREATE INDEX idx_servicem8_job_payments_job_uuid ON public.servicem8_job_payments(job_uuid);
CREATE INDEX idx_servicem8_job_payments_timestamp ON public.servicem8_job_payments(timestamp);
CREATE INDEX idx_servicem8_job_payments_active ON public.servicem8_job_payments(active);

-- =====================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.servicem8_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_job_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_job_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_job_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: CREATE RLS POLICIES
-- =====================================================

-- Companies policies
CREATE POLICY "Users can view their own companies" 
    ON public.servicem8_companies FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own companies" 
    ON public.servicem8_companies FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies" 
    ON public.servicem8_companies FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companies" 
    ON public.servicem8_companies FOR DELETE 
    USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can view their own categories" 
    ON public.servicem8_categories FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" 
    ON public.servicem8_categories FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
    ON public.servicem8_categories FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
    ON public.servicem8_categories FOR DELETE 
    USING (auth.uid() = user_id);

-- Staff policies
CREATE POLICY "Users can view their own staff" 
    ON public.servicem8_staff FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own staff" 
    ON public.servicem8_staff FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own staff" 
    ON public.servicem8_staff FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own staff" 
    ON public.servicem8_staff FOR DELETE 
    USING (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Users can view their own jobs" 
    ON public.servicem8_jobs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" 
    ON public.servicem8_jobs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
    ON public.servicem8_jobs FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs" 
    ON public.servicem8_jobs FOR DELETE 
    USING (auth.uid() = user_id);

-- Contacts policies
CREATE POLICY "Users can view their own contacts" 
    ON public.servicem8_contacts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts" 
    ON public.servicem8_contacts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts" 
    ON public.servicem8_contacts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts" 
    ON public.servicem8_contacts FOR DELETE 
    USING (auth.uid() = user_id);

-- Job contacts policies
CREATE POLICY "Users can view their own job contacts" 
    ON public.servicem8_job_contacts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job contacts" 
    ON public.servicem8_job_contacts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job contacts" 
    ON public.servicem8_job_contacts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job contacts" 
    ON public.servicem8_job_contacts FOR DELETE 
    USING (auth.uid() = user_id);

-- Job activities policies
CREATE POLICY "Users can view their own job activities" 
    ON public.servicem8_job_activities FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job activities" 
    ON public.servicem8_job_activities FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job activities" 
    ON public.servicem8_job_activities FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job activities" 
    ON public.servicem8_job_activities FOR DELETE 
    USING (auth.uid() = user_id);

-- Job payments policies
CREATE POLICY "Users can view their own job payments" 
    ON public.servicem8_job_payments FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job payments" 
    ON public.servicem8_job_payments FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job payments" 
    ON public.servicem8_job_payments FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job payments" 
    ON public.servicem8_job_payments FOR DELETE 
    USING (auth.uid() = user_id);

-- =====================================================
-- STEP 7: CREATE DASHBOARD VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.servicem8_dashboard_view AS
SELECT 
    -- Client Details
    c.uuid AS company_uuid,
    c.name AS client_name,
    COALESCE(cc.email, c.email) AS email,
    COALESCE(cc.phone, c.phone) AS phone,
    cc.mobile AS telephone,
    cc.type AS role,
    
    -- Job Details
    j.uuid AS job_uuid,
    j.generated_job_id AS job_number,
    j.status AS job_status,
    j.date AS job_date,
    j.completion_date,
    cat.name AS job_category,
    cat.color AS category_color,
    
    -- Staff Details
    CONCAT(s.first_name, ' ', s.last_name) AS staff_member,
    s.uuid AS staff_uuid,
    s.job_title AS staff_title,
    
    -- Duration (in seconds and hours)
    ja.start_date AS activity_start,
    ja.end_date AS activity_end,
    EXTRACT(EPOCH FROM (ja.end_date - ja.start_date))::INTEGER AS duration_seconds,
    ROUND(EXTRACT(EPOCH FROM (ja.end_date - ja.start_date)) / 3600, 2) AS duration_hours,
    
    -- Payment Details
    j.payment_amount,
    j.payment_received AS payment_status,
    j.payment_method,
    j.payment_received_stamp AS payment_date,
    j.total_invoice_amount AS total,
    
    -- Total payments from payments table
    COALESCE(
        (SELECT SUM(amount) 
         FROM public.servicem8_job_payments jp 
         WHERE jp.job_uuid = j.uuid 
         AND jp.active = true),
        0
    ) AS total_payments_received,
    
    -- Job Contact Role
    jc.type AS job_contact_role,
    CONCAT(jc.first_name, ' ', jc.last_name) AS job_contact_name,
    
    -- Metadata
    j.user_id,
    j.created_at,
    j.updated_at

FROM public.servicem8_companies c

-- Get primary contact details
LEFT JOIN public.servicem8_contacts cc 
    ON c.uuid = cc.company_uuid 
    AND cc.is_primary_contact = 'Yes' 
    AND cc.active = true

-- Get jobs for this company
LEFT JOIN public.servicem8_jobs j 
    ON c.uuid = j.company_uuid 
    AND j.active = true

-- Get job category
LEFT JOIN public.servicem8_categories cat 
    ON j.category_uuid = cat.uuid 
    AND cat.active = true

-- Get job activities (for duration and staff)
LEFT JOIN public.servicem8_job_activities ja 
    ON j.uuid = ja.job_uuid 
    AND ja.active = true

-- Get staff member details
LEFT JOIN public.servicem8_staff s 
    ON ja.staff_uuid = s.uuid 
    AND s.active = true

-- Get job-specific contacts
LEFT JOIN public.servicem8_job_contacts jc 
    ON j.uuid = jc.job_uuid 
    AND jc.active = true

WHERE c.active = true;

-- =====================================================
-- STEP 8: CREATE HELPER FUNCTIONS (OPTIONAL)
-- =====================================================

-- Function to get total job duration for a company
CREATE OR REPLACE FUNCTION get_company_total_duration(company_id UUID)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ja.end_date - ja.start_date)) / 3600), 0)
        FROM servicem8_job_activities ja
        JOIN servicem8_jobs j ON ja.job_uuid = j.uuid
        WHERE j.company_uuid = company_id
        AND ja.active = true
        AND j.active = true
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get total payments for a job
CREATE OR REPLACE FUNCTION get_job_total_payments(job_id UUID)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(amount), 0)
        FROM servicem8_job_payments
        WHERE job_uuid = job_id
        AND active = true
    );
END;
$$ LANGUAGE plpgsql;
