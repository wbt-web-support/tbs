-- Create storage bucket for finance files
-- Note: This SQL creates the bucket and sets up storage policies
-- Run this in Supabase SQL Editor after creating the finance_files table

-- Insert the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-files',
  'finance-files',
  false, -- Private bucket
  NULL, -- No file size limit
  NULL -- Allow all file types (validation done in application)
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS is already enabled on storage.objects by default in Supabase
-- No need to run ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY

-- Policy 1: Users can upload files to their own folder
CREATE POLICY "Users can upload finance files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their team's files
CREATE POLICY "Users can view team finance files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance-files' AND
  (storage.foldername(name))[1] IN (
    SELECT user_id::text 
    FROM business_info 
    WHERE team_id IN (
      SELECT team_id 
      FROM business_info 
      WHERE user_id = auth.uid()
    )
  )
);

-- Policy 3: Users can update their own files
CREATE POLICY "Users can update own finance files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'finance-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own files
CREATE POLICY "Users can delete own finance files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify bucket creation
SELECT * FROM storage.buckets WHERE id = 'finance-files';

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%finance%';
