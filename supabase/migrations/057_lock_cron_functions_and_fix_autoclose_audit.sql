-- 1) Cerrar funciones de cron a usuarios del navegador.
--
-- run_sla_escalations / run_auto_close_resolved / notify_ticket_status_webhook
-- son SECURITY DEFINER y estaban con EXECUTE para anon: cualquiera con la clave
-- publica (que viaja en el navegador) podia cerrar todos los tickets resueltos
-- o generar notificaciones masivas via /rest/v1/rpc/...
-- Solo las llama pg_cron (que corre como superusuario), nunca la app: revocar
-- no rompe nada. Verificado: no hay ninguna referencia en src/.
REVOKE EXECUTE ON FUNCTION public.run_sla_escalations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_auto_close_resolved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_status_webhook() FROM PUBLIC, anon, authenticated;

-- 2) El autocierre escribia en audit_log (tabla vieja) y por eso no aparecia en
--    la pantalla de Audit Log, que lee audit_logs. Se completa la unificacion
--    que quedo a medias: se corrigio el codigo de la app pero no esta funcion.
CREATE OR REPLACE FUNCTION public.run_auto_close_resolved()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer := 0;
begin
  with closed as (
    update public.tickets
      set status = 'closed', updated_at = now()
      where status = 'resolved'
        and coalesce(resolved_at, updated_at) < now() - interval '3 days'
      returning id
  ),
  audit as (
    insert into public.audit_logs (resource_type, resource_id, action, actor_id, new_values)
    select 'ticket', id::text, 'auto_closed', null,
           jsonb_build_object('status', 'closed', 'reason', 'Cerrado automáticamente por inactividad (3 días en resuelto)')
    from closed
    returning 1
  )
  select count(*) into n from closed;
  return n;
end $function$;

REVOKE EXECUTE ON FUNCTION public.run_auto_close_resolved() FROM PUBLIC, anon, authenticated;
