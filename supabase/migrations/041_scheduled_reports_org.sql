-- 041: Reporte programado acotado opcionalmente a un cliente.
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
