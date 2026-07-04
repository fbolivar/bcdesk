-- 013_itil_categories.sql
-- Amplía las categorías de ticket con un set alineado a ITIL, conservando
-- las genéricas existentes (superset → no rompe datos ni código actual).

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check CHECK (category IN (
  -- ITIL
  'hardware', 'software', 'network', 'access', 'email', 'security', 'application', 'service_request',
  -- Genéricas
  'support', 'other', 'development', 'billing', 'onboarding'
));
