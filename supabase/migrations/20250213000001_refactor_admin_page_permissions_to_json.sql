-- Refactor admin_page_permissions to store pages as JSON array instead of individual rows
-- This creates one entry per user with all pages stored in a JSON array

-- Step 1: Create new table structure
CREATE TABLE IF NOT EXISTS public.admin_page_permissions_v2 (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  admin_user_id uuid NOT NULL,
  page_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admin_page_permissions_v2_pkey PRIMARY KEY (id),
  CONSTRAINT admin_page_permissions_v2_admin_user_id_fkey FOREIGN KEY (admin_user_id) 
    REFERENCES public.business_info(id) ON DELETE CASCADE,
  CONSTRAINT admin_page_permissions_v2_admin_user_id_unique UNIQUE (admin_user_id)
) TABLESPACE pg_default;

-- Step 2: Migrate existing data from old table to new table (if old table exists)
-- Group by admin_user_id and collect all page_paths into a JSON array
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'admin_page_permissions'
             AND table_type = 'BASE TABLE') THEN
    -- Check if old table has the old structure (with page_path column)
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'admin_page_permissions' 
               AND column_name = 'page_path') THEN
      -- Migrate from old structure (one row per page)
      INSERT INTO public.admin_page_permissions_v2 (admin_user_id, page_paths, created_at, updated_at)
      SELECT 
        admin_user_id,
        jsonb_agg(page_path ORDER BY page_path) as page_paths,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM public.admin_page_permissions
      GROUP BY admin_user_id
      ON CONFLICT (admin_user_id) DO NOTHING;
    ELSIF EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'admin_page_permissions' 
                  AND column_name = 'page_paths') THEN
      -- Table already has new structure, just copy data
      INSERT INTO public.admin_page_permissions_v2 (admin_user_id, page_paths, created_at, updated_at)
      SELECT admin_user_id, page_paths, created_at, updated_at
      FROM public.admin_page_permissions
      ON CONFLICT (admin_user_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Step 3: Create index on admin_user_id (unique constraint already creates one, but for clarity)
CREATE INDEX IF NOT EXISTS admin_page_permissions_v2_admin_user_id_idx 
  ON public.admin_page_permissions_v2(admin_user_id);

-- Step 4: Create GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS admin_page_permissions_v2_page_paths_gin_idx 
  ON public.admin_page_permissions_v2 USING GIN (page_paths);

-- Step 5: Add trigger to update updated_at timestamp
CREATE TRIGGER update_admin_page_permissions_v2_updated_at
  BEFORE UPDATE ON public.admin_page_permissions_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Add RLS policies
ALTER TABLE public.admin_page_permissions_v2 ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admins can view all admin page permissions
CREATE POLICY "Super admins can view all admin page permissions v2"
  ON public.admin_page_permissions_v2
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can insert admin page permissions
CREATE POLICY "Super admins can insert admin page permissions v2"
  ON public.admin_page_permissions_v2
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
    AND EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.id = admin_user_id
      AND business_info.role = 'admin'
    )
  );

-- Policy: Only super_admins can update admin page permissions
CREATE POLICY "Super admins can update admin page permissions v2"
  ON public.admin_page_permissions_v2
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can delete admin page permissions
CREATE POLICY "Super admins can delete admin page permissions v2"
  ON public.admin_page_permissions_v2
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Step 7: Backup old table (if it exists and has old structure)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'admin_page_permissions'
             AND table_type = 'BASE TABLE') THEN
    -- Only backup if it's the old structure
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'admin_page_permissions' 
               AND column_name = 'page_path') THEN
      ALTER TABLE IF EXISTS public.admin_page_permissions 
        RENAME TO admin_page_permissions_old_backup;
    END IF;
  END IF;
END $$;

-- Step 8: Rename new table to final name
ALTER TABLE public.admin_page_permissions_v2 
  RENAME TO admin_page_permissions;
