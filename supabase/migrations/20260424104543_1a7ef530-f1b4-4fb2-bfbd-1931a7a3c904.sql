-- Replace overly broad public SELECT with authenticated-only listing.
-- Public bucket URLs still work for direct file fetches because the bucket is marked public.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can list avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');