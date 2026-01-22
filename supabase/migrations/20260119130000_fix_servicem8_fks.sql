-- Add Foreign Key constraints to ServiceM8 tables to enable relational joins
-- This is critical for the "Joined Selection" in the API to work correctly and return related data (Client Names, Staff Names, etc.)

-- 1. Jobs Relationships
-- Clean up orphans for company
DELETE FROM public.servicem8_jobs 
WHERE company_uuid IS NOT NULL 
AND company_uuid NOT IN (SELECT uuid FROM public.servicem8_companies);

ALTER TABLE public.servicem8_jobs
    DROP CONSTRAINT IF EXISTS servicem8_jobs_company_uuid_fkey,
    ADD CONSTRAINT servicem8_jobs_company_uuid_fkey 
    FOREIGN KEY (company_uuid) REFERENCES public.servicem8_companies(uuid) ON DELETE SET NULL;

-- Clean up orphans for category
DELETE FROM public.servicem8_jobs 
WHERE category_uuid IS NOT NULL 
AND category_uuid NOT IN (SELECT uuid FROM public.servicem8_categories);

ALTER TABLE public.servicem8_jobs
    DROP CONSTRAINT IF EXISTS servicem8_jobs_category_uuid_fkey,
    ADD CONSTRAINT servicem8_jobs_category_uuid_fkey 
    FOREIGN KEY (category_uuid) REFERENCES public.servicem8_categories(uuid) ON DELETE SET NULL;

-- Clean up orphans for staff
DELETE FROM public.servicem8_jobs 
WHERE created_by_staff_uuid IS NOT NULL 
AND created_by_staff_uuid NOT IN (SELECT uuid FROM public.servicem8_staff);

ALTER TABLE public.servicem8_jobs
    DROP CONSTRAINT IF EXISTS servicem8_jobs_created_by_staff_uuid_fkey,
    ADD CONSTRAINT servicem8_jobs_created_by_staff_uuid_fkey 
    FOREIGN KEY (created_by_staff_uuid) REFERENCES public.servicem8_staff(uuid) ON DELETE SET NULL;

-- 2. Job Activities Relationships
-- Clean up orphans
DELETE FROM public.servicem8_job_activities 
WHERE job_uuid IS NOT NULL 
AND job_uuid NOT IN (SELECT uuid FROM public.servicem8_jobs);

DELETE FROM public.servicem8_job_activities 
WHERE staff_uuid IS NOT NULL 
AND staff_uuid NOT IN (SELECT uuid FROM public.servicem8_staff);

ALTER TABLE public.servicem8_job_activities
    DROP CONSTRAINT IF EXISTS servicem8_job_activities_job_uuid_fkey,
    ADD CONSTRAINT servicem8_job_activities_job_uuid_fkey 
    FOREIGN KEY (job_uuid) REFERENCES public.servicem8_jobs(uuid) ON DELETE CASCADE;

ALTER TABLE public.servicem8_job_activities
    DROP CONSTRAINT IF EXISTS servicem8_job_activities_staff_uuid_fkey,
    ADD CONSTRAINT servicem8_job_activities_staff_uuid_fkey 
    FOREIGN KEY (staff_uuid) REFERENCES public.servicem8_staff(uuid) ON DELETE SET NULL;

-- 3. Job Payments Relationships
-- Clean up orphans
DELETE FROM public.servicem8_job_payments 
WHERE job_uuid IS NOT NULL 
AND job_uuid NOT IN (SELECT uuid FROM public.servicem8_jobs);

ALTER TABLE public.servicem8_job_payments
    DROP CONSTRAINT IF EXISTS servicem8_job_payments_job_uuid_fkey,
    ADD CONSTRAINT servicem8_job_payments_job_uuid_fkey 
    FOREIGN KEY (job_uuid) REFERENCES public.servicem8_jobs(uuid) ON DELETE CASCADE;

-- 4. Job Contacts Relationships
-- Clean up orphans
DELETE FROM public.servicem8_job_contacts 
WHERE job_uuid IS NOT NULL 
AND job_uuid NOT IN (SELECT uuid FROM public.servicem8_jobs);

ALTER TABLE public.servicem8_job_contacts
    DROP CONSTRAINT IF EXISTS servicem8_job_contacts_job_uuid_fkey,
    ADD CONSTRAINT servicem8_job_contacts_job_uuid_fkey 
    FOREIGN KEY (job_uuid) REFERENCES public.servicem8_jobs(uuid) ON DELETE CASCADE;

-- 5. Company Contacts Relationships
-- Clean up orphans
DELETE FROM public.servicem8_contacts 
WHERE company_uuid IS NOT NULL 
AND company_uuid NOT IN (SELECT uuid FROM public.servicem8_companies);

ALTER TABLE public.servicem8_contacts
    DROP CONSTRAINT IF EXISTS servicem8_contacts_company_uuid_fkey,
    ADD CONSTRAINT servicem8_contacts_company_uuid_fkey 
    FOREIGN KEY (company_uuid) REFERENCES public.servicem8_companies(uuid) ON DELETE CASCADE;
