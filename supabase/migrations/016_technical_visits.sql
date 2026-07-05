-- 016_technical_visits.sql
-- Módulo de Visitas Técnicas: registra y deja evidencia de cada visita a sitio
-- de un cliente (soporte, mantenimiento preventivo/correctivo, incidentes).
-- Uso interno: admin y agentes.

CREATE TABLE IF NOT EXISTS technical_visits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_number     TEXT UNIQUE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_type       TEXT NOT NULL DEFAULT 'support'
                     CHECK (visit_type IN ('support','preventive','corrective','incident')),
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  technician_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ticket_id        UUID REFERENCES tickets(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  location         TEXT,
  contact_name     TEXT,
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  work_performed   TEXT,
  findings         TEXT,
  recommendations  TEXT,
  materials        TEXT,
  client_signoff   TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_visits_org ON technical_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_tech_visits_status ON technical_visits(status);
CREATE INDEX IF NOT EXISTS idx_tech_visits_tech ON technical_visits(technician_id);

CREATE TABLE IF NOT EXISTS technical_visit_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id         UUID NOT NULL REFERENCES technical_visits(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  mime_type        TEXT,
  file_size_bytes  BIGINT,
  uploaded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tech_visit_att_visit ON technical_visit_attachments(visit_id);

-- RLS: solo staff (admin/agent). Los clientes no acceden a este módulo.
ALTER TABLE technical_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS technical_visits_staff ON technical_visits;
CREATE POLICY technical_visits_staff ON technical_visits FOR ALL
  USING (get_my_role() IN ('admin','agent'))
  WITH CHECK (get_my_role() IN ('admin','agent'));

ALTER TABLE technical_visit_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS technical_visit_att_staff ON technical_visit_attachments;
CREATE POLICY technical_visit_att_staff ON technical_visit_attachments FOR ALL
  USING (get_my_role() IN ('admin','agent'))
  WITH CHECK (get_my_role() IN ('admin','agent'));
