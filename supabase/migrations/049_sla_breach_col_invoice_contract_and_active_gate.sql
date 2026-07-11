-- 049: correctivos del mini-sprint.
-- Vincula la factura al contrato para poder revertir used_hours al borrarla.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES service_contracts(id) ON DELETE SET NULL;

-- Segundo hito de SLA: aviso de VENCIDO independiente del de "por vencer".
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_breach_notified_at TIMESTAMPTZ;

-- Un usuario desactivado pierde rol y organización efectivos (cierra su acceso
-- vía RLS/PostgREST, no solo en la interfaz).
CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true; $$;

CREATE OR REPLACE FUNCTION public.get_my_org()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT organization_id FROM profiles WHERE id = auth.uid() AND is_active = true; $$;
