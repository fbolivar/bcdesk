-- 015_projects_currency.sql
-- Agrega moneda por proyecto (antes el presupuesto solo tenía budget_usd sin
-- moneda). Default COP para alinearse con el resto de la app.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'COP';
