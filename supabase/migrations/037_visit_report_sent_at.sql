-- 037: Marca cuándo se envió el acta de la visita técnica al cliente.
-- Permite mostrar en la UI si el acta ya fue enviada y cuándo.
ALTER TABLE technical_visits ADD COLUMN IF NOT EXISTS report_sent_at TIMESTAMPTZ;
