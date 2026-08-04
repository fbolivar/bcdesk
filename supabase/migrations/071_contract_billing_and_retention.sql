-- 071: Datos de facturación del contrato + retención en la cuenta de cobro.
--
-- El contrato gana su valor a cobrar por periodo (mensualidad), moneda, % de
-- retención en la fuente y valor total del contrato. La factura/cuenta de cobro
-- gana la retención como DEDUCCIÓN (no es un impuesto que suma como el IVA, sino
-- un descuento que el cliente retiene: total a pagar = subtotal + IVA - retención).
ALTER TABLE public.service_contracts
  ADD COLUMN IF NOT EXISTS billing_amount   numeric,               -- valor a cobrar por periodo (mensual)
  ADD COLUMN IF NOT EXISTS billing_currency text DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS retention_pct    numeric DEFAULT 0,     -- % retención en la fuente
  ADD COLUMN IF NOT EXISTS total_value      numeric;              -- valor total del contrato (informativo)

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retention_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_usd numeric DEFAULT 0;
