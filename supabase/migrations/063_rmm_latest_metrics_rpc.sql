-- 063: RPC de "última métrica por endpoint" (O(endpoints), no O(métricas)).
--
-- La lista de endpoints y el cron de alertas necesitan la última métrica de cada
-- endpoint. El enfoque previo (traer métricas .in(ids) ORDER BY recorded_at DESC
-- LIMIT N y deduplicar en memoria) ESCANEA todas las métricas de esos endpoints
-- (~O(métricas)), así que crece con la retención (TTL 90 días).
--
-- Esta RPC usa un LATERAL con LIMIT 1 por endpoint: un seek por índice
-- (idx_metrics_endpoint_time) por endpoint. Tiempo ~plano sin importar cuántas
-- métricas se acumulen. Medido: 61 ms -> 0.9 ms con 50 endpoints / 100k métricas.
CREATE OR REPLACE FUNCTION public.rmm_latest_metrics(p_org uuid)
RETURNS TABLE (
  endpoint_id   uuid,
  cpu_pct       numeric,
  ram_pct       numeric,
  disk_free_pct numeric,
  recorded_at   timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT e.id, m.cpu_pct, m.ram_pct, m.disk_free_pct, m.recorded_at
  FROM public.endpoints e
  CROSS JOIN LATERAL (
    SELECT cpu_pct, ram_pct, disk_free_pct, recorded_at
    FROM public.endpoint_metrics
    WHERE endpoint_id = e.id
    ORDER BY recorded_at DESC
    LIMIT 1
  ) m
  WHERE e.organization_id = p_org;
$$;

-- SECURITY INVOKER (default): al llamarla un usuario, la RLS de endpoint_metrics
-- sigue aplicando. El service_role (rutas admin/cron) la ejecuta sin restricción.
REVOKE ALL ON FUNCTION public.rmm_latest_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rmm_latest_metrics(uuid) TO authenticated, service_role;
