-- 081: el widget de salud de flota del dashboard muestra el nombre del equipo.
-- Ahora usa coalesce(display_name, hostname) para reflejar el alias amigable en
-- top5 y active_alerts. El componente no cambia (sigue leyendo `hostname`).
CREATE OR REPLACE FUNCTION public.rmm_fleet_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF public.get_my_role() NOT IN ('admin','agent') THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total',  count(*),
        'online', count(*) FILTER (WHERE last_seen_at > now() - interval '10 minutes'),
        'with_active_alert', (
          SELECT count(DISTINCT t.source_endpoint_id)
          FROM tickets t
          WHERE t.source_endpoint_id IS NOT NULL
            AND t.status NOT IN ('resolved','closed','cancelled')
        )
      )
      FROM endpoints WHERE disabled_at IS NULL
    ),
    'top5', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT e.id AS endpoint_id, coalesce(e.display_name, e.hostname) AS hostname, o.name AS org, count(*) AS tickets
        FROM tickets t
        JOIN endpoints e ON e.id = t.source_endpoint_id
        JOIN organizations o ON o.id = e.organization_id
        WHERE t.source_endpoint_id IS NOT NULL
          AND t.created_at >= now() - interval '30 days'
        GROUP BY e.id, e.display_name, e.hostname, o.name
        ORDER BY count(*) DESC
        LIMIT 5
      ) x
    ),
    'trend', (
      SELECT coalesce(jsonb_agg(y ORDER BY y.week), '[]'::jsonb) FROM (
        SELECT to_char(gs, 'YYYY-MM-DD') AS week,
          (SELECT count(*) FROM tickets t
             WHERE t.source_endpoint_id IS NOT NULL AND date_trunc('week', t.created_at) = gs) AS rmm,
          (SELECT count(*) FROM tickets t
             WHERE t.source_endpoint_id IS NULL AND date_trunc('week', t.created_at) = gs) AS manual
        FROM generate_series(date_trunc('week', now()) - interval '7 weeks',
                             date_trunc('week', now()), interval '1 week') gs
      ) y
    ),
    'active_alerts', (
      SELECT coalesce(jsonb_agg(z), '[]'::jsonb) FROM (
        SELECT t.id AS ticket_id, t.ticket_number, t.title, t.priority, t.created_at,
               coalesce(e.display_name, e.hostname) AS hostname, o.name AS org
        FROM tickets t
        JOIN endpoints e ON e.id = t.source_endpoint_id
        JOIN organizations o ON o.id = e.organization_id
        WHERE t.source_endpoint_id IS NOT NULL
          AND t.status NOT IN ('resolved','closed','cancelled')
        ORDER BY CASE t.priority
                   WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
                 t.created_at ASC
        LIMIT 20
      ) z
    )
  ) INTO result;

  RETURN result;
END;
$function$;
