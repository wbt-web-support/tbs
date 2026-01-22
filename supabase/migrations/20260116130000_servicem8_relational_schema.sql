-- Create separate tables for ServiceM8 relational sync
-- This enables fast filtering by date, status, staff, and category

-- 1. Jobs Table
CREATE TABLE IF NOT EXISTS public.servicem8_jobs (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_number TEXT,
    status TEXT,
    date TIMESTAMP WITH TIME ZONE,
    total_invoice_amount DECIMAL(12,2) DEFAULT 0,
    company_uuid UUID,
    category_uuid UUID,
    created_by_staff_uuid UUID,
    job_address TEXT,
    job_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Staff Table
CREATE TABLE IF NOT EXISTS public.servicem8_staff (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    active BOOLEAN DEFAULT TRUE,
    job_title TEXT
);

-- 3. Companies Table (Clients)
CREATE TABLE IF NOT EXISTS public.servicem8_companies (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    address TEXT,
    email TEXT,
    phone TEXT
);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS public.servicem8_categories (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- 5. Company Contacts Table (The People)
CREATE TABLE IF NOT EXISTS public.servicem8_contacts (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_uuid UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    type TEXT -- e.g. 'BILLING', 'JOB'
);

-- 6. Job Contacts Table (Linking People to Jobs with Roles)
CREATE TABLE IF NOT EXISTS public.servicem8_job_contacts (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    contact_uuid UUID,
    role TEXT, -- the "type" field from the API response
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT
);

-- 7. Job Activities Table (For Duration Calculation)
CREATE TABLE IF NOT EXISTS public.servicem8_job_activities (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    staff_uuid UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    travel_time_in_seconds INTEGER DEFAULT 0
);

-- 8. Job Payments Table
CREATE TABLE IF NOT EXISTS public.servicem8_job_payments (
    uuid UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_uuid UUID,
    amount DECIMAL(12,2) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE,
    method TEXT,
    note TEXT
);

-- Add indexes for fast 7-week filtering
CREATE INDEX IF NOT EXISTS idx_servicem8_jobs_date ON public.servicem8_jobs(date);
CREATE INDEX IF NOT EXISTS idx_servicem8_jobs_user_id ON public.servicem8_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_servicem8_activities_job_uuid ON public.servicem8_job_activities(job_uuid);
CREATE INDEX IF NOT EXISTS idx_servicem8_payments_job_uuid ON public.servicem8_job_payments(job_uuid);

-- Enable RLS (Row Level Security)
ALTER TABLE public.servicem8_jobs ENABLE ROW LEVEL SECURITY;
-- ... (You would add policies here to ensure users only see their own data)
