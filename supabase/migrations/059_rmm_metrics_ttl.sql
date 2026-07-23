-- 059: TTL de 90 dias para endpoint_metrics (alto volumen).
-- Job diario de pg_cron (reutiliza el pg_cron que ya usa el proyecto). El
-- borrado de metricas viejas es un concern de la BD; NO se mete en el cron de
-- alertas de Vercel para no mezclar responsabilidades.
SELECT cron.schedule(
  'rmm-metrics-ttl',
  '30 3 * * *',
  $$DELETE FROM public.endpoint_metrics WHERE recorded_at < now() - interval '90 days'$$
);
