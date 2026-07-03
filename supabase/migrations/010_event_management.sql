-- ============================================================
-- 010 — Event Management (ingesta de alertas de monitoreo)
-- ============================================================
-- Registra los eventos recibidos de herramientas de monitoreo y los correlaciona
-- con incidentes (tickets). El fingerprint permite deduplicar alertas repetidas.
-- ============================================================
CREATE TABLE IF NOT EXISTS monitoring_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source          TEXT,
  severity        TEXT,
  host            TEXT,
  metric          TEXT,
  summary         TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing','resolved')),
  fingerprint     TEXT,
  action          TEXT,        -- created | correlated | resolved | noop
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monitoring_events_fingerprint_idx ON monitoring_events (fingerprint);
CREATE INDEX IF NOT EXISTS monitoring_events_created_idx ON monitoring_events (created_at DESC);

ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monitoring_events_select ON monitoring_events;
CREATE POLICY monitoring_events_select ON monitoring_events FOR SELECT USING (
  get_my_role() IN ('admin','agent')
);
