-- Monto realmente consignado por el cliente (dato de caja, no estimacion).
--
-- Por que: la rentabilidad estimaba el neto con billing_profile.retention_pct,
-- un porcentaje global (11%). Pero la retencion la define cada cliente y varia:
-- BIOFIX retuvo 4% sobre una cuenta de 120.000, asi que entraron 115.200 y no
-- los 106.800 que mostraba el modulo. Cuando esta columna tiene valor, manda
-- sobre la estimacion (ver src/features/expenses/income.ts).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_received numeric(14,2);

COMMENT ON COLUMN public.invoices.amount_received IS
  'Monto realmente recibido del cliente. Si es NULL, la rentabilidad estima el neto con retention_pct.';
