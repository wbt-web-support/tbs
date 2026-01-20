-- Add doc_link column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS doc_link VARCHAR(512);

-- Create the product-docs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-docs',
  'product-docs',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Note: We are skipping the CREATE INDEX on storage.objects as it requires table ownership permissions
-- which are often restricted in certain Supabase environments.

-- Storage policies for product-docs bucket
-- Allow authenticated users to upload documents
DROP POLICY IF EXISTS "Allow authenticated users to upload product docs" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload product docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-docs');

-- Allow authenticated users to update product documents
DROP POLICY IF EXISTS "Allow authenticated users to update product docs" ON storage.objects;
CREATE POLICY "Allow authenticated users to update product docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-docs');

-- Allow authenticated users to delete product documents
DROP POLICY IF EXISTS "Allow authenticated users to delete product docs" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete product docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-docs');

-- Allow public read access to product docs (since bucket is public)
DROP POLICY IF EXISTS "Allow public to read product docs" ON storage.objects;
CREATE POLICY "Allow public to read product docs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-docs');
