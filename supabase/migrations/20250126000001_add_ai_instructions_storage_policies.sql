-- Create the ai-instructions storage bucket
-- Using SQL to bypass RLS restrictions (migrations run with elevated privileges)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-instructions',
  'ai-instructions',
  true,
  52428800, -- 50MB limit (50 * 1024 * 1024)
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ai-instructions bucket
-- These policies allow superadmins to manage files in the ai-instructions bucket

-- Policy to allow superadmins to upload files
-- Files are organized by category: {category}/{filename}
CREATE POLICY "Superadmins can upload AI instruction files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-instructions' AND
  (
    (storage.foldername(name))[1] = 'company_info' OR
    (storage.foldername(name))[1] = 'product_info' OR
    (storage.foldername(name))[1] = 'service_info' OR
    (storage.foldername(name))[1] = 'other'
  ) AND
  EXISTS (
    SELECT 1 FROM business_info 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Policy to allow superadmins to read files
-- Files are organized by category: {category}/{filename}
CREATE POLICY "Superadmins can read AI instruction files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-instructions' AND
  (
    (storage.foldername(name))[1] = 'company_info' OR
    (storage.foldername(name))[1] = 'product_info' OR
    (storage.foldername(name))[1] = 'service_info' OR
    (storage.foldername(name))[1] = 'other'
  ) AND
  EXISTS (
    SELECT 1 FROM business_info 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Policy to allow superadmins to update files
-- Files are organized by category: {category}/{filename}
CREATE POLICY "Superadmins can update AI instruction files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai-instructions' AND
  (
    (storage.foldername(name))[1] = 'company_info' OR
    (storage.foldername(name))[1] = 'product_info' OR
    (storage.foldername(name))[1] = 'service_info' OR
    (storage.foldername(name))[1] = 'other'
  ) AND
  EXISTS (
    SELECT 1 FROM business_info 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
)
WITH CHECK (
  bucket_id = 'ai-instructions' AND
  (
    (storage.foldername(name))[1] = 'company_info' OR
    (storage.foldername(name))[1] = 'product_info' OR
    (storage.foldername(name))[1] = 'service_info' OR
    (storage.foldername(name))[1] = 'other'
  ) AND
  EXISTS (
    SELECT 1 FROM business_info 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Policy to allow superadmins to delete files
-- Files are organized by category: {category}/{filename}
CREATE POLICY "Superadmins can delete AI instruction files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-instructions' AND
  (
    (storage.foldername(name))[1] = 'company_info' OR
    (storage.foldername(name))[1] = 'product_info' OR
    (storage.foldername(name))[1] = 'service_info' OR
    (storage.foldername(name))[1] = 'other'
  ) AND
  EXISTS (
    SELECT 1 FROM business_info 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Policy to allow public read access (since bucket is public)
-- This allows anyone to read the files via public URL
CREATE POLICY "Public can read AI instruction files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ai-instructions');

