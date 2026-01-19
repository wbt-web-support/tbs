-- Add RLS policies for ServiceM8 relational tables
-- This ensures that users can only manage their own synced data

-- 1. Jobs Table
ALTER TABLE public.servicem8_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 jobs" ON public.servicem8_jobs;
CREATE POLICY "Users can manage their own ServiceM8 jobs" ON public.servicem8_jobs
    FOR ALL USING (auth.uid() = user_id);

-- 2. Staff Table
ALTER TABLE public.servicem8_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 staff" ON public.servicem8_staff;
CREATE POLICY "Users can manage their own ServiceM8 staff" ON public.servicem8_staff
    FOR ALL USING (auth.uid() = user_id);

-- 3. Companies Table
ALTER TABLE public.servicem8_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 companies" ON public.servicem8_companies;
CREATE POLICY "Users can manage their own ServiceM8 companies" ON public.servicem8_companies
    FOR ALL USING (auth.uid() = user_id);

-- 4. Categories Table
ALTER TABLE public.servicem8_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 categories" ON public.servicem8_categories;
CREATE POLICY "Users can manage their own ServiceM8 categories" ON public.servicem8_categories
    FOR ALL USING (auth.uid() = user_id);

-- 5. Company Contacts Table (The People)
ALTER TABLE public.servicem8_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 contacts" ON public.servicem8_contacts;
CREATE POLICY "Users can manage their own ServiceM8 contacts" ON public.servicem8_contacts
    FOR ALL USING (auth.uid() = user_id);

-- 6. Job Contacts Table
ALTER TABLE public.servicem8_job_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 job contacts" ON public.servicem8_job_contacts;
CREATE POLICY "Users can manage their own ServiceM8 job contacts" ON public.servicem8_job_contacts
    FOR ALL USING (auth.uid() = user_id);

-- 7. Job Activities Table
ALTER TABLE public.servicem8_job_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicem8_job_activities ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 activities" ON public.servicem8_job_activities;
CREATE POLICY "Users can manage their own ServiceM8 activities" ON public.servicem8_job_activities
    FOR ALL USING (auth.uid() = user_id);

-- 8. Job Payments Table
ALTER TABLE public.servicem8_job_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own ServiceM8 payments" ON public.servicem8_job_payments;
CREATE POLICY "Users can manage their own ServiceM8 payments" ON public.servicem8_job_payments
    FOR ALL USING (auth.uid() = user_id);
