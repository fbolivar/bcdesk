-- 068: RPC del reporte "RMM mensual" (por organización o consolidado).
--
-- Métricas de una ventana [start, end): uptime % agregado (horas presentes /
-- horas esperadas sobre todos los endpoints), alertas por severidad, MTTR de
-- tickets RMM (resolved_at - created_at) y nº de tickets. rmm_monthly_report la
-- llama dos veces (mes actual y anterior) para el comparativo, y añade el top-3
-- de equipos por incidentes.

-- Helper: métricas para una ventana. p_org NULL = consolidado (todas las orgs).
CREATE OR REPLACE FUNCTION public.rmm_report_metrics(p_org uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ep AS (
    SELECT id, created_at FROM public.endpoints
    WHERE (p_org IS NULL OR organization_id = p_org) AND disabled_at IS NULL
  ),
  expected AS (
    SELECT coalesce(sum(
      greatest(extract(epoch FROM (least(p_end, now()) - greatest(p_start, created_at))) / 3600.0, 0)
    ), 0) AS hrs
    FROM ep
  ),
  present AS (
    SELECT count(*) AS hrs FROM (
      SELECT DISTINCT m.endpoint_id, date_trunc('hour', m.recorded_at)
      FROM public.endpoint_metrics m
      JOIN ep ON ep.id = m.endpoint_id
      WHERE m.recorded_at >= p_start AND m.recorded_at < p_end
    ) q
  ),
  tk AS (
    SELECT t.priority, t.created_at, t.resolved_at
    FROM public.tickets t
    JOIN ep ON ep.id = t.source_endpoint_id
    WHERE t.source_endpoint_id IS NOT NULL
      AND t.created_at >= p_start AND t.created_at < p_end
  )
  SELECT jsonb_build_object(
    'uptime_pct', CASE WHEN (SELECT hrs FROM expected) > 0
                       THEN least(round((100.0 * (SELECT hrs FROM present) / (SELECT hrs FROM expected))::numeric, 1), 100)
                       ELSE NULL END,
    'alerts', jsonb_build_object(
      'critical', (SELECT count(*) FROM tk WHERE priority = 'critical'),
      'high',     (SELECT count(*) FROM tk WHERE priority = 'high'),
      'medium',   (SELECT count(*) FROM tk WHERE priority = 'medium'),
      'low',      (SELECT count(*) FROM tk WHERE priority = 'low'),
      'total',    (SELECT count(*) FROM tk)
    ),
    'mttr_hours', (SELECT round(avg(extract(epoch FROM (resolved_at - created_at)) / 3600.0)::numeric, 1)
                   FROM tk WHERE resolved_at IS NOT NULL),
    'tickets', (SELECT count(*) FROM tk)
  );
$$;

REVOKE ALL ON FUNCTION public.rmm_report_metrics(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rmm_report_metrics(uuid, timestamptz, timestamptz) TO service_role;

-- Reporte mensual completo (actual + anterior + top3). p_month = primer día del mes.
CREATE OR REPLACE FUNCTION public.rmm_monthly_report(p_org uuid, p_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m_start timestamptz := date_trunc('month', p_month::timestamptz);
  m_end   timestamptz := date_trunc('month', p_month::timestamptz) + interval '1 month';
  p_start timestamptz := date_trunc('month', p_month::timestamptz) - interval '1 month';
BEGIN
  IF public.get_my_role() NOT IN ('admin','agent') THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'month', to_char(m_start, 'YYYY-MM'),
    'current',  public.rmm_report_metrics(p_org, m_start, m_end),
    'previous', public.rmm_report_metrics(p_org, p_start, m_start),
    'top3', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT e.hostname, o.name AS org, count(*) AS incidents
        FROM public.tickets t
        JOIN public.endpoints e ON e.id = t.source_endpoint_id
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE t.source_endpoint_id IS NOT NULL
          AND (p_org IS NULL OR e.organization_id = p_org)
          AND t.created_at >= m_start AND t.created_at < m_end
        GROUP BY e.hostname, o.name
        ORDER BY count(*) DESC
        LIMIT 3
      ) x
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rmm_monthly_report(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rmm_monthly_report(uuid, date) TO authenticated, service_role;
