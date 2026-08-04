-- 075: Documentos adjuntos por actividad del informe de gestión del contrato.
CREATE TABLE IF NOT EXISTS public.contract_activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.contract_activities(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caa_activity ON public.contract_activity_attachments(activity_id);

ALTER TABLE public.contract_activity_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY caa_staff ON public.contract_activity_attachments
  FOR ALL
  USING ((SELECT public.get_my_role()) = ANY (ARRAY['admin','agent']))
  WITH CHECK ((SELECT public.get_my_role()) = ANY (ARRAY['admin','agent']));

GRANT SELECT, INSERT, DELETE ON public.contract_activity_attachments TO authenticated, service_role;
