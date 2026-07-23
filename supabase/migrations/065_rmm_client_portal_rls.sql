-- 065: RLS para exponer RMM al rol Cliente (portal cliente, solo lectura).
--
-- Primera vez que RMM sale del rol admin. Los usuarios cliente leen vía PostgREST
-- con la anon key + su JWT (RLS activa; get_my_role()/get_my_org() resuelven del
-- JWT). Staff (admin/agent) y el agente-dispositivo leen vía service_role, que
-- SALTA RLS y grants — por eso restringir el rol `authenticated` solo afecta al
-- cliente y no rompe nada de admin. (Verificado: todo el código que toca estas
-- tablas usa service_role.)
--
-- RLS es a nivel de FILA. La exclusión de COLUMNAS se hace con GRANT por columna
-- sobre `authenticated`: filtrar en el .select() de la app NO es barrera (un
-- cliente con su JWT puede consultar PostgREST directo).

-- ── endpoints: solo columnas seguras, filas de su org y activas ────────────────
-- Excluidas al cliente: token_hash, token_prefix, machine_id, created_by.
REVOKE SELECT ON public.endpoints FROM authenticated;
GRANT SELECT (id, organization_id, hostname, os, status,
              last_seen_at, agent_version, created_at, disabled_at)
  ON public.endpoints TO authenticated;

DROP POLICY IF EXISTS endpoints_select ON public.endpoints;
CREATE POLICY endpoints_select ON public.endpoints FOR SELECT USING (
  (SELECT get_my_role()) = ANY (ARRAY['admin','agent'])
  OR (organization_id = (SELECT get_my_org()) AND disabled_at IS NULL)
);

-- ── endpoint_commands: cliente SIN acceso (privilegio + política) ──────────────
REVOKE SELECT ON public.endpoint_commands FROM authenticated;
DROP POLICY IF EXISTS commands_select ON public.endpoint_commands;
CREATE POLICY commands_select ON public.endpoint_commands FOR SELECT USING (
  (SELECT get_my_role()) = ANY (ARRAY['admin','agent'])
);

-- ── endpoint_metrics: sin cambios. Telemetría no sensible (cpu/ram/disk/uptime),
-- ya restringida por RLS a los endpoints de la org del cliente. El cliente ve la
-- telemetría de SUS propios equipos (decisión de producto).
