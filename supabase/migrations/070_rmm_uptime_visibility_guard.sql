-- 070: Defensa en profundidad para rmm_endpoint_uptime.
--
-- La RPC (SECURITY INVOKER) ya dependía de la RLS de endpoint_metrics, pero si un
-- cliente pedía un endpoint de OTRA organización, `days` generaba igual la fila
-- del día en curso (con 0% por ausencia de métricas). No era una fuga (no exponía
-- datos reales), pero devolvía una fila que debería estar vacía. Ahora, si el
-- endpoint no es visible para quien llama (`ep` vacío por RLS), no devuelve nada.
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
    SELECT greatest(
      ceil(extract(epoch FROM (
        least(d.day::timestamptz + interval '1 day', now())
        - greatest(d.day::timestamptz, coalesce((SELECT created_at FROM ep), d.day::timestamptz))
      )) / 3600.0), 1) AS expected_hours
  ) h
  LEFT JOIN present p ON p.day = d.day
  -- Si el endpoint no es visible para quien llama (otra org), `ep` está vacío
  -- y no se devuelve ninguna fila.
  WHERE EXISTS (SELECT 1 FROM ep)
  ORDER BY d.day;
$$;
