-- Allow authenticated users to upload/update/select/delete in machines bucket under team_hierarchy/
-- (Fixes "new row violates row-level security policy" when uploading team hierarchy images)

-- INSERT: allow uploads to team_hierarchy/*
DROP POLICY IF EXISTS "Allow team hierarchy image uploads" ON storage.objects;
CREATE POLICY "Allow team hierarchy image uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'machines'
  AND (storage.foldername(name))[1] = 'team_hierarchy'
);

-- SELECT: allow reading objects in team_hierarchy (needed for upsert and display)
DROP POLICY IF EXISTS "Allow team hierarchy image read" ON storage.objects;
CREATE POLICY "Allow team hierarchy image read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'machines'
  AND (storage.foldername(name))[1] = 'team_hierarchy'
);

-- UPDATE: allow upsert to overwrite (required when using upsert: true)
DROP POLICY IF EXISTS "Allow team hierarchy image update" ON storage.objects;
CREATE POLICY "Allow team hierarchy image update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'machines'
  AND (storage.foldername(name))[1] = 'team_hierarchy'
)
WITH CHECK (
  bucket_id = 'machines'
  AND (storage.foldername(name))[1] = 'team_hierarchy'
);

-- DELETE: allow removing failed uploads or old images
DROP POLICY IF EXISTS "Allow team hierarchy image delete" ON storage.objects;
CREATE POLICY "Allow team hierarchy image delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'machines'
  AND (storage.foldername(name))[1] = 'team_hierarchy'
);
