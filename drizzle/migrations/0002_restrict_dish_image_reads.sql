DROP POLICY IF EXISTS "dish images readable" ON storage.objects;
CREATE POLICY "admin reads dish images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dishes' AND public.has_role(auth.uid(), 'admin'::public.app_role));