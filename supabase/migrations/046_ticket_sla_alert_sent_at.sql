-- 046: marca de aviso de SLA por ticket (evita repetir la alerta del cron).
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_alert_sent_at TIMESTAMPTZ;
