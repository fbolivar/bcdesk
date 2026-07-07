-- ============================================================
-- 029 · Referencia externa en tickets (integraciones)
-- ============================================================
-- Permite correlacionar un ticket de HexDesk con el ID del sistema externo
-- que lo creó vía /api/v1/tickets (integración bidireccional).
-- ============================================================

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS external_ref text;
CREATE INDEX IF NOT EXISTS idx_tickets_external_ref ON public.tickets (organization_id, external_ref);
