-- 040: Recordatorios de facturas vencidas.
-- reminder_sent_at evita reenviar el recordatorio en cada corrida del cron.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
