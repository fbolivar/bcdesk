-- 047: vincula time_logs a la factura que las cobró, para des-facturar al
-- borrar la factura (auto-factura desde contrato reversible).
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_logs_invoice ON time_logs(invoice_id);
