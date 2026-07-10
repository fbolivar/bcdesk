-- 038: Gastos por servicio para medir rentabilidad (interno, admin/agente).
-- Cada gasto (transporte, comida, equipos, etc.) se liga a un ticket y/o visita
-- y se cruza con lo cobrado (cuentas de cobro) para calcular el margen.

CREATE TABLE IF NOT EXISTS service_expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO service_expense_categories (name) VALUES
  ('Transporte'), ('Alimentación'), ('Alojamiento'),
  ('Equipos/Insumos'), ('Herramientas'), ('Peajes/Parqueo'), ('Otros')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_expenses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ticket_id        UUID REFERENCES tickets(id) ON DELETE SET NULL,
  visit_id         UUID REFERENCES technical_visits(id) ON DELETE SET NULL,
  category         TEXT NOT NULL,
  description      TEXT,
  amount           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency         TEXT NOT NULL DEFAULT 'COP',
  spent_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_expenses_has_link CHECK (ticket_id IS NOT NULL OR visit_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_service_expenses_ticket ON service_expenses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_visit ON service_expenses(visit_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_org ON service_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_expenses_spent ON service_expenses(spent_at);

ALTER TABLE service_expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_expense_categories_staff ON service_expense_categories;
CREATE POLICY service_expense_categories_staff ON service_expense_categories FOR ALL
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));

ALTER TABLE service_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_expenses_staff ON service_expenses;
CREATE POLICY service_expenses_staff ON service_expenses FOR ALL
  USING ((select public.get_my_role()) IN ('admin','agent'))
  WITH CHECK ((select public.get_my_role()) IN ('admin','agent'));
