-- 042: Bucket público para logos de marca.
-- Los correos y reportes necesitan una URL pública estable (no firmada).
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS branding_public_read ON storage.objects;
CREATE POLICY branding_public_read ON storage.objects FOR SELECT USING (bucket_id = 'branding');

DROP POLICY IF EXISTS branding_staff_write ON storage.objects;
CREATE POLICY branding_staff_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (select public.get_my_role()) = 'admin');

DROP POLICY IF EXISTS branding_staff_update ON storage.objects;
CREATE POLICY branding_staff_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (select public.get_my_role()) = 'admin');
