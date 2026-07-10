-- 043: Actividades ejecutadas por contrato (para el informe de gestión).
CREATE TABLE IF NOT EXISTS contract_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  activity_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT NOT NULL,
  hours            NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
  obligation       TEXT,
  result           TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_activities_contract ON contract_activities(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_activities_date ON contract_activities(activity_date);

ALTER TABLE contract_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_activities_staff ON contract_activities;
CREATE POLICY contract_activities_staff ON contract_activities FOR ALL
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));
