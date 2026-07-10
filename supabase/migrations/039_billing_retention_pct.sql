-- 039: % de retención en la fuente para el cálculo de rentabilidad.
-- En cuenta de cobro el cliente descuenta retefuente del pago; este % permite
-- calcular el ingreso NETO real. Default 11% (honorarios/declarante), editable.
ALTER TABLE billing_profile ADD COLUMN IF NOT EXISTS retention_pct NUMERIC(5,2) NOT NULL DEFAULT 11;
