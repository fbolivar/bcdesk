-- 051: Versiona objetos que se habían creado a mano en el dashboard
-- (billing_profile, service_contracts, scheduled_reports y el bucket privado
-- ticket-attachments con sus policies). Idempotente: en producción es no-op;
-- en un entorno nuevo reproduce el esquema real.

-- ── billing_profile (datos del emisor para la cuenta de cobro) ──
CREATE TABLE IF NOT EXISTS billing_profile (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_name          TEXT,
  issuer_role          TEXT,
  issuer_cc            TEXT,
  issuer_cc_city       TEXT,
  issuer_email         TEXT,
  issuer_phone         TEXT,
  issuer_city          TEXT,
  bank_name            TEXT,
  bank_account_type    TEXT,
  bank_account_number  TEXT,
  bank_holder          TEXT,
  bank_holder_cc       TEXT,
  declarations         TEXT,
  retention_pct        NUMERIC(5,2) NOT NULL DEFAULT 11,
  updated_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE billing_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_profile_admin ON billing_profile;
CREATE POLICY billing_profile_admin ON billing_profile FOR ALL
  USING ((SELECT get_my_role()) = 'admin') WITH CHECK ((SELECT get_my_role()) = 'admin');

-- ── service_contracts (contratos de servicio) ──
CREATE TABLE IF NOT EXISTS service_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_type    TEXT DEFAULT 'support',
  status           TEXT DEFAULT 'active',
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  included_hours   NUMERIC DEFAULT 0,
  used_hours       NUMERIC DEFAULT 0,
  support_tier     TEXT DEFAULT 'standard',
  sla_policy_id    UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
  notes            TEXT,
  auto_renew       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage service_contracts" ON service_contracts;
CREATE POLICY "Staff manage service_contracts" ON service_contracts FOR ALL
  USING ((SELECT get_my_role()) IN ('admin','agent')) WITH CHECK ((SELECT get_my_role()) IN ('admin','agent'));

-- ── scheduled_reports (reportes programados por correo) ──
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  report_type      TEXT DEFAULT 'tickets_summary',
  frequency        TEXT DEFAULT 'weekly',
  recipients       TEXT[] NOT NULL DEFAULT '{}',
  filters          JSONB DEFAULT '{}',
  last_sent_at     TIMESTAMPTZ,
  next_send_at     TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT true,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage scheduled_reports" ON scheduled_reports;
CREATE POLICY "Admins manage scheduled_reports" ON scheduled_reports FOR ALL
  USING ((SELECT get_my_role()) = 'admin') WITH CHECK ((SELECT get_my_role()) = 'admin');

-- ── Bucket privado de adjuntos de tickets/visitas ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS auth_read_ticket_attachments ON storage.objects;
CREATE POLICY auth_read_ticket_attachments ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS auth_upload_ticket_attachments ON storage.objects;
CREATE POLICY auth_upload_ticket_attachments ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS auth_delete_ticket_attachments ON storage.objects;
CREATE POLICY auth_delete_ticket_attachments ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND owner = auth.uid());
