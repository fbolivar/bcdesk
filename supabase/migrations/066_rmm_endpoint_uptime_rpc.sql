-- 066: RPC de disponibilidad (uptime %) diaria por endpoint, para el portal cliente.
--
-- Calcula, por día de los últimos N días, el % de HORAS con al menos un heartbeat
-- (métricas cada 5 min → una hora "presente" si hubo >=1 lectura). El día en curso
-- se prorratea por las horas transcurridas; los días previos a la creación del
-- endpoint no se cuentan.
--
-- SECURITY INVOKER (default): al llamarla el cliente, la RLS de endpoints y
-- endpoint_metrics aplica → solo obtiene datos de SUS propios equipos. Para otro
-- endpoint devuelve vacío (no es fuga, es ausencia).
CREATE OR REPLACE FUNCTION public.rmm_endpoint_uptime(p_endpoint uuid, p_days int DEFAULT 30)
RETURNS TABLE (day date, up_pct numeric)
LANGUAGE sql
STABLE
AS $$
  WITH ep AS (
    SELECT created_at FROM public.endpoints WHERE id = p_endpoint
  ),
  bounds AS (
    SELECT greatest(
             date_trunc('day', now()) - make_interval(days => greatest(p_days,1) - 1),
             date_trunc('day', coalesce((SELECT created_at FROM ep), now()))
           ) AS start_day
  ),
  days AS (
    SELECT generate_series((SELECT start_day FROM bounds), date_trunc('day', now()), interval '1 day')::date AS day
  ),
  present AS (
    SELECT date_trunc('day', recorded_at)::date AS day,
           count(DISTINCT date_trunc('hour', recorded_at)) AS present_hours
    FROM public.endpoint_metrics
    WHERE endpoint_id = p_endpoint
      AND recorded_at >= (SELECT start_day FROM bounds)
    GROUP BY 1
  )
  SELECT
    d.day,
    round(
      100.0 * least(coalesce(p.present_hours, 0), h.expected_hours) / h.expected_hours
    , 1) AS up_pct
  FROM days d
  CROSS JOIN LATERAL (
    -- Horas esperadas = ventana real del día ∩ [creación del endpoint, ahora].
    -- Así el día de instalación y el día en curso se prorratean con justicia.
    SELECT greatest(
      ceil(extract(epoch FROM (
        least(d.day::timestamptz + interval '1 day', now())
        - greatest(d.day::timestamptz, coalesce((SELECT created_at FROM ep), d.day::timestamptz))
      )) / 3600.0), 1) AS expected_hours
  ) h
  LEFT JOIN present p ON p.day = d.day
  ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.rmm_endpoint_uptime(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rmm_endpoint_uptime(uuid, int) TO authenticated, service_role;
