-- Create admin_page_permissions table to manage dashboard page access for admin users
CREATE TABLE IF NOT EXISTS public.admin_page_permissions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  admin_user_id uuid NOT NULL,
  page_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admin_page_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_page_permissions_admin_user_id_fkey FOREIGN KEY (admin_user_id) 
    REFERENCES public.business_info(id) ON DELETE CASCADE,
  CONSTRAINT admin_page_permissions_unique UNIQUE (admin_user_id, page_path)
) TABLESPACE pg_default;

-- Create index on admin_user_id for faster queries
CREATE INDEX IF NOT EXISTS admin_page_permissions_admin_user_id_idx 
  ON public.admin_page_permissions(admin_user_id);

-- Create index on page_path for bulk operations
CREATE INDEX IF NOT EXISTS admin_page_permissions_page_path_idx 
  ON public.admin_page_permissions(page_path);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_admin_page_permissions_updated_at
  BEFORE UPDATE ON public.admin_page_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.admin_page_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admins can view all admin page permissions
CREATE POLICY "Super admins can view all admin page permissions"
  ON public.admin_page_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can insert admin page permissions
CREATE POLICY "Super admins can insert admin page permissions"
  ON public.admin_page_permissions
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
CREATE POLICY "Super admins can update admin page permissions"
  ON public.admin_page_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );

-- Policy: Only super_admins can delete admin page permissions
CREATE POLICY "Super admins can delete admin page permissions"
  ON public.admin_page_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info
      WHERE business_info.user_id = auth.uid()
      AND business_info.role = 'super_admin'
    )
  );
