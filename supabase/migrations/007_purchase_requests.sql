-- ============================================================
-- 007 — Solicitudes de compra (para aprobaciones)
-- ============================================================
-- Entidad mínima de "compra" para conectarla al motor de workflows de aprobación.
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  description     TEXT,
  vendor          TEXT,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
  requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchase_requests_status_idx ON purchase_requests (status);

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_requests_select ON purchase_requests;
CREATE POLICY purchase_requests_select ON purchase_requests FOR SELECT USING (
  get_my_role() IN ('admin','agent') OR requested_by = auth.uid()
);

DROP POLICY IF EXISTS purchase_requests_insert ON purchase_requests;
CREATE POLICY purchase_requests_insert ON purchase_requests FOR INSERT WITH CHECK (
  get_my_role() IN ('admin','agent')
);

DROP POLICY IF EXISTS purchase_requests_update ON purchase_requests;
CREATE POLICY purchase_requests_update ON purchase_requests FOR UPDATE USING (
  get_my_role() IN ('admin','agent')
);

DROP POLICY IF EXISTS purchase_requests_delete ON purchase_requests;
CREATE POLICY purchase_requests_delete ON purchase_requests FOR DELETE USING (
  get_my_role() = 'admin'
);
